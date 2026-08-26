import { get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import type { AppState, CountEntry, Location, Product } from "./types";

const STORAGE_KEY = "beverage-inventory-state-v1";

const DEFAULT_LOCATIONS: Location[] = [
  { id: "loc-estoque", nome: "Estoque" },
  { id: "loc-bar", nome: "Bar" },
  { id: "loc-prateleira", nome: "Prateleira" },
];

let state: AppState = { products: [], locations: DEFAULT_LOCATIONS, entries: [] };
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

let loadPromise: Promise<void> | null = null;
export function loadState(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = get<AppState>(STORAGE_KEY)
    .then((saved) => {
      if (saved) {
        state = {
          products: saved.products ?? [],
          locations: saved.locations?.length ? saved.locations : DEFAULT_LOCATIONS,
          entries: saved.entries ?? [],
        };
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
    };
    update((s) => ({ ...s, entries: [...s.entries, entry] }));
    return entry;
  },
  deleteEntry(id: string) {
    update((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  },
  clearEntries() {
    update((s) => ({ ...s, entries: [] }));
  },
};
