export type Criterio = "teto" | "discogs" | "maisBarato";

export interface Desejo {
  artista: string;
  titulo: string;
  /** Teto próprio deste disco; se ausente vale o teto geral. */
  teto?: number;
  /** ID de um release específico no Discogs, para quando a busca por nome é ambígua. */
  discogsId?: number;
}

export interface Loja {
  nome: string;
  url: string;
  plataforma: "shopify" | "woocommerce" | "vtex";
  /** Loja que só vende vinil: dispensa "vinil"/"LP" no nome do produto na varredura geral. */
  soVinil?: boolean;
}

export interface Config {
  criterios: {
    teto: number;
    /** Oferta é "boa" pelo Discogs se preço <= referência × fator. */
    fatorDiscogs: number;
    alertarQuando: Criterio[];
  };
  fontes: {
    discogs: boolean;
    mercadoLivre: boolean;
    /** Usuário do Discogs cuja wantlist entra na lista de desejos. */
    discogsWantlist?: string;
  };
  lojas: Loja[];
  listaDeDesejos: Desejo[];
  varredura: {
    generos: string[];
    termos: string[];
    teto: number;
    alertar: boolean;
  };
  /** Palavras que descartam um anúncio (acessórios, CDs etc.). */
  excluir: string[];
}

export interface Oferta {
  /** Único por anúncio: "<fonte>:<id na fonte>". */
  id: string;
  fonte: string;
  titulo: string;
  preco: number;
  precoOriginal?: { valor: number; moeda: string };
  url: string;
  imagem?: string;
  condicao?: "novo" | "usado";
  freteGratis?: boolean;
  observacao?: string;
  /** Chave do item da lista de desejos; ausente em ofertas da varredura geral. */
  desejo?: string;
  busca: string;
  teto: number;
  refDiscogs?: number;
  criterios: Record<Criterio, boolean | null>;
}

/** O que cada fonte devolve; critérios e teto são calculados depois. */
export type OfertaBruta = Omit<Oferta, "teto" | "refDiscogs" | "criterios">;

export interface Coleta {
  ofertas: OfertaBruta[];
  erros: string[];
}

/** Uma busca a ser feita em cada fonte. */
export interface Busca {
  rotulo: string;
  termo: string;
  /** Presente quando a busca vem da lista de desejos. */
  desejo?: Desejo & { chave: string };
}

export interface Resultado {
  geradoEm: string;
  teto: number;
  tetoVarredura: number;
  fatorDiscogs: number;
  desejos: { chave: string; artista: string; titulo: string; teto: number; refDiscogs?: number }[];
  ofertas: Oferta[];
  erros: string[];
}
