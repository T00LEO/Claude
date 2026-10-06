import { calcularImportacao, total } from "./importacao.ts";
import type { Config, Criterio, Importacao, Oferta, OfertaBruta } from "./tipos.ts";

/**
 * Calcula o preço total (com frete e impostos, se importado) e marca cada
 * oferta com os três critérios de "bom preço". Um critério que não se aplica
 * (sem referência do Discogs, ou só uma fonte para comparar) fica null em vez
 * de false, para a página poder distinguir os dois casos.
 */
export function avaliar(
  brutas: OfertaBruta[],
  config: Config,
  tetos: Map<string, number>,
  referencias: Map<string, number>,
  /** Fontes no exterior, pelo nome da fonte. */
  importados: Map<string, Importacao>,
  dolar: number,
): Oferta[] {
  const comTotal = brutas.map((o) => {
    const imp = importados.get(o.fonte);
    if (!imp) return { ...o, precoTotal: o.preco };
    const custos = calcularImportacao(o.preco, imp.freteBRL, imp.remessaConforme, dolar, config.importacao);
    return { ...o, precoTotal: total(o.preco, custos), custos };
  });

  const menorPorDesejo = new Map<string, number>();
  const fontesPorDesejo = new Map<string, Set<string>>();
  for (const o of comTotal) {
    if (!o.desejo) continue;
    menorPorDesejo.set(o.desejo, Math.min(menorPorDesejo.get(o.desejo) ?? Infinity, o.precoTotal));
    fontesPorDesejo.set(o.desejo, (fontesPorDesejo.get(o.desejo) ?? new Set()).add(o.fonte));
  }

  return comTotal.map((o) => {
    const teto = o.desejo ? (tetos.get(o.desejo) ?? config.criterios.teto) : config.varredura.teto;
    const ref = o.desejo ? referencias.get(o.desejo) : undefined;
    const comparavel = o.desejo ? fontesPorDesejo.get(o.desejo)!.size >= 2 : false;
    return {
      ...o,
      teto,
      refDiscogs: ref,
      criterios: {
        teto: o.precoTotal <= teto,
        // A referência do Discogs é o valor do disco em si, então compara com o preço sem frete e impostos.
        discogs: ref === undefined ? null : o.preco <= ref * config.criterios.fatorDiscogs,
        maisBarato: comparavel ? o.precoTotal <= menorPorDesejo.get(o.desejo!)! : null,
      },
    };
  });
}

/** Só alerta o que cabe no teto pelo preço total, e então se atender a algum critério escolhido. */
export function deveAlertar(o: Oferta, config: Config): boolean {
  if (!o.desejo && !config.varredura.alertar) return false;
  return o.criterios.teto === true && config.criterios.alertarQuando.some((c: Criterio) => o.criterios[c] === true);
}
