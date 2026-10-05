const DIACRITICS_RE = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g",
);

const IGNORAR = new Set(["the", "and", "dos", "das", "com", "por", "para", "uma", "vinil", "vinyl", "disco", "lacrado"]);
const FORMATO_RE = /\b(vinil|vinyl|lp|lps|long ?play|12 ?pol|7 ?pol|compacto)\b/;

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS_RE, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function palavras(s: string): string[] {
  return normalizar(s)
    .split(" ")
    .filter((p) => p.length >= 3 && !IGNORAR.has(p));
}

export function chaveDesejo(artista: string, titulo: string): string {
  return normalizar(`${artista} ${titulo}`).replace(/ /g, "-");
}

/** Descarta anúncios que contêm palavras proibidas (CD, vitrola, pôster...). */
export function excluido(titulo: string, excluir: string[]): boolean {
  const t = ` ${normalizar(titulo)} `;
  return excluir.some((e) => t.includes(` ${normalizar(e)} `));
}

export function pareceVinil(titulo: string): boolean {
  return FORMATO_RE.test(normalizar(titulo));
}

/**
 * O anúncio é deste disco? Exige a maioria das palavras do artista e do
 * título — anúncios de marketplace raramente trazem o nome exato.
 */
export function combina(anuncio: string, artista: string, titulo: string): boolean {
  const a = new Set(palavras(anuncio));
  const fracao = (ps: string[]) => (ps.length === 0 ? 1 : ps.filter((p) => a.has(p)).length / ps.length);
  return fracao(palavras(artista)) >= 0.5 && fracao(palavras(titulo)) >= 0.6;
}
