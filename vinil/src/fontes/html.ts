// Coletores de lojas sem busca em JSON: lêem a página de resultados da busca.
// Cada um depende do HTML da plataforma; se a loja mudar o tema, o coletor
// passa a devolver zero produtos e isso aparece nos avisos da página.
import { pegarHtml } from "../http.ts";

export interface ProdutoHtml {
  idLoja: string;
  titulo: string;
  preco: number;
  url: string;
  imagem?: string;
  /** Texto extra usado só para reconhecer o disco (ex.: artista que não aparece no título). */
  extra?: string;
}

const ENTIDADES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

export function decodificar(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, nome: string) => ENTIDADES[nome.toLowerCase()] ?? decodificarAcento(m))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** &Aacute; → Á, &ccedil; → ç etc. */
function decodificarAcento(entidade: string): string {
  const m = entidade.match(/^&([a-z])(acute|grave|circ|tilde|uml|cedil);$/i);
  if (!m) return entidade;
  const marcas: Record<string, string> = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", uml: "̈", cedil: "̧" };
  return (m[1] + marcas[m[2].toLowerCase()]).normalize("NFC");
}

/** "1.234,56" → 1234.56 */
export function precoBr(s: string): number {
  return Number(s.replace(/[^\d,]/g, "").replace(",", "."));
}

/** Divide o HTML em blocos, um por produto, a partir de um marcador de início. */
function blocos(html: string, inicio: RegExp): string[] {
  const indices = [...html.matchAll(new RegExp(inicio.source, "g"))].map((m) => m.index);
  return indices.map((ini, i) => html.slice(ini, indices[i + 1] ?? ini + 20_000));
}

const absoluta = (url: string, base: string) => new URL(decodificar(url), base + "/").href;

export async function lojaIntegrada(base: string, termo: string): Promise<ProdutoHtml[]> {
  const html = await pegarHtml(`${base}/buscar?q=${encodeURIComponent(termo)}`);
  return lerLojaIntegrada(html, base);
}

export function lerLojaIntegrada(html: string, base: string): ProdutoHtml[] {
  return blocos(html, /<div class="listagem-item/).flatMap((b) => {
    const id = b.match(/data-id="(\d+)"/)?.[1];
    const nome = b.match(/<a href="([^"]+)" class="nome-produto[^"]*">([^<]+)<\/a>/);
    const preco = b.match(/data-sell-price="([\d.]+)"/)?.[1];
    // Produto esgotado não mostra preço de venda.
    if (!id || !nome || !preco) return [];
    return [
      {
        idLoja: id,
        titulo: decodificar(nome[2]),
        preco: Number(preco),
        url: absoluta(nome[1], base),
        imagem: b.match(/<img src="([^"]+)"[^>]*class="imagem-principal"/)?.[1],
      },
    ];
  });
}

export async function nuvemshop(base: string, termo: string): Promise<ProdutoHtml[]> {
  const html = await pegarHtml(`${base}/search/?q=${encodeURIComponent(termo)}`);
  return lerNuvemshop(html, base);
}

export function lerNuvemshop(html: string, base: string): ProdutoHtml[] {
  return blocos(html, /<div class="[^"]*\bjs-item-product\b/).flatMap((b) => {
    const id = b.match(/data-product-id="(\d+)"/)?.[1];
    const variantes = b.match(/data-variants="([^"]+)"/)?.[1];
    if (!id || !variantes) return [];
    const disponiveis = (JSON.parse(variantes.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&")) as {
      price_number: number | null;
      available: boolean;
      image_url?: string;
    }[]).filter((v) => v.available && v.price_number);
    if (disponiveis.length === 0) return [];
    const link = b.match(/<a href="([^"]*\/produtos\/[^"]+)" title="([^"]+)"/);
    if (!link) return [];
    const imagem = disponiveis[0].image_url;
    return [
      {
        idLoja: id,
        titulo: decodificar(link[2]),
        preco: Math.min(...disponiveis.map((v) => v.price_number!)),
        url: absoluta(link[1], base),
        imagem: imagem ? absoluta(imagem, base) : undefined,
      },
    ];
  });
}

export async function iluria(base: string, termo: string): Promise<ProdutoHtml[]> {
  const html = await pegarHtml(`${base}/search.html?searchQuery=${encodeURIComponent(termo)}`);
  return lerIluria(html, base);
}

export function lerIluria(html: string, base: string): ProdutoHtml[] {
  return blocos(html, /<div class="product-item-container">/).flatMap((b) => {
    const link = b.match(/<a href="(pd-([0-9a-f]+)-[^"?]+)/i);
    const nome = b.match(/iluria-layout-search-product-title">\s*<a [^>]*>([^<]+)<\/a>/)?.[1];
    const preco = b.match(/product-price-text">([\d.,]+)</)?.[1];
    if (!link || !nome || !preco) return [];
    const imagem = b.match(/<img src="([^"]+)"/)?.[1];
    return [
      {
        idLoja: link[2],
        titulo: decodificar(nome),
        preco: precoBr(preco),
        url: absoluta(link[1], base),
        imagem: imagem ? absoluta(imagem, base) : undefined,
      },
    ];
  });
}

export async function imusic(base: string, termo: string): Promise<ProdutoHtml[]> {
  const html = await pegarHtml(`${base}/vinyl/search?query=${encodeURIComponent(termo)}`);
  return lerImusic(html, base);
}

export function lerImusic(html: string, base: string): ProdutoHtml[] {
  return blocos(html, /<div class="media search-teaser">/).flatMap((b) => {
    const link = b.match(/<a href="(\/[a-z]+\/(\d+)\/([^"]+))" title="([^"]+)"/);
    // O preço só vale se estiver em reais; o site troca de moeda conforme a sessão.
    const preco = b.match(/btn-success price">\s*R\$\s*([\d.,]+)/)?.[1];
    if (!link || !preco) return [];
    return [
      {
        idLoja: link[2],
        titulo: decodificar(link[4]),
        preco: precoBr(preco),
        url: absoluta(link[1], base),
        imagem: b.match(/<img src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&"),
        // O título não traz o artista; o endereço traz ("nirvana-1991-nevermind-lp").
        extra: link[3].replace(/-/g, " "),
      },
    ];
  });
}
