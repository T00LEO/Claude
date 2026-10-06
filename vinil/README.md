# Caça Vinil

Varre sites de venda de discos de vinil atrás de bons preços, publica as ofertas numa página web e manda alerta no celular quando aparece algo bom.

- **Página:** https://t00leo.github.io/Claude/vinil/
- **Quando roda:** sozinho a cada 6 horas (GitHub Actions), ou na hora em *Actions → Varredura de vinil → Run workflow*.

## O que é "bom preço"

Cada oferta é avaliada pelos três critérios; na página você escolhe qual quer ver:

| Critério | Quando a oferta passa |
| --- | --- |
| **Abaixo do teto** | **preço total** ≤ teto (R$ 200 por padrão, ou o teto próprio do disco). É obrigatório: na página e nos alertas só aparece o que cabe no teto. Na página dá para testar outro teto na hora. |
| **Abaixo do Discogs** | preço ≤ 90% do preço sugerido pelo Discogs para um exemplar VG+ (mediana das prensagens mais relevantes). |
| **Mais barato entre lojas** | é a oferta mais barata daquele disco entre todas as fontes (só vale quando ao menos duas fontes têm o disco). |

Os dois últimos só se aplicam à lista de desejos: na varredura geral não dá para saber com certeza qual é o disco do anúncio.

## Fontes

| Fonte | Situação |
| --- | --- |
| **Discogs** | API oficial. Só funciona para a lista de desejos, porque a API não permite buscar anúncios por gênero. Mostra o menor preço anunciado de cada prensagem, convertido para reais, **sem frete** (a maioria dos vendedores está no exterior, então ainda tem imposto de importação). |
| **Mercado Livre** | **Desligado** (`"mercadoLivre": false`). Desde 2025 o Mercado Livre recusa a busca pela API (erro 403) mesmo com credenciais válidas. O coletor continua pronto caso a API volte a ser liberada. |
| **Baratos Afins**, **Locomotiva Discos**, **Patuá Discos** | Leitura da página de busca de cada loja (plataformas Loja Integrada, Iluria e Nuvemshop). Se a loja mudar o visual do site, o coletor pode parar de achar produtos. |
| **iMusic** (imusic.br.com) | Leitura da busca de vinil. Preço em reais, mas a loja fica no exterior e ainda não está no Remessa Conforme: frete e imposto de importação à parte. |
| **Outras lojas** | Lojas em **Shopify**, **WooCommerce**, **VTEX**, **Loja Integrada**, **Nuvemshop** ou **Iluria** entram só com uma linha em `config.json`. Para descobrir a plataforma de uma loja, rode *Actions → Diagnóstico de lojas de vinil* com o endereço dela. |
| **Amazon** | Ainda não. A Amazon não tem API aberta para isso (a oficial exige conta de afiliado com vendas) e bloqueia leitura automática do site. |

## Preço total de discos importados

Para Discogs e iMusic o preço total soma ao preço do disco:

- **Frete estimado:** US$ 20 por disco no Discogs (varia muito conforme o vendedor) e R$ 66,90 na iMusic (valor do carrinho para 1 disco, outubro de 2026). Ajuste em `config.json` se mudar.
- **Imposto de importação** (regras desde 12/05/2026, MP 1.357/2026 → Lei 15.502): fora do Remessa Conforme, 60% sobre disco + frete; no Remessa Conforme, zero até US$ 50 e 60% menos US$ 30 acima disso.
- **ICMS** de 20% (17% em alguns estados), calculado "por dentro".
- **Taxa de despacho dos Correios** (R$ 15) para remessas fora do Remessa Conforme.

O Discogs não informa de onde é o vendedor do anúncio mais barato, então o cálculo supõe sempre um vendedor no exterior. Lojas brasileiras entram pelo preço do produto, sem frete.

Quando a iMusic entrar no Remessa Conforme, troque `"remessaConforme": false` por `true` na configuração dela.

## Configuração (`vinil/config.json`)

