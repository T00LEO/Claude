// Descobre em que plataforma cada site roda e como é a página de busca, para
// escrever o coletor certo. Uso: node vinil/src/diagnostico.ts <url>...
import { USER_AGENT } from "./http.ts";

const TERMO = "nirvana";
const ASSINATURAS: [string, RegExp][] = [
  ["shopify", /cdn\.shopify\.com|Shopify\.theme/],
  ["woocommerce", /woocommerce|wp-content/],
  ["vtex", /vteximg|vtexassets|\.vtex\./],
  ["nuvemshop", /nuvemshop|tiendanube|mitiendanube|d26lpennugtm8s\.cloudfront/],
  ["loja integrada", /lojaintegrada|cdn\.awsli\.com\.br/],
  ["tray", /tray\.com\.br|traycorp|images\.tcdn/],
  ["wix", /wixstatic|_wixCssImports|wix\.com/],
  ["magento", /Magento|mage\/cookies/],
  ["yampi", /yampi/],
  ["bagy", /bagy\.com/],
];
const BUSCAS = [
  "/search/suggest.json?q=TERMO&resources[type]=product",
  "/wp-json/wc/store/v1/products?search=TERMO&per_page=2",
  "/api/catalog_system/pub/products/search?ft=TERMO&_from=0&_to=1",
  "/search?q=TERMO",
  "/busca?q=TERMO",
  "/search/?q=TERMO",
  "/loja/busca.php?palavra_busca=TERMO",
  "/buscar?q=TERMO",
  "/?s=TERMO&post_type=product",
  "/page/search?query=TERMO",
];

async function abrir(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json" },
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });
    return { status: res.status, final: res.url, tipo: res.headers.get("content-type") ?? "", corpo: await res.text() };
  } catch (e) {
    return { status: 0, final: url, tipo: "", corpo: String((e as Error).cause ?? (e as Error).message) };
  }
}

/** Trechos ao redor das ocorrências do termo, para ver a estrutura dos cards de produto. */
function trechos(html: string, n = 2, largura = 700): string[] {
  const saida: string[] = [];
  const re = new RegExp(TERMO, "gi");
  let fim = -1;
  for (let m; (m = re.exec(html)) && saida.length < n; ) {
    if (m.index < fim) continue;
    const ini = Math.max(0, m.index - largura / 2);
    fim = m.index + largura / 2;
    saida.push(html.slice(ini, fim).replace(/\s+/g, " "));
  }
  return saida;
}

// "url|marcador": mostra o HTML ao redor do marcador (regex) em vez do diagnóstico completo.
async function inspecionar(url: string, marcador: string) {
  const r = await abrir(url);
  console.log(`\n==================== ${url} [${marcador}]: HTTP ${r.status} → ${r.final}, ${r.corpo.length}b`);
  const re = new RegExp(marcador, "g");
  let fim = -1;
  let n = 0;
  for (let m; (m = re.exec(r.corpo)) && n < 3; ) {
    if (m.index < fim) continue;
    fim = m.index + 3000;
    n++;
    console.log(`\n--- ocorrência ${n}:\n${r.corpo.slice(Math.max(0, m.index - 300), fim).replace(/\s+/g, " ")}`);
  }
  if (n === 0) console.log("marcador não encontrado");
}

for (const site of process.argv.slice(2)) {
  if (site.includes("|")) {
    const [url, marcador] = site.split("|");
    await inspecionar(url, marcador);
    continue;
  }
  console.log(`\n==================== ${site}`);
  const home = await abrir(site);
  console.log(`home: HTTP ${home.status} → ${home.final}`);
  if (home.status === 0) {
    console.log(`  erro: ${home.corpo}`);
    continue;
  }
  const titulo = home.corpo.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim();
  console.log(`título: ${titulo ?? "-"}`);
  console.log(`plataforma: ${ASSINATURAS.filter(([, re]) => re.test(home.corpo)).map(([n]) => n).join(", ") || "desconhecida"}`);
  const gerador = home.corpo.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1];
  if (gerador) console.log(`generator: ${gerador}`);
  const formBusca = home.corpo.match(/<form[^>]*(search|busca)[^>]*>[\s\S]{0,400}?<\/form>/i)?.[0];
  if (formBusca) console.log(`form de busca: ${formBusca.replace(/\s+/g, " ").slice(0, 500)}`);

  const base = new URL(home.final).origin;
  for (const caminho of BUSCAS) {
    const url = base + caminho.replace("TERMO", TERMO);
    const r = await abrir(url);
    const ocorrencias = (r.corpo.match(new RegExp(TERMO, "gi")) ?? []).length;
    console.log(`\n--- ${caminho}: HTTP ${r.status} ${r.tipo.split(";")[0]} ${r.corpo.length}b, "${TERMO}" ×${ocorrencias}`);
    if (r.status !== 200 || ocorrencias === 0) continue;
    if (r.tipo.includes("json")) console.log(r.corpo.slice(0, 1500));
    else for (const t of trechos(r.corpo)) console.log(`  … ${t} …`);
  }
}
