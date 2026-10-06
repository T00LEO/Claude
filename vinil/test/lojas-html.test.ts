// Trechos reais das páginas de busca de cada loja (outubro de 2026), encurtados.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decodificar, lerIluria, lerImusic, lerLojaIntegrada, lerNuvemshop, precoBr } from "../src/fontes/html.ts";

test("decodificar e precoBr", () => {
  assert.equal(decodificar("CD V&Aacute;RIOS - A&amp;B &#039;x&#039; &ccedil;"), "CD VÁRIOS - A&B 'x' ç");
  assert.equal(precoBr("1.234,56"), 1234.56);
  assert.equal(precoBr(" 35,00 "), 35);
});

test("Loja Integrada (Baratos Afins)", () => {
  const html = `<ul><li class="span3"> <div class="listagem-item prod-id-401034424 prod-cat-17318441 prod-cat-17318508" data-id="401034424"> <a href="https://www.baratosafins.com.br/nirvana-nevermind-lp" class="produto-sobrepor" title="NIRVANA - NEVERMIND - LP"></a> <div class="imagem-produto has-zoom"> <img src="https://cdn.awsli.com.br/300x300/2279/2279925/produto/401034424/2bf.jpg" alt="NIRVANA - NEVERMIND - LP" class="imagem-principal" /> </div> <div class="info-produto"> <a href="https://www.baratosafins.com.br/nirvana-nevermind-lp" class="nome-produto cor-secundaria">NIRVANA - NEVERMIND - LP</a> <div class="produto-sku hide">0785214</div> <div> <div class="preco-produto destaque-preco "> <div> <strong class="preco-promocional cor-principal titulo" data-sell-price="249.90"> R$ 249,90 </strong> </div></div></div></div></div></li>
  <li class="span3"> <div class="listagem-item prod-id-1" data-id="1"> <div class="info-produto"> <a href="https://www.baratosafins.com.br/esgotado" class="nome-produto cor-secundaria">ESGOTADO - LP</a> <div class="bandeiras-produto"><span>Indisponível</span></div></div></div></li></ul>`;
  assert.deepEqual(lerLojaIntegrada(html, "https://www.baratosafins.com.br"), [
    {
      idLoja: "401034424",
      titulo: "NIRVANA - NEVERMIND - LP",
      preco: 249.9,
      url: "https://www.baratosafins.com.br/nirvana-nevermind-lp",
      imagem: "https://cdn.awsli.com.br/300x300/2279/2279925/produto/401034424/2bf.jpg",
    },
  ]);
});

test("Nuvemshop (Patuá Discos)", () => {
  const variantes = (disponivel: boolean) =>
    `[{&quot;product_id&quot;:358378345,&quot;price_short&quot;:&quot;R$75,00&quot;,&quot;price_number&quot;:75,&quot;sku&quot;:&quot;&#039;13839&quot;,&quot;available&quot;:${disponivel},&quot;image_url&quot;:&quot;\\/\\/acdn-us.mitiendanube.com\\/stores\\/006\\/products\\/13839-1024-1024.webp&quot;,&quot;installments_data&quot;:&quot;{\\&quot;Nuvem Pago\\&quot;:{}}&quot;}]`;
  const card = (id: string, disponivel: boolean) => `<div class="js-product-item-private product-item js-product-container js-item-product " data-product-type="list" data-product-id="${id}" data-store="product-item-${id}" data-variants="${variantes(disponivel)}" data-quickshop-id="quick${id}"> <div style="padding-bottom: 100%;" class=""> <a href="https://patuadiscos.com.br/produtos/pedrinho-mattar-um-show-de-pedrinho-mattar-lp/" title="Pedrinho Mattar - Um Show De Pedrinho Mattar - LP" aria-label="x" class="js-product-item-image-link-private "> <img alt="x" src="//acdn-us.mitiendanube.com/x.webp" /> </a></div> <span class="js-price-display product-item-price"> R$75,00 </span> </div>`;
  const produtos = lerNuvemshop(card("358378345", true) + card("999", false), "https://www.patuadiscos.com.br");
  assert.deepEqual(produtos, [
    {
      idLoja: "358378345",
      titulo: "Pedrinho Mattar - Um Show De Pedrinho Mattar - LP",
      preco: 75,
      url: "https://patuadiscos.com.br/produtos/pedrinho-mattar-um-show-de-pedrinho-mattar-lp/",
      imagem: "https://acdn-us.mitiendanube.com/stores/006/products/13839-1024-1024.webp",
    },
  ]);
});

