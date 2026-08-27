import { get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import type { AppState, CountEntry, CountSession, Location, Product } from "./types";
import { normalize } from "./format";

const STORAGE_KEY = "beverage-inventory-state-v1";

const DEFAULT_LOCATIONS: Location[] = [
  { id: "loc-estoque", nome: "Estoque" },
  { id: "loc-bar", nome: "Bar" },
  { id: "loc-prateleira", nome: "Prateleira" },
];

function defaultSessionLabel(date = new Date()): string {
  return `Contagem de ${date.toLocaleDateString("pt-BR")}`;
}

function makeInitialSession(): CountSession {
  // Random id (not a fixed one) so two devices that never started a new session don't
  // collide into the same session when their backups get merged together later.
  return { id: uid("s"), label: defaultSessionLabel(), startedAt: Date.now() };
}

function initialState(): AppState {
  const session = makeInitialSession();
  return {
    products: [],
    locations: DEFAULT_LOCATIONS,
    entries: [],
    sessions: [session],
    activeSessionId: session.id,
  };
}

let state: AppState = initialState();
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    set(STORAGE_KEY, state).catch((err) => console.error("Falha ao salvar dados", err));
  }, 150);
}

// Migrates data saved before count sessions existed: everything goes into one session.
type LegacyOrCurrentState = Partial<AppState> & { entries?: (Partial<CountEntry> & { productId: string; locationId: string; quantidade: number; timestamp: number })[] };

function migrate(saved: LegacyOrCurrentState): AppState {
  const locations = saved.locations?.length ? saved.locations : DEFAULT_LOCATIONS;
  const sessions = saved.sessions?.length ? saved.sessions : [makeInitialSession()];
  const fallbackSessionId = sessions[sessions.length - 1].id;
  const activeSessionId = saved.activeSessionId && sessions.some((s) => s.id === saved.activeSessionId)
    ? saved.activeSessionId
    : fallbackSessionId;
  const entries: CountEntry[] = (saved.entries ?? []).map((e) => ({
    id: e.id ?? uid("e"),
    productId: e.productId,
    locationId: e.locationId,
    quantidade: e.quantidade,
    timestamp: e.timestamp,
    sessionId: e.sessionId ?? fallbackSessionId,
  }));
  return {
    products: saved.products ?? [],
    locations,
    entries,
    sessions,
    activeSessionId,
  };
}

let loadPromise: Promise<void> | null = null;
export function loadState(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = get<AppState>(STORAGE_KEY)
    .then((saved) => {
      if (saved) {
        state = migrate(saved);
      }
    })
    .catch((err) => console.error("Falha ao carregar dados", err))
    .finally(() => {
      loaded = true;
      notify();
    });
  return loadPromise;
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

function update(mutator: (draft: AppState) => AppState) {
  state = mutator(state);
  persist();
  notify();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ProductInput = Omit<Product, "id">;

export const actions = {
  addProduct(input: ProductInput) {
    const product: Product = { id: uid("p"), ...input };
    update((s) => ({ ...s, products: [...s.products, product] }));
    return product;
  },
  updateProduct(id: string, patch: Partial<ProductInput>) {
    update((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },
  deleteProduct(id: string) {
    update((s) => ({
      ...s,
      products: s.products.filter((p) => p.id !== id),
      entries: s.entries.filter((e) => e.productId !== id),
    }));
  },
  importProducts(rows: ProductInput[]) {
    let imported = 0;
    let updated = 0;
    update((s) => {
      const products = [...s.products];
      for (const row of rows) {
        const nome = row.nome.trim();
        if (!nome) continue;
        const codigo = row.codigo?.trim() || undefined;
        const idx = products.findIndex((p) =>
          codigo
            ? p.codigo?.trim().toLowerCase() === codigo.toLowerCase()
            : !p.codigo && p.nome.trim().toLowerCase() === nome.toLowerCase(),
        );
        if (idx >= 0) {
          products[idx] = { ...products[idx], ...row, nome, codigo };
          updated++;
        } else {
          products.push({ id: uid("p"), ...row, nome, codigo });
          imported++;
        }
      }
      return { ...s, products };
    });
    return { imported, updated };
  },
  addLocation(nome: string) {
    const location: Location = { id: uid("loc"), nome: nome.trim() };
    update((s) => ({ ...s, locations: [...s.locations, location] }));
    return location;
  },
  deleteLocation(id: string) {
    update((s) => ({
      ...s,
      locations: s.locations.filter((l) => l.id !== id),
      entries: s.entries.filter((e) => e.locationId !== id),
    }));
  },
  addEntry(productId: string, locationId: string, quantidade: number) {
    const entry: CountEntry = {
      id: uid("e"),
      productId,
      locationId,
      quantidade,
      timestamp: Date.now(),
      sessionId: state.activeSessionId,
    };
    update((s) => ({ ...s, entries: [...s.entries, entry] }));
    return entry;
  },
  deleteEntry(id: string) {
    update((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  },
  startNewSession(label?: string) {
    const session: CountSession = {
      id: uid("s"),
      label: label?.trim() || defaultSessionLabel(),
      startedAt: Date.now(),
    };
    update((s) => ({ ...s, sessions: [...s.sessions, session], activeSessionId: session.id }));
    return session;
  },
  // Merges a backup exported from another device into the data on this one: matches
  // products by código/nome and locations by nome so the same real-world item lines up
  // even though it got a different id on each device, then adds any session/entry that
  // isn't already here (by id). Nothing local is overwritten or removed.
  mergeState(imported: Partial<AppState>) {
    const summary = { products: 0, locations: 0, sessions: 0, entries: 0 };
    update((s) => {
      const locationIdMap = new Map<string, string>();
      const locations = [...s.locations];
      for (const loc of imported.locations ?? []) {
        const existing = locations.find((l) => normalize(l.nome) === normalize(loc.nome));
        if (existing) {
          locationIdMap.set(loc.id, existing.id);
        } else {
          locations.push(loc);
          locationIdMap.set(loc.id, loc.id);
          summary.locations++;
        }
      }

      const productIdMap = new Map<string, string>();
      const products = [...s.products];
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
          products.push(p);
          productIdMap.set(p.id, p.id);
          summary.products++;
        }
      }

      const sessions = [...s.sessions];
      const sessionIds = new Set(sessions.map((sess) => sess.id));
      for (const sess of imported.sessions ?? []) {
        if (!sessionIds.has(sess.id)) {
          sessions.push(sess);
          sessionIds.add(sess.id);
          summary.sessions++;
        }
      }

      const entries = [...s.entries];
      const entryIds = new Set(entries.map((e) => e.id));
      for (const e of imported.entries ?? []) {
        if (entryIds.has(e.id)) continue;
        entries.push({
          ...e,
          productId: productIdMap.get(e.productId) ?? e.productId,
          locationId: locationIdMap.get(e.locationId) ?? e.locationId,
        });
        entryIds.add(e.id);
        summary.entries++;
      }

      return { ...s, products, locations, sessions, entries };
    });
    return summary;
  },
};
