# Caça Vinil

Varre sites de venda de discos de vinil atrás de bons preços, publica as ofertas numa página web e manda alerta no celular quando aparece algo bom.

- **Página:** https://t00leo.github.io/Claude/vinil/
- **Quando roda:** sozinho a cada 6 horas (GitHub Actions), ou na hora em *Actions → Varredura de vinil → Run workflow*.

## O que é "bom preço"

Cada oferta é avaliada pelos três critérios; na página você escolhe qual quer ver:

| Critério | Quando a oferta passa |
| --- | --- |
| **Abaixo do teto** | preço ≤ teto (R$ 200 por padrão, ou o teto próprio do disco). Na página dá para testar outro teto na hora. |
| **Abaixo do Discogs** | preço ≤ 90% do preço sugerido pelo Discogs para um exemplar VG+ (mediana das prensagens mais relevantes). |
| **Mais barato entre lojas** | é a oferta mais barata daquele disco entre todas as fontes (só vale quando ao menos duas fontes têm o disco). |

Os dois últimos só se aplicam à lista de desejos: na varredura geral não dá para saber com certeza qual é o disco do anúncio.

## Fontes

| Fonte | Situação |
| --- | --- |
| **Discogs** | API oficial. Só funciona para a lista de desejos, porque a API não permite buscar anúncios por gênero. Mostra o menor preço anunciado de cada prensagem, convertido para reais, **sem frete** (a maioria dos vendedores está no exterior, então ainda tem imposto de importação). |
| **Mercado Livre** | API oficial. Lista de desejos e varredura geral. Exige credenciais de aplicativo (veja abaixo). |
| **Lojas de discos** | Lojas feitas em **Shopify**, **WooCommerce** ou **VTEX** são lidas pela busca em JSON da própria plataforma, sem depender do layout do site. Lojas em outras plataformas precisam de um coletor próprio. |
| **Amazon** | Ainda não. A Amazon não tem API aberta para isso (a oficial exige conta de afiliado com vendas) e bloqueia leitura automática do site. |

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
    // { "nome": "Loja X", "url": "https://lojax.com.br", "plataforma": "shopify", "soVinil": true }
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
