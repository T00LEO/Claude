import { useSyncExternalStore } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, firebaseConfigured } from "./firebase";
import { normalize } from "./format";
import type { AppState, CountEntry, CountSession, Location, Product } from "./types";

const DEFAULT_LOCATIONS: Location[] = [
  { id: "loc-estoque", nome: "Estoque" },
  { id: "loc-bar", nome: "Bar" },
  { id: "loc-prateleira", nome: "Prateleira" },
];

const ACTIVE_SESSION_KEY = "active-session-id";

function getStoredActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

function setStoredActiveSessionId(id: string) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch {
    // localStorage unavailable (private mode, etc.) — the session just won't be remembered.
  }
}

function pickActiveSessionId(sessions: CountSession[]): string {
  const stored = getStoredActiveSessionId();
  if (stored && sessions.some((s) => s.id === stored)) return stored;
  const mostRecent = [...sessions].sort((a, b) => b.startedAt - a.startedAt)[0];
  return mostRecent?.id ?? "";
}

function emptyState(): AppState {
  return { products: [], locations: [], entries: [], sessions: [], activeSessionId: "" };
}

let state: AppState = emptyState();
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useAppState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useIsLoaded() {
  return useSyncExternalStore(subscribe, () => loaded, () => loaded);
}

// Firestore rejects `undefined` field values — strip them so optional fields (código,
// categoria, contadoPor...) are simply omitted instead of erroring on write.
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) delete clean[key];
  }
  return clean;
}

function fromDoc<T>(d: QueryDocumentSnapshot<DocumentData>): T {
  return { id: d.id, ...d.data() } as T;
}

let unsubscribers: Array<() => void> = [];
let readyFlags = { products: false, locations: false, sessions: false, entries: false };

function checkAllLoaded() {
  if (Object.values(readyFlags).every(Boolean) && !loaded) {
    loaded = true;
    notify();
  }
}

async function seedDefaultLocationsIfEmpty() {
  const batch = writeBatch(db);
  for (const loc of DEFAULT_LOCATIONS) {
    batch.set(doc(db, "locations", loc.id), { nome: loc.nome });
  }
  await batch.commit();
}

async function seedInitialSessionIfEmpty() {
  const ref = doc(collection(db, "sessions"));
  await setDoc(ref, { label: `Contagem de ${new Date().toLocaleDateString("pt-BR")}`, startedAt: Date.now() });
}

function attachListeners() {
  detachListeners();
  readyFlags = { products: false, locations: false, sessions: false, entries: false };
  loaded = false;

  unsubscribers = [
    onSnapshot(collection(db, "products"), (snap) => {
      state = { ...state, products: snap.docs.map((d) => fromDoc<Product>(d)) };
      readyFlags.products = true;
      checkAllLoaded();
      notify();
    }),
    onSnapshot(collection(db, "locations"), (snap) => {
      if (snap.empty && !snap.metadata.fromCache) {
        seedDefaultLocationsIfEmpty().catch((err) => console.error("Falha ao criar locais padrão", err));
      }
      state = { ...state, locations: snap.docs.map((d) => fromDoc<Location>(d)) };
      readyFlags.locations = true;
      checkAllLoaded();
      notify();
    }),
    onSnapshot(collection(db, "sessions"), (snap) => {
      if (snap.empty && !snap.metadata.fromCache) {
        seedInitialSessionIfEmpty().catch((err) => console.error("Falha ao criar sessão inicial", err));
      }
      const sessions = snap.docs.map((d) => fromDoc<CountSession>(d));
      state = { ...state, sessions, activeSessionId: pickActiveSessionId(sessions) };
      readyFlags.sessions = true;
      checkAllLoaded();
      notify();
    }),
    onSnapshot(collection(db, "entries"), (snap) => {
      state = { ...state, entries: snap.docs.map((d) => fromDoc<CountEntry>(d)) };
      readyFlags.entries = true;
      checkAllLoaded();
      notify();
    }),
  ];
}

function detachListeners() {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
}

if (firebaseConfigured) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      attachListeners();
    } else {
      detachListeners();
      state = emptyState();
      loaded = false;
      notify();
    }
  });
}

export type ProductInput = Omit<Product, "id">;

function currentUserLabel(): string | undefined {
  const u = auth.currentUser;
  return u?.displayName ?? u?.email ?? undefined;
}

