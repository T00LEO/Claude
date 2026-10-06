import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { montarMensagem } from "../src/alertas.ts";
import { avaliar, deveAlertar } from "../src/criterios.ts";
import { calcularImportacao, total } from "../src/importacao.ts";
import { coletarDiscogs } from "../src/fontes/discogs.ts";
import { coletarLojas } from "../src/fontes/lojas.ts";
import { coletarMercadoLivre } from "../src/fontes/mercadolivre.ts";
import { chaveDesejo, combina, excluido } from "../src/texto.ts";
import type { Busca, Config, OfertaBruta } from "../src/tipos.ts";

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

/** Substitui fetch: cada rota é um trecho da URL e a resposta JSON correspondente. */
function simularFetch(rotas: [string, unknown][]) {
  const chamadas: string[] = [];
  globalThis.fetch = (async (entrada: string | URL) => {
    const url = String(entrada);
    chamadas.push(url);
    const rota = rotas.find(([trecho]) => url.includes(trecho));
    if (!rota) return new Response("{}", { status: 404 });
    return Response.json(rota[1]);
  }) as typeof fetch;
  return chamadas;
}

const config: Config = {
  criterios: { teto: 200, fatorDiscogs: 0.9, alertarQuando: ["teto", "discogs"] },
  fontes: { discogs: true, mercadoLivre: true },
  lojas: [],
  listaDeDesejos: [],
  varredura: { generos: ["jazz"], termos: [], teto: 80, alertar: false },
  importacao: { icms: 0.2, despachoPostal: 15, freteDiscogsUSD: 20 },
  excluir: ["cd", "vitrola", "poster"],
};

const desejo = { artista: "Milton Nascimento", titulo: "Clube da Esquina", chave: chaveDesejo("Milton Nascimento", "Clube da Esquina") };
const buscaDesejo: Busca = { rotulo: "Milton Nascimento – Clube da Esquina", termo: "Milton Nascimento Clube da Esquina", desejo };
const buscaGenero: Busca = { rotulo: "jazz", termo: "jazz" };

test("combina tolera variações de escrita do anúncio", () => {
  assert.ok(combina("LP Vinil Clube Da Esquina - Milton Nascimento e Lô Borges 1972", "Milton Nascimento", "Clube da Esquina"));
  assert.ok(combina("milton nascimento clube esquina 2 lp duplo", "Milton Nascimento", "Clube da Esquina"));
  assert.ok(!combina("LP Milton Nascimento - Minas", "Milton Nascimento", "Clube da Esquina"));
  assert.ok(excluido("Poster Clube da Esquina", ["poster"]));
  assert.ok(excluido("Clube da Esquina CD remaster", ["cd"]));
  assert.ok(!excluido("Clube da Esquina LP com encarte", ["cd"]));
});

test("Mercado Livre filtra acessórios, CDs e anúncios de outros discos", async () => {
  simularFetch([
    ["/oauth/token", { access_token: "abc" }],
    [
      "/sites/MLB/search",
      {
        results: [
          { id: "MLB1", title: "Lp Vinil Milton Nascimento Clube Da Esquina", price: 180, currency_id: "BRL", permalink: "https://ml/1", thumbnail: "http://img/1.jpg", condition: "used", shipping: { free_shipping: true } },
          { id: "MLB2", title: "Cd Milton Nascimento Clube Da Esquina", price: 30, currency_id: "BRL", permalink: "https://ml/2" },
          { id: "MLB3", title: "Vinil Milton Nascimento Travessia", price: 90, currency_id: "BRL", permalink: "https://ml/3" },
          { id: "MLB4", title: "Vitrola + LP Clube da Esquina Milton Nascimento", price: 300, currency_id: "BRL", permalink: "https://ml/4" },
        ],
      },
    ],
  ]);
  const c = await coletarMercadoLivre([buscaDesejo], config.excluir, { clientId: "id", clientSecret: "s" });
  assert.deepEqual(c.erros, []);
  assert.deepEqual(c.ofertas.map((o) => o.id), ["ml:MLB1"]);
  assert.equal(c.ofertas[0].imagem, "https://img/1.jpg");
  assert.equal(c.ofertas[0].condicao, "usado");
  assert.equal(c.ofertas[0].desejo, desejo.chave);
});

