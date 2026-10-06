import { limitador, pegarJson } from "../http.ts";
import { iluria, imusic, lojaIntegrada, nuvemshop, type ProdutoHtml } from "./html.ts";
import { combina, excluido, pareceVinil } from "../texto.ts";
import type { Busca, Coleta, Loja, OfertaBruta } from "../tipos.ts";

// Lojas pequenas: uma requisição a cada 2 segundos por loja é mais que suficiente.
const INTERVALO_MS = 2000;

type Produto = Pick<OfertaBruta, "titulo" | "preco" | "url" | "imagem"> & { idLoja: string; extra?: string };

/**
 * Shopify, WooCommerce e VTEX expõem buscas em JSON, o que evita depender do
 * HTML de cada site (que muda sem aviso). As demais lêem a página de busca.
 */
const plataformas: Record<Loja["plataforma"], (base: string, termo: string) => Promise<Produto[] | ProdutoHtml[]>> = {
  lojaintegrada: lojaIntegrada,
  nuvemshop,
  iluria,
  imusic,

  async shopify(base, termo) {
    const params = new URLSearchParams({ q: termo, "resources[type]": "product", "resources[limit]": "10" });
    const r = await pegarJson<{
      resources: { results: { products: { id: number; title: string; price: string; url: string; image?: string; available?: boolean }[] } };
    }>(`${base}/search/suggest.json?${params}`);
    return r.resources.results.products
      .filter((p) => p.available !== false)
      .map((p) => ({
        idLoja: String(p.id),
        titulo: p.title,
        preco: Number(p.price),
        url: new URL(p.url, base).href,
        imagem: p.image ? new URL(p.image, base).href : undefined,
      }));
  },

  async woocommerce(base, termo) {
    const params = new URLSearchParams({ search: termo, per_page: "20" });
    const r = await pegarJson<
      {
        id: number;
        name: string;
        permalink: string;
        is_in_stock: boolean;
        prices: { price: string; currency_code: string; currency_minor_unit: number };
        images: { src: string }[];
      }[]
    >(`${base}/wp-json/wc/store/v1/products?${params}`);
    return r
      .filter((p) => p.is_in_stock && p.prices.currency_code === "BRL")
      .map((p) => ({
        idLoja: String(p.id),
        titulo: p.name,
        preco: Number(p.prices.price) / 10 ** p.prices.currency_minor_unit,
        url: p.permalink,
        imagem: p.images[0]?.src,
      }));
  },

  async vtex(base, termo) {
    const r = await pegarJson<
      {
        productId: string;
        productName: string;
        link: string;
        items: { images: { imageUrl: string }[]; sellers: { commertialOffer: { Price: number; AvailableQuantity: number } }[] }[];
      }[]
    >(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(termo)}&_from=0&_to=19`);
    return r.flatMap((p) => {
      const oferta = p.items
        .flatMap((i) => i.sellers.map((s) => s.commertialOffer))
        .filter((o) => o.AvailableQuantity > 0)
        .sort((a, b) => a.Price - b.Price)[0];
      if (!oferta) return [];
      return [{ idLoja: p.productId, titulo: p.productName, preco: oferta.Price, url: p.link, imagem: p.items[0]?.images[0]?.imageUrl }];
    });
  },
};

export async function coletarLojas(lojas: Loja[], buscas: Busca[], excluir: string[]): Promise<Coleta> {
  const coleta: Coleta = { ofertas: [], erros: [] };
  // Lojas em paralelo entre si; dentro de cada loja, uma busca por vez.
  await Promise.all(
    lojas.map(async (loja) => {
      const esperar = limitador(INTERVALO_MS);
      const base = loja.url.replace(/\/+$/, "");
      for (const busca of buscas) {
        try {
          await esperar();
          const termo = busca.desejo ? `${busca.desejo.artista} ${busca.desejo.titulo}` : busca.termo;
          for (const p of await plataformas[loja.plataforma](base, termo)) {
            const texto = p.extra ? `${p.titulo} ${p.extra}` : p.titulo;
            if (!Number.isFinite(p.preco) || p.preco <= 0 || excluido(p.titulo, excluir)) continue;
            if (busca.desejo ? !combina(texto, busca.desejo.artista, busca.desejo.titulo) : !loja.soVinil && !pareceVinil(texto)) continue;
            coleta.ofertas.push({
              id: `${loja.nome}:${p.idLoja}`,
              fonte: loja.nome,
              titulo: p.titulo,
              preco: p.preco,
              url: p.url,
              imagem: p.imagem,
              observacao: loja.observacao,
              desejo: busca.desejo?.chave,
              busca: busca.rotulo,
            });
          }
        } catch (e) {
          coleta.erros.push(`${loja.nome}: falha em "${busca.rotulo}": ${(e as Error).message}`);
          // Se a primeira busca já falha, a loja provavelmente não é da plataforma informada.
          if (busca === buscas[0]) {
            coleta.erros.push(`${loja.nome}: confira a URL e a plataforma (${loja.plataforma}) em config.json`);
            break;
          }
        }
      }
    }),
  );
  return coleta;
}