export const actions = {
  addProduct(input: ProductInput): Product {
    const ref = doc(collection(db, "products"));
    void setDoc(ref, stripUndefined(input));
    return { id: ref.id, ...input };
  },
  updateProduct(id: string, patch: Partial<ProductInput>) {
    void updateDoc(doc(db, "products", id), stripUndefined(patch));
  },
  deleteProduct(id: string) {
    void deleteDoc(doc(db, "products", id));
    const orphanEntries = state.entries.filter((e) => e.productId === id);
    if (orphanEntries.length) {
      const batch = writeBatch(db);
      for (const e of orphanEntries) batch.delete(doc(db, "entries", e.id));
      void batch.commit();
    }
  },
  importProducts(rows: ProductInput[]) {
    let imported = 0;
    let updated = 0;
    const batch = writeBatch(db);
    const products = [...state.products];
    for (const row of rows) {
      const nome = row.nome.trim();
      if (!nome) continue;
      const codigo = row.codigo?.trim() || undefined;
      const idx = products.findIndex((p) =>
        codigo
          ? p.codigo?.trim().toLowerCase() === codigo.toLowerCase()
          : !p.codigo && p.nome.trim().toLowerCase() === nome.toLowerCase(),
      );
      const data = stripUndefined({ ...row, nome, codigo });
      if (idx >= 0) {
        batch.set(doc(db, "products", products[idx].id), data, { merge: true });
        products[idx] = { ...products[idx], ...data };
        updated++;
      } else {
        const ref = doc(collection(db, "products"));
        batch.set(ref, data);
        products.push({ id: ref.id, ...data });
        imported++;
      }
    }
    void batch.commit();
    return { imported, updated };
  },
  addLocation(nome: string): Location {
    const ref = doc(collection(db, "locations"));
    const data = { nome: nome.trim() };
    void setDoc(ref, data);
    return { id: ref.id, ...data };
  },
  deleteLocation(id: string) {
    void deleteDoc(doc(db, "locations", id));
    const orphanEntries = state.entries.filter((e) => e.locationId === id);
    if (orphanEntries.length) {
      const batch = writeBatch(db);
      for (const e of orphanEntries) batch.delete(doc(db, "entries", e.id));
      void batch.commit();
    }
  },
  addEntry(productId: string, locationId: string, quantidade: number): CountEntry {
    const ref = doc(collection(db, "entries"));
    const entry: CountEntry = {
      id: ref.id,
      productId,
      locationId,
      quantidade,
      timestamp: Date.now(),
      sessionId: state.activeSessionId,
      contadoPor: currentUserLabel(),
    };
    const { id: _id, ...data } = entry;
    void setDoc(ref, stripUndefined(data));
    return entry;
  },
  deleteEntry(id: string) {
    void deleteDoc(doc(db, "entries", id));
  },
  startNewSession(label?: string): CountSession {
    const ref = doc(collection(db, "sessions"));
    const session: CountSession = {
      id: ref.id,
      label: label?.trim() || `Contagem de ${new Date().toLocaleDateString("pt-BR")}`,
      startedAt: Date.now(),
    };
    const { id: _id, ...data } = session;
    void setDoc(ref, data);
    setStoredActiveSessionId(session.id);
    state = { ...state, activeSessionId: session.id };
    notify();
    return session;
  },
  switchSession(sessionId: string) {
    setStoredActiveSessionId(sessionId);
    state = { ...state, activeSessionId: sessionId };
    notify();
  },
  // Uploads a backup exported from another device/session into the shared cloud data.
  // Matches products by código/nome and locations by nome so the same real-world item
  // lines up even with a different id; sessions and entries keep their original id, so
  // importing the same backup twice never duplicates anything.
  mergeState(imported: Partial<AppState>) {
    const summary = { products: 0, locations: 0, sessions: 0, entries: 0 };
    const batch = writeBatch(db);

    const locationIdMap = new Map<string, string>();
    const locations = [...state.locations];
    for (const loc of imported.locations ?? []) {
      const existing = locations.find((l) => normalize(l.nome) === normalize(loc.nome));
      if (existing) {
        locationIdMap.set(loc.id, existing.id);
      } else {
        batch.set(doc(db, "locations", loc.id), { nome: loc.nome });
        locations.push(loc);
        locationIdMap.set(loc.id, loc.id);
        summary.locations++;
      }
    }

    const productIdMap = new Map<string, string>();
    const products = [...state.products];
    for (const p of imported.products ?? []) {
      const codigo = p.codigo?.trim();
      const existing = products.find((existingP) =>
        codigo
          ? existingP.codigo?.trim().toLowerCase() === codigo.toLowerCase()
          : !existingP.codigo && normalize(existingP.nome) === normalize(p.nome),
      );
      if (existing) {
        productIdMap.set(p.id, existing.id);
      } else {
        const { id, ...data } = p;
        batch.set(doc(db, "products", id), stripUndefined(data));
        products.push(p);
        productIdMap.set(p.id, p.id);
        summary.products++;
      }
    }

    const existingSessionIds = new Set(state.sessions.map((s) => s.id));
    for (const sess of imported.sessions ?? []) {
      if (!existingSessionIds.has(sess.id)) {
        const { id, ...data } = sess;
        batch.set(doc(db, "sessions", id), data);
        existingSessionIds.add(sess.id);
        summary.sessions++;
      }
    }

    const existingEntryIds = new Set(state.entries.map((e) => e.id));
    for (const e of imported.entries ?? []) {
      if (existingEntryIds.has(e.id)) continue;
      const { id, ...data } = {
        ...e,
        productId: productIdMap.get(e.productId) ?? e.productId,
        locationId: locationIdMap.get(e.locationId) ?? e.locationId,
      };
      batch.set(doc(db, "entries", id), stripUndefined(data));
      existingEntryIds.add(e.id);
      summary.entries++;
    }

    void batch.commit();
    return summary;
  },
};