test("Mercado Livre sem credenciais avisa e para no primeiro 403", async () => {
  const chamadas = simularFetch([]);
  globalThis.fetch = (async (u: string) => {
    chamadas.push(String(u));
    return new Response("{}", { status: 403 });
  }) as typeof fetch;
  const c = await coletarMercadoLivre([buscaDesejo, buscaGenero], [], undefined);
  assert.equal(chamadas.length, 1);
  assert.match(c.erros.join("\n"), /ML_CLIENT_ID/);
});

test("Mercado Livre com credenciais e busca recusada gera um único aviso", async () => {
  globalThis.fetch = (async (u: string) =>
    String(u).includes("/oauth/token") ? Response.json({ access_token: "abc" }) : new Response("{}", { status: 403 })) as typeof fetch;
  const c = await coletarMercadoLivre([buscaDesejo, buscaGenero], [], { clientId: "id", clientSecret: "s" });
  assert.equal(c.erros.length, 1);
  assert.match(c.erros[0], /restringiu/);
});

test("Discogs usa o menor preço de cada prensagem e a mediana das sugestões VG+", async () => {
  const chamadas = simularFetch([
    ["/database/search", { results: [{ id: 11, title: "Milton Nascimento - Clube Da Esquina", year: "1972", country: "Brazil" }, { id: 22, title: "Milton Nascimento - Clube Da Esquina", year: "2012" }] }],
    ["/marketplace/stats/11", { lowest_price: { value: 350, currency: "BRL" }, num_for_sale: 4 }],
    ["/marketplace/stats/22", { lowest_price: null, num_for_sale: 0 }],
    ["/marketplace/price_suggestions/11", { "Very Good Plus (VG+)": { value: 400, currency: "BRL" } }],
    ["/marketplace/price_suggestions/22", { "Very Good Plus (VG+)": { value: 200, currency: "BRL" } }],
  ]);
  const c = await coletarDiscogs([buscaDesejo, buscaGenero], "tok");
  assert.deepEqual(c.erros, []);
  assert.equal(c.ofertas.length, 1);
  assert.equal(c.ofertas[0].preco, 350);
  assert.equal(c.ofertas[0].titulo, "Milton Nascimento - Clube Da Esquina (1972, Brazil)");
  assert.equal(c.referencias.get(desejo.chave), 300);
  assert.ok(chamadas[0].includes("format=Vinyl"));
  // A busca por gênero não gera chamadas ao Discogs.
  assert.ok(!chamadas.some((u) => u.includes("jazz")));
});

test("lojas Shopify e WooCommerce viram ofertas com preço em reais", async () => {
  simularFetch([
    ["loja-a.com/search/suggest.json", { resources: { results: { products: [{ id: 1, title: "Milton Nascimento – Clube da Esquina (LP)", price: "189.90", url: "/products/clube?_pos=1", image: "//cdn.shopify.com/c.jpg" }] } } }],
    ["loja-b.com/wp-json/wc/store/v1/products", [{ id: 7, name: "Clube da Esquina - Milton Nascimento", permalink: "https://loja-b.com/p/7", is_in_stock: true, prices: { price: "21990", currency_code: "BRL", currency_minor_unit: 2 }, images: [] }]],
  ]);
  const c = await coletarLojas(
    [
      { nome: "Loja A", url: "https://loja-a.com/", plataforma: "shopify" },
      { nome: "Loja B", url: "https://loja-b.com", plataforma: "woocommerce" },
    ],
    [buscaDesejo],
    [],
  );
  assert.deepEqual(c.erros, []);
  const porLoja = Object.fromEntries(c.ofertas.map((o) => [o.fonte, o]));
  assert.equal(porLoja["Loja A"].preco, 189.9);
  assert.equal(porLoja["Loja A"].url, "https://loja-a.com/products/clube?_pos=1");
  assert.equal(porLoja["Loja A"].imagem, "https://cdn.shopify.com/c.jpg");
  assert.equal(porLoja["Loja B"].preco, 219.9);
});

