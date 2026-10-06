// Estimativa do custo total de um disco importado por pessoa física, pelas
// regras vigentes desde 12/05/2026 (MP 1.357/2026, convertida na Lei 15.502):
// - loja no Remessa Conforme: imposto de importação zero até US$ 50; acima,
//   60% com dedução de US$ 30;
// - fora do programa: 60% sobre tudo, mais a taxa de despacho dos Correios;
// - ICMS estadual (17% a 20%) em todos os casos, calculado "por dentro".
// A base de cálculo é o valor aduaneiro: produto + frete.

export interface RegrasImportacao {
  /** Alíquota de ICMS do seu estado sobre remessas internacionais (0.17 a 0.20). */
  icms: number;
  /** Taxa de despacho postal dos Correios para remessas fora do Remessa Conforme. */
  despachoPostal: number;
}

export interface CustosImportacao {
  frete: number;
  impostoImportacao: number;
  icms: number;
  despacho: number;
}

const LIMITE_USD = 50;
const DEDUCAO_USD = 30;
const ALIQUOTA_II = 0.6;

const centavos = (n: number) => Math.round(n * 100) / 100;

export function calcularImportacao(
  preco: number,
  frete: number,
  remessaConforme: boolean,
  dolar: number,
  regras: RegrasImportacao,
): CustosImportacao {
  const aduaneiro = preco + frete;
  let ii: number;
  if (!remessaConforme) ii = aduaneiro * ALIQUOTA_II;
  else if (aduaneiro / dolar <= LIMITE_USD) ii = 0;
  else ii = Math.max(0, aduaneiro * ALIQUOTA_II - DEDUCAO_USD * dolar);
  // "Por dentro": o ICMS faz parte da própria base, então a base é dividida por (1 - alíquota).
  const icms = ((aduaneiro + ii) / (1 - regras.icms)) * regras.icms;
  return {
    frete: centavos(frete),
    impostoImportacao: centavos(ii),
    icms: centavos(icms),
    despacho: remessaConforme ? 0 : regras.despachoPostal,
  };
}

export function total(preco: number, c: CustosImportacao): number {
  return centavos(preco + c.frete + c.impostoImportacao + c.icms + c.despacho);
}