test("Iluria (Locomotiva Discos)", () => {
  const html = `<div id="product-list-container"> <div class="product-item-container"> <div class="product-item-container-inner"> <a href="pd-98819b-lp-varios-smells-like-bleach-a-punk-tribute-to-nirvana-nov-lac.html?ct=&p=1&s=1"> <div class="product-thumb-container"> <div class="product-thumb-image-container"> <script> (new Image()).src = "//s3.amazonaws.com/img.iluria.com/product/98819B/18C03C2/330xN.jpg"; </script> <div title="LP V&Aacute;RIOS" class="iluria-product-thumb" data-image-loaded="false"> <img src="//s3.amazonaws.com/img.iluria.com/product/98819B/18C03C1/330xN.jpg" border=0 alt="x" /> </div> </div> </div> </a> <div class="product-thumb-caption-container"> <div class="iluria-layout-search-product-title"> <a href="pd-98819b-lp-varios-smells-like-bleach-a-punk-tribute-to-nirvana-nov-lac.html?ct=&p=1&s=1"> LP VÁRIOS - SMELLS LIKE BLEACH: A PUNK TRIBUTE TO NIRVANA (NOV/LAC) </a> </div> <div class="product-thumb-price-container"> <div class="product-thumb-original-price"> </div> <div class="product-thumb-price"> <span class="product-price-currency">R$ </span><span class="product-price-text">1.135,00</span> </div> </div> </div> </div> </div></div>`;
  assert.deepEqual(lerIluria(html, "https://www.locomotivadiscos.com.br"), [
    {
      idLoja: "98819b",
      titulo: "LP VÁRIOS - SMELLS LIKE BLEACH: A PUNK TRIBUTE TO NIRVANA (NOV/LAC)",
      preco: 1135,
      url: "https://www.locomotivadiscos.com.br/pd-98819b-lp-varios-smells-like-bleach-a-punk-tribute-to-nirvana-nov-lac.html",
      imagem: "https://s3.amazonaws.com/img.iluria.com/product/98819B/18C03C1/330xN.jpg",
    },
  ]);
});

test("iMusic", () => {
  const card = (moeda: string) => `<div class="col-md-6"> <div class="media search-teaser"> <div class="media-left"> <a href="/vinyl/0602547378767/nirvana-1991-nevermind-lp" title="Nevermind (LP) [Limited edition] (2015)"> <img src="https://imusic.b-cdn.net/images/item/original/767/0602547378767.jpg?nirvana&amp;class=scaled" loading="lazy" class="item-cover media-object" alt="x"> </a> </div> <div class="media-body"> <a href="/vinyl/0602547378767/nirvana-1991-nevermind-lp" title="Nevermind (LP) [Limited edition] (2015)"> <h4 class="media-heading"> Nevermind <span class="text-muted"> (2015) </span> </h4> </a> <div class="buy-button mt-1"> <form method="post" action="/page/cart" data-ajax> <div class="btn-group btn-group-sm" role="group"> <button type="submit" class="btn btn-sm condensed btn-success price"> ${moeda} 200,90 </button> </div> </form> </div> </div> </div> </div>`;
  const produtos = lerImusic(card("R$") + card("€"), "https://imusic.br.com");
  assert.equal(produtos.length, 1, "preço em outra moeda é descartado");
  assert.deepEqual(produtos[0], {
    idLoja: "0602547378767",
    titulo: "Nevermind (LP) [Limited edition] (2015)",
    preco: 200.9,
    url: "https://imusic.br.com/vinyl/0602547378767/nirvana-1991-nevermind-lp",
    imagem: "https://imusic.b-cdn.net/images/item/original/767/0602547378767.jpg?nirvana&class=scaled",
    extra: "nirvana 1991 nevermind lp",
  });
});
