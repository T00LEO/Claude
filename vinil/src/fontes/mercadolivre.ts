import { limitador, pegarJson } from "../http.ts";
import { combina, excluido, pareceVinil } from "../texto.ts";
import type { Busca, Coleta } from "../tipos.ts";

const API = "https://api.mercadolibre.com";
const esperar = limitador(500);

interface Item {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  permalink: string;
  thumbnail?: string;
  condition?: string;
  shipping?: { free_shipping?: boolean };
}

/** Token de aplicativo (client_credentials); a busca da API exige autenticação. */
async function obterToken(clientId: string, clientSecret: string): Promise<string> {
  const r = await pegarJson<{ access_token: string }>(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  return r.access_token;
}

export async function coletarMercadoLivre(
  buscas: Busca[],
  excluir: string[],
  credenciais?: { clientId: string; clientSecret: string },
): Promise<Coleta> {
  const coleta: Coleta = { ofertas: [], erros: [] };
  let headers: Record<string, string> = {};
  if (credenciais) {
    try {
      headers = { Authorization: `Bearer ${await obterToken(credenciais.clientId, credenciais.clientSecret)}` };
    } catch (e) {
      coleta.erros.push(`Mercado Livre: não consegui obter o token: ${(e as Error).message}`);
      return coleta;
    }
  }

  for (const busca of buscas) {
    try {
      await esperar();
      const params = new URLSearchParams({ q: `vinil ${busca.termo}`, limit: "50" });
      const r = await pegarJson<{ results: Item[] }>(`${API}/sites/MLB/search?${params}`, { headers });
      for (const item of r.results) {
        if (item.currency_id !== "BRL") continue;
        if (!pareceVinil(item.title) || excluido(item.title, excluir)) continue;
        if (busca.desejo && !combina(item.title, busca.desejo.artista, busca.desejo.titulo)) continue;
        coleta.ofertas.push({
          id: `ml:${item.id}`,
          fonte: "Mercado Livre",
          titulo: item.title,
          preco: item.price,
          url: item.permalink,
          // A API devolve miniaturas em http; a página é servida em https.
          imagem: item.thumbnail?.replace(/^http:/, "https:"),
          condicao: item.condition === "new" ? "novo" : item.condition === "used" ? "usado" : undefined,
          freteGratis: item.shipping?.free_shipping,
          desejo: busca.desejo?.chave,
          busca: busca.rotulo,
        });
      }
    } catch (e) {
      if (/HTTP 40[13]/.test((e as Error).message)) {
        // Desde 2025 o Mercado Livre recusa a busca pública da API mesmo com token válido.
        coleta.erros.push(
          credenciais
            ? "Mercado Livre: a API recusou a busca (403) mesmo com credenciais — o Mercado Livre restringiu esse recurso"
            : "Mercado Livre: a busca exige credenciais — configure ML_CLIENT_ID e ML_CLIENT_SECRET",
        );
        break;
      }
      coleta.erros.push(`Mercado Livre: falha em "${busca.rotulo}": ${(e as Error).message}`);
    }
  }
  return coleta;
}
