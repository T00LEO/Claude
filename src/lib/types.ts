export interface Product {
  id: string;
  codigo?: string;
  nome: string;
  categoria?: string;
  unidade?: string;
}

export interface Location {
  id: string;
  nome: string;
}

export interface CountEntry {
  id: string;
  productId: string;
  locationId: string;
  quantidade: number;
  timestamp: number;
}

export interface AppState {
  products: Product[];
  locations: Location[];
  entries: CountEntry[];
}
