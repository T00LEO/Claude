import { appendFile, readFile, writeFile } from "node:fs/promises";
import { enviarAlertas, temCanal } from "./alertas.ts";
import { avaliar, deveAlertar } from "./criterios.ts";
import { coletarDiscogs, wantlist } from "./fontes/discogs.ts";
import { coletarLojas } from "./fontes/lojas.ts";
import { coletarMercadoLivre } from "./fontes/mercadolivre.ts";
import { paraReais } from "./moeda.ts";
import { chaveDesejo } from "./texto.ts";
import type { Busca, Coleta, Config, Desejo, Importacao, OfertaBruta, Resultado } from "./tipos.ts";

const CONFIG = new URL("../config.json", import.meta.url);
const SAIDA = new URL("../site/ofertas.json", import.meta.url);
const VISTOS = new URL("../estado/vistos.json", import.meta.url);
const PAGINA = process.env.PAGINA_URL || "https://t00leo.github.io/Claude/vinil/";
const DIAS_PARA_ESQUECER = 90;

type Vistos = Record<string, { preco: number; em: string }>;

async function lerJson<T>(arquivo: URL, padrao: T): Promise<T> {
  try {
    return JSON.parse(await readFile(arquivo, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return padrao;
    throw e;
  }
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG, "utf8")) as Config;
  const env = process.env;
  const erros: string[] = [];

  let desejos: Desejo[] = config.listaDeDesejos;
  if (config.fontes.discogsWantlist) {
    if (!env.DISCOGS_TOKEN) erros.push("Discogs: DISCOGS_TOKEN não configurado; wantlist ignorada");
    else {
      try {
        desejos = [...desejos, ...(await wantlist(config.fontes.discogsWantlist, env.DISCOGS_TOKEN))];
      } catch (e) {
        erros.push(`Discogs: não consegui ler a wantlist: ${(e as Error).message}`);
      }
    }
  }

  // Um disco pode estar na config e na wantlist; vale a primeira ocorrência (a da config).
  const buscas: Busca[] = [];
  const tetos = new Map<string, number>();
  for (const d of desejos) {
    const chave = chaveDesejo(d.artista, d.titulo);
    if (tetos.has(chave)) continue;
    tetos.set(chave, d.teto ?? config.criterios.teto);
    buscas.push({ rotulo: `${d.artista} – ${d.titulo}`, termo: `${d.artista} ${d.titulo}`, desejo: { ...d, chave } });
  }
  for (const termo of [...config.varredura.generos, ...config.varredura.termos]) {
    buscas.push({ rotulo: termo, termo });
  }

  const coletas: Promise<Coleta>[] = [];
  let referencias = new Map<string, number>();
  if (config.fontes.discogs) {
    if (!env.DISCOGS_TOKEN) erros.push("Discogs: DISCOGS_TOKEN não configurado; fonte ignorada");
    else
      coletas.push(
        coletarDiscogs(buscas, env.DISCOGS_TOKEN).then((c) => {
          referencias = c.referencias;
          return c;
        }),
      );
  }
  if (config.fontes.mercadoLivre) {
    const credenciais =
      env.ML_CLIENT_ID && env.ML_CLIENT_SECRET ? { clientId: env.ML_CLIENT_ID, clientSecret: env.ML_CLIENT_SECRET } : undefined;
    coletas.push(coletarMercadoLivre(buscas, config.excluir, credenciais));
  }
  if (config.lojas.length > 0) coletas.push(coletarLojas(config.lojas, buscas, config.excluir));

  // O mesmo anúncio pode aparecer em várias buscas; fica o que veio da lista de desejos.
  const porId = new Map<string, OfertaBruta>();
  for (const c of await Promise.all(coletas)) {
    erros.push(...c.erros);
    for (const o of c.ofertas) {
      const atual = porId.get(o.id);
      if (!atual || (!atual.desejo && o.desejo)) porId.set(o.id, o);
    }
  }
  // Vendedores do Discogs são pessoas físicas, fora do Remessa Conforme; tratamos todos como no exterior.
  const dolar = await paraReais(1, "USD");
  const importados = new Map<string, Importacao>([
    ["Discogs", { freteBRL: config.importacao.freteDiscogsUSD * dolar, remessaConforme: false }],
  ]);
  for (const loja of config.lojas) if (loja.importacao) importados.set(loja.nome, loja.importacao);
  const ofertas = avaliar([...porId.values()], config, tetos, referencias, importados, dolar).sort(
    (a, b) => a.precoTotal - b.precoTotal,
  );

  // Alerta só o que é novo ou ficou mais barato desde o último alerta.
  const vistos = await lerJson<Vistos>(VISTOS, {});
  const agora = new Date();
  const novas = ofertas.filter((o) => {
    const visto = vistos[o.id];
    return deveAlertar(o, config) && (!visto || o.precoTotal < visto.preco);
  });
  const errosAlerta = await enviarAlertas(novas, PAGINA, env);
  erros.push(...errosAlerta);
  // Sem canal configurado nada foi enviado: não marca, para alertar quando houver.
  if (temCanal(env) && errosAlerta.length === 0) {
    for (const o of novas) vistos[o.id] = { preco: o.precoTotal, em: agora.toISOString() };
  }
  const limite = agora.getTime() - DIAS_PARA_ESQUECER * 86_400_000;
  for (const [id, v] of Object.entries(vistos)) if (Date.parse(v.em) < limite) delete vistos[id];

  const resultado: Resultado = {
    geradoEm: agora.toISOString(),
    teto: config.criterios.teto,
    tetoVarredura: config.varredura.teto,
    fatorDiscogs: config.criterios.fatorDiscogs,
    desejos: buscas.flatMap((b) =>
      b.desejo
        ? [{ chave: b.desejo.chave, artista: b.desejo.artista, titulo: b.desejo.titulo, teto: tetos.get(b.desejo.chave)!, refDiscogs: referencias.get(b.desejo.chave) }]
        : [],
    ),
    ofertas,
    erros,
  };
  await writeFile(SAIDA, JSON.stringify(resultado, null, 1) + "\n");
  await writeFile(VISTOS, JSON.stringify(vistos, null, 1) + "\n");

  const resumo = [
    `${ofertas.length} ofertas coletadas em ${buscas.length} buscas; ${temCanal(env) ? `${novas.length} alertada(s)` : "nenhum canal de alerta configurado"}.`,
    ...erros.map((e) => `- ${e}`),
  ].join("\n");
  console.log(resumo);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `## Varredura de vinil\n\n${resumo}\n`);
}

await main();