test("critérios: teto, referência Discogs e mais barato entre fontes", () => {
  const base = { titulo: "x", url: "https://x", busca: "b" };
  const brutas: OfertaBruta[] = [
    { ...base, id: "ml:1", fonte: "Mercado Livre", preco: 150, desejo: desejo.chave },
    { ...base, id: "discogs:1", fonte: "Discogs", preco: 260, desejo: desejo.chave },
    { ...base, id: "ml:2", fonte: "Mercado Livre", preco: 70 },
    { ...base, id: "ml:3", fonte: "Mercado Livre", preco: 90, desejo: "sozinho" },
  ];
  const tetos = new Map([[desejo.chave, 200], ["sozinho", 200]]);
  const [barato, caro, varredura, sozinho] = avaliar(brutas, config, tetos, new Map([[desejo.chave, 280]]), new Map(), 5);
  assert.deepEqual(barato.criterios, { teto: true, discogs: true, maisBarato: true });
  assert.deepEqual(caro.criterios, { teto: false, discogs: false, maisBarato: false });
  // Varredura usa o teto próprio (80) e não tem referência nem comparação.
  assert.deepEqual(varredura.criterios, { teto: true, discogs: null, maisBarato: null });
  assert.equal(varredura.teto, 80);
  // Uma única fonte não basta para dizer que é "o mais barato".
  assert.equal(sozinho.criterios.maisBarato, null);

  assert.ok(deveAlertar(barato, config));
  assert.ok(!deveAlertar(caro, config));
  assert.ok(!deveAlertar(varredura, config), "varredura só alerta se habilitado");
  assert.ok(deveAlertar(varredura, { ...config, varredura: { ...config.varredura, alertar: true } }));
});

test("mensagem de alerta lista as mais baratas primeiro e resume o excedente", () => {
  const ofertas = avaliar(
    Array.from({ length: 12 }, (_, i) => ({ id: `ml:${i}`, fonte: "Mercado Livre", titulo: `Disco ${i}`, preco: 200 - i, url: `https://ml/${i}`, busca: "b", desejo: "d" })),
    config,
    new Map([["d", 250]]),
    new Map(),
    new Map(),
    5,
  );
  const { titulo, linhas } = montarMensagem(ofertas, "https://pagina");
  assert.equal(titulo, "12 ofertas novas de vinil");
  assert.match(linhas[0], /Disco 11 — R\$\s?189,00/);
  assert.match(linhas.at(-1)!, /mais 2/);
});

test("importação: Remessa Conforme isento até US$ 50, 60% com dedução acima; fora do programa, 60% + despacho", () => {
  const regras = { icms: 0.2, despachoPostal: 15 };
  // R$ 200 + R$ 40 de frete = US$ 48 com dólar a R$ 5: isento; ICMS por dentro = 240 / 0,8 × 0,2.
  assert.deepEqual(calcularImportacao(200, 40, true, 5, regras), { frete: 40, impostoImportacao: 0, icms: 60, despacho: 0 });
  // R$ 360 + 40 = US$ 80: 60% de 400 = 240, menos US$ 30 (R$ 150) = 90; ICMS = 490 / 0,8 × 0,2 = 122,50.
  assert.deepEqual(calcularImportacao(360, 40, true, 5, regras), { frete: 40, impostoImportacao: 90, icms: 122.5, despacho: 0 });
  // Fora do programa: 60% de 160 = 96; ICMS = 256 / 0,8 × 0,2 = 64; despacho R$ 15.
  const c = calcularImportacao(100, 60, false, 5, regras);
  assert.deepEqual(c, { frete: 60, impostoImportacao: 96, icms: 64, despacho: 15 });
  assert.equal(total(100, c), 335);
});

test("teto vale para o preço total: importado barato pode ficar acima do teto", () => {
  const base = { titulo: "x", url: "https://x", busca: "b", desejo: desejo.chave };
  const [nacional, importado] = avaliar(
    [
      { ...base, id: "loja:1", fonte: "Loja BR", preco: 190 },
      { ...base, id: "imusic:1", fonte: "iMusic", preco: 100 },
    ],
    config,
    new Map([[desejo.chave, 200]]),
    new Map([[desejo.chave, 300]]),
    new Map([["iMusic", { freteBRL: 60, remessaConforme: false }]]),
    5,
  );
  assert.equal(nacional.precoTotal, 190);
  assert.equal(nacional.custos, undefined);
  assert.equal(importado.precoTotal, 335);
  assert.equal(importado.criterios.teto, false);
  // Mais barato compara totais; Discogs compara o preço do disco com a referência.
  assert.equal(nacional.criterios.maisBarato, true);
  assert.equal(importado.criterios.maisBarato, false);
  assert.equal(importado.criterios.discogs, true);
  assert.ok(deveAlertar(nacional, config));
  assert.ok(!deveAlertar(importado, config), "acima do teto não alerta, mesmo abaixo do Discogs");
});