```jsonc
{
  "criterios": {
    "teto": 200,                          // teto padrão em R$
    "fatorDiscogs": 0.9,                  // "abaixo do Discogs" = até 90% do preço sugerido
    "alertarQuando": ["teto", "discogs"]  // quais critérios disparam alerta: teto, discogs, maisBarato
  },
  "fontes": {
    "discogs": true,
    "mercadoLivre": true,
    "discogsWantlist": ""                 // seu usuário do Discogs: a wantlist entra na lista de desejos
  },
  "lojas": [
    // plataforma: shopify, woocommerce, vtex, lojaintegrada, nuvemshop, iluria ou imusic
    { "nome": "Patuá Discos", "url": "https://www.patuadiscos.com.br", "plataforma": "nuvemshop" },
    { "nome": "iMusic", "url": "https://imusic.br.com", "plataforma": "imusic", "soVinil": true,
      "observacao": "Loja no exterior",                           // aviso exibido em cada oferta
      "importacao": { "freteBRL": 66.9, "remessaConforme": false } } // loja no exterior: soma frete e impostos
  ],
  "listaDeDesejos": [
    { "artista": "Miles Davis", "titulo": "Kind of Blue", "teto": 150 },   // teto próprio (opcional)
    { "artista": "Milton Nascimento", "titulo": "Clube da Esquina", "discogsId": 1234567 } // prensagem exata (opcional)
  ],
  "varredura": {
    "generos": ["jazz", "mpb"],           // cada um vira uma busca "vinil <gênero>"
    "termos": [],                         // buscas livres, ex.: "blue note", "selo elenco"
    "teto": 80,                           // teto da varredura geral
    "alertar": false                      // alertar também ofertas da varredura geral?
  },
  "importacao": {
    "icms": 0.2,                          // ICMS do seu estado sobre compras internacionais (0.17 ou 0.2)
    "despachoPostal": 15,                 // taxa dos Correios fora do Remessa Conforme
    "freteDiscogsUSD": 20                 // frete estimado de um vendedor do Discogs no exterior
  },
  "excluir": ["cd", "vitrola", "poster"]  // anúncios com essas palavras são descartados
}
```

- **Lista de desejos pelo Discogs:** em vez de editar o arquivo, você pode manter a wantlist no app do Discogs e colocar seu usuário em `discogsWantlist`.
- **`soVinil`:** use em lojas que só vendem vinil, para não descartar produtos cujo nome não diz "vinil" ou "LP".
- **Alertas:** cada oferta é alertada uma vez e alertada de novo só se o preço cair.

## Primeira configuração (segredos)

Em *GitHub → repositório → Settings → Secrets and variables → Actions → New repository secret*:

| Segredo | Para quê | Como obter |
| --- | --- | --- |
| `DISCOGS_TOKEN` | Discogs | discogs.com → Configurações → Desenvolvedores → *Generate new token*. Para ter o preço de referência, preencha também as **configurações de vendedor** da conta (de preferência com moeda BRL); sem isso o Discogs não devolve preços sugeridos. |
| `ML_CLIENT_ID` e `ML_CLIENT_SECRET` | Mercado Livre | developers.mercadolivre.com.br → criar aplicativo → copiar *Client ID* e *Client Secret*. |
| `NTFY_TOPIC` | Alerta no celular | Instale o app **ntfy** (Android/iOS) e assine um tópico com nome difícil de adivinhar, como `cacavinil-8f3k2q`. Coloque o mesmo nome aqui; quem souber o nome consegue ler os alertas. |
| `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` | Alerta pelo Telegram (opcional, alternativa ao ntfy) | Crie um bot com o @BotFather e pegue o ID da conversa com ele. |

Fontes sem segredo configurado são puladas, e o motivo aparece em "avisos da última varredura" no fim da página.

> O repositório é público: a página de ofertas e o `config.json` (lista de desejos) ficam visíveis para qualquer pessoa. Os segredos acima não ficam.

## Desenvolvimento

Não tem dependências: roda direto no Node 22.18 ou mais novo.

```bash
node vinil/src/varrer.ts              # roda uma varredura (lê os segredos de variáveis de ambiente)
node --test vinil/test/*.test.ts      # testes
npx tsc -p vinil/tsconfig.json        # checagem de tipos
```

Cada varredura grava `vinil/site/ofertas.json` (lido pela página) e `vinil/estado/vistos.json` (ofertas já alertadas) e faz commit deles. Por isso, antes de mexer no código, faça `git pull`.
