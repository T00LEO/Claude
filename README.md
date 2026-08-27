# Contagem de Bebidas

App simples para conferência de estoque de bebidas, feito para ser usado no celular durante a contagem física (depósito, bar, prateleira etc).

## Funcionalidades

- **Cadastro em massa de produtos**: importe uma planilha (.xlsx, .xls ou .csv) e mapeie as colunas para Código, Nome, Categoria e Unidade. Reimportar a mesma planilha atualiza os produtos existentes (por código ou nome) em vez de duplicar.
- **Cadastro manual**: adicionar, editar e excluir produtos individualmente.
- **Teclado numérico com calculadora**: entrada de quantidade em formato livre (decimais só aparecem quando você digita a vírgula — a maioria das contagens é número inteiro). Tem os quatro operadores (+, −, ×, ÷) para multiplicar fardos/caixas na hora (ex: 12 fardos de 24 → `12×24=` → 288), além dos atalhos rápidos +1/+6/+12/+24.
- **Locais de contagem**: crie quantos locais quiser (Estoque, Bar, Prateleira, Câmara fria...). Um mesmo produto pode ser contado em vários locais, e um novo lançamento **soma** ao que já foi contado naquele local — nunca sobrescreve.
- **Sessões de contagem**: "Iniciar nova contagem" (na aba Relatório) não apaga nada — arquiva a contagem atual e começa uma nova do zero. O cadastro de produtos é sempre o mesmo, só os lançamentos ficam separados por sessão.
- **Histórico permanente**: aba dedicada com todos os lançamentos já feitos, agrupados por sessão de contagem, com busca por produto/código — dá pra ver o que foi contado em qualquer data. Na tela de Contagem também dá pra ver e desfazer os lançamentos da sessão em andamento.
- **Relatório**: tabela com o total por local e total geral de cada produto, com um seletor para ver o relatório da contagem atual ou de qualquer sessão anterior — útil para comparar contagens de datas diferentes. Exportável em Excel ou CSV.
- **Funciona offline**: os dados ficam salvos no próprio dispositivo (IndexedDB) e o app pode ser instalado na tela inicial (PWA), útil em depósitos com sinal de wifi ruim.
- **Backup para levar entre aparelhos**: como os dados ficam salvos no dispositivo (sem nuvem), a aba Histórico tem botões para exportar tudo (produtos, locais, sessões e lançamentos) num arquivo `.json` e importar esse arquivo em outro aparelho. A importação **soma** ao que já existe — casa produtos por código/nome e locais por nome, não duplica nada mesmo importando o mesmo arquivo várias vezes. É o jeito de, por exemplo, cadastrar os produtos no computador e levar pro celular, ou juntar contagens feitas por pessoas diferentes em dias diferentes.

## Acessando pelo celular sem depender do computador

O app está publicado (grátis) em: **https://t00leo.github.io/Claude/**

Esse endereço funciona sozinho, de qualquer wifi ou dados móveis, sem precisar do computador ligado — é só abrir no navegador do celular e, se quiser, "Adicionar à tela inicial" para usar como um app instalado. Toda vez que uma mudança é enviada para a branch `claude/beverage-inventory-app-d7z84o`, esse endereço é atualizado automaticamente (leva 1-2 minutos).

Isso publica só o aplicativo em si — os dados continuam salvos separadamente em cada aparelho (veja "Backup para levar entre aparelhos" acima).

## Rodando localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

## Ideias para evoluir (não implementadas)

- Leitura de código de barras pela câmera para localizar o produto na hora.
- Sincronização em nuvem em tempo real (hoje a "sincronização" é manual, via exportar/importar o arquivo de backup) — próximo passo natural se surgir a necessidade de contar ao mesmo tempo em vários aparelhos.
- Estoque mínimo/ideal por produto, gerando automaticamente uma lista de compras a partir da contagem.
- Comparação lado a lado entre duas sessões de contagem para identificar perdas/quebras automaticamente (hoje dá pra ver cada sessão separadamente e comparar manualmente).
