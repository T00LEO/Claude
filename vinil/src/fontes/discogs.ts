import { HttpError, limitador, pegarJson } from "../http.ts";
import { paraReais } from "../moeda.ts";
import type { Busca, Coleta, Desejo } from "../tipos.ts";

const API = "https://api.discogs.com";
// A API autenticada aceita 60 requisições por minuto.
const esperar = limitador(1100);
const PRENSAGENS_POR_DISCO = 3;
const CONDICAO_REFERENCIA = "Very Good Plus (VG+)";

interface Preco {
  value: number;
  currency: string;
}

interface ResultadoBusca {
  id: number;
  title: string;
  year?: string;
  country?: string;
  cover_image?: string;
  thumb?: string;
}

interface Stats {
  lowest_price: Preco | null;
  num_for_sale: number;
}

async function api<T>(caminho: string, token: string): Promise<T> {
  await esperar();
  return pegarJson<T>(`${API}${caminho}`, { headers: { Authorization: `Discogs token=${token}` } });
}

/** Itens da wantlist pública de um usuário, convertidos em desejos. */
export async function wantlist(usuario: string, token: string): Promise<Desejo[]> {
  const desejos: Desejo[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await api<{
      pagination: { pages: number };
      wants: { id: number; basic_information: { title: string; artists: { name: string }[] } }[];
    }>(`/users/${encodeURIComponent(usuario)}/wants?per_page=100&page=${pagina}`, token);
    for (const w of r.wants) {
      desejos.push({
        // O Discogs desambigua artistas homônimos com "(2)", "(3)"...
        artista: w.basic_information.artists.map((a) => a.name.replace(/ \(\d+\)$/, "")).join(", "),
        titulo: w.basic_information.title,
        discogsId: w.id,
      });
    }
    if (pagina >= r.pagination.pages) return desejos;
  }
}

/**
 * A API do Discogs não permite buscar anúncios do marketplace, então para
 * cada disco da lista de desejos pegamos as prensagens em vinil mais
 * relevantes e, de cada uma, o menor preço anunciado e o preço sugerido
 * para um exemplar VG+ (usado como referência de "preço justo").
 */
export async function coletarDiscogs(
  buscas: Busca[],
  token: string,
): Promise<Coleta & { referencias: Map<string, number> }> {
  const coleta: Coleta & { referencias: Map<string, number> } = { ofertas: [], erros: [], referencias: new Map() };
  let sugestoesDisponiveis = true;

  for (const busca of buscas) {
    const desejo = busca.desejo;
    if (!desejo) continue; // varredura geral não é possível via API
    try {
      let prensagens: ResultadoBusca[];
      if (desejo.discogsId) {
        const r = await api<{ id: number; title: string; artists_sort?: string; year?: number; country?: string; images?: { uri: string }[] }>(
          `/releases/${desejo.discogsId}`,
          token,
        );
        prensagens = [
          {
            id: r.id,
            title: `${r.artists_sort ?? desejo.artista} - ${r.title}`,
            year: r.year ? String(r.year) : undefined,
            country: r.country,
            cover_image: r.images?.[0]?.uri,
          },
        ];
      } else {
        const params = new URLSearchParams({
          type: "release",
          format: "Vinyl",
          artist: desejo.artista,
          release_title: desejo.titulo,
          per_page: String(PRENSAGENS_POR_DISCO),
        });
        const r = await api<{ results: ResultadoBusca[] }>(`/database/search?${params}`, token);
        prensagens = r.results.slice(0, PRENSAGENS_POR_DISCO);
        if (prensagens.length === 0) {
          coleta.erros.push(`Discogs: nada encontrado para "${busca.rotulo}"`);
          continue;
        }
      }

      const sugestoes: number[] = [];
      for (const p of prensagens) {
        const stats = await api<Stats>(`/marketplace/stats/${p.id}?curr_abbr=BRL`, token);
        if (sugestoesDisponiveis) {
          try {
            const s = await api<Record<string, Preco>>(`/marketplace/price_suggestions/${p.id}`, token);
            const vgPlus = s[CONDICAO_REFERENCIA];
            if (vgPlus) sugestoes.push(await paraReais(vgPlus.value, vgPlus.currency));
          } catch (e) {
            // Sugestões exigem as configurações de vendedor preenchidas na conta.
            if (e instanceof HttpError && e.status < 500) {
              sugestoesDisponiveis = false;
              coleta.erros.push(
                "Discogs: preços sugeridos indisponíveis — preencha as configurações de vendedor da sua conta para ativar a referência Discogs",
              );
            } else throw e;
          }
        }
        if (!stats.lowest_price || stats.num_for_sale === 0) continue;
        const detalhes = [p.year, p.country].filter(Boolean).join(", ");
        coleta.ofertas.push({
          id: `discogs:${p.id}`,
          fonte: "Discogs",
          titulo: detalhes ? `${p.title} (${detalhes})` : p.title,
          preco: await paraReais(stats.lowest_price.value, stats.lowest_price.currency),
          precoOriginal: { valor: stats.lowest_price.value, moeda: stats.lowest_price.currency },
          url: `https://www.discogs.com/sell/release/${p.id}`,
          imagem: p.cover_image ?? p.thumb,
          observacao: `Menor preço entre ${stats.num_for_sale} anúncio(s), sem frete; vendedores no exterior pagam imposto de importação`,
          desejo: desejo.chave,
          busca: busca.rotulo,
        });
      }
      if (sugestoes.length > 0) coleta.referencias.set(desejo.chave, mediana(sugestoes));
    } catch (e) {
      coleta.erros.push(`Discogs: falha em "${busca.rotulo}": ${(e as Error).message}`);
    }
  }
  return coleta;
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100;
}
