import { pegarJson } from "./http.ts";
import type { Criterio, Oferta } from "./tipos.ts";

const MAX_NA_MENSAGEM = 10;
const ROTULOS: Record<Criterio, string> = {
  teto: "abaixo do teto",
  discogs: "abaixo do Discogs",
  maisBarato: "mais barato entre as lojas",
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function montarMensagem(ofertas: Oferta[], pagina: string): { titulo: string; linhas: string[] } {
  const ordenadas = [...ofertas].sort((a, b) => a.preco - b.preco);
  const linhas = ordenadas.slice(0, MAX_NA_MENSAGEM).map((o) => {
    const motivos = (Object.keys(ROTULOS) as Criterio[]).filter((c) => o.criterios[c]).map((c) => ROTULOS[c]);
    return `• ${o.titulo} — ${reais(o.preco)} (${o.fonte}; ${motivos.join(", ")})\n${o.url}`;
  });
  if (ordenadas.length > MAX_NA_MENSAGEM) linhas.push(`…e mais ${ordenadas.length - MAX_NA_MENSAGEM}. Veja todas em ${pagina}`);
  const titulo = ofertas.length === 1 ? "1 oferta nova de vinil" : `${ofertas.length} ofertas novas de vinil`;
  return { titulo, linhas };
}

/** Envia pelos canais configurados; devolve os erros em vez de lançar. */
export async function enviarAlertas(ofertas: Oferta[], pagina: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  if (ofertas.length === 0) return [];
  const { titulo, linhas } = montarMensagem(ofertas, pagina);
  const erros: string[] = [];

  if (env.NTFY_TOPIC) {
    try {
      // Publicação em JSON: cabeçalhos HTTP não aceitam acentos nem emoji.
      await pegarJson(env.NTFY_SERVIDOR || "https://ntfy.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: env.NTFY_TOPIC, title: titulo, message: linhas.join("\n\n"), click: pagina, tags: ["cd"] }),
      });
    } catch (e) {
      erros.push(`Alerta ntfy: ${(e as Error).message}`);
    }
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await pegarJson(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `${titulo}\n\n${linhas.join("\n\n")}\n\n${pagina}`,
          disable_web_page_preview: true,
        }),
      });
    } catch (e) {
      erros.push(`Alerta Telegram: ${(e as Error).message.replace(env.TELEGRAM_BOT_TOKEN, "***")}`);
    }
  }
  return erros;
}
