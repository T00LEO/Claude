import type { Config, Criterio, Oferta, OfertaBruta } from "./tipos.ts";

/**
 * Marca cada oferta com os três critérios de "bom preço". Um critério que não
 * se aplica (sem referência do Discogs, ou só uma fonte para comparar) fica
 * null em vez de false, para a página poder distinguir os dois casos.
 */
export function avaliar(
  brutas: OfertaBruta[],
  config: Config,
  tetos: Map<string, number>,
  referencias: Map<string, number>,
): Oferta[] {
  const porDesejo = new Map<string, OfertaBruta[]>();
  for (const o of brutas) {
    if (!o.desejo) continue;
    porDesejo.set(o.desejo, [...(porDesejo.get(o.desejo) ?? []), o]);
  }

  return brutas.map((o) => {
    const teto = o.desejo ? (tetos.get(o.desejo) ?? config.criterios.teto) : config.varredura.teto;
    const ref = o.desejo ? referencias.get(o.desejo) : undefined;
    const grupo = o.desejo ? porDesejo.get(o.desejo)! : [];
    const comparavel = new Set(grupo.map((g) => g.fonte)).size >= 2;
    return {
      ...o,
      teto,
      refDiscogs: ref,
      criterios: {
        teto: o.preco <= teto,
        discogs: ref === undefined ? null : o.preco <= ref * config.criterios.fatorDiscogs,
        maisBarato: comparavel ? o.preco <= Math.min(...grupo.map((g) => g.preco)) : null,
      },
    };
  });
}

export function deveAlertar(o: Oferta, config: Config): boolean {
  if (!o.desejo && !config.varredura.alertar) return false;
  return config.criterios.alertarQuando.some((c: Criterio) => o.criterios[c] === true);
}
