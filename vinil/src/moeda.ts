import { pegarJson } from "./http.ts";

const cotacoes = new Map<string, Promise<number>>();

/** Converte para reais usando a cotação do dia (Banco Central Europeu, via Frankfurter). */
export async function paraReais(valor: number, moeda: string): Promise<number> {
  if (moeda === "BRL") return valor;
  let cotacao = cotacoes.get(moeda);
  if (!cotacao) {
    cotacao = pegarJson<{ rates: { BRL: number } }>(
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(moeda)}&symbols=BRL`,
    ).then((r) => r.rates.BRL);
    cotacoes.set(moeda, cotacao);
  }
  return Math.round(valor * (await cotacao) * 100) / 100;
}
