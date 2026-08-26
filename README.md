# Contagem de Bebidas

App simples para conferência de estoque de bebidas, feito para ser usado no celular durante a contagem física (depósito, bar, prateleira etc).

## Funcionalidades

- **Cadastro em massa de produtos**: importe uma planilha (.xlsx, .xls ou .csv) e mapeie as colunas para Código, Nome, Categoria e Unidade. Reimportar a mesma planilha atualiza os produtos existentes (por código ou nome) em vez de duplicar.
- **Cadastro manual**: adicionar, editar e excluir produtos individualmente.
- **Teclado numérico dedicado**: entrada de quantidade sempre com 2 casas decimais (estilo calculadora/PDV), com atalhos rápidos +1/+6/+12/+24 para fardos e caixas.
- **Locais de contagem**: crie quantos locais quiser (Estoque, Bar, Prateleira, Câmara fria...). Um mesmo produto pode ser contado em vários locais, e um novo lançamento **soma** ao que já foi contado naquele local — nunca sobrescreve.
- **Sessões de contagem**: "Iniciar nova contagem" (na aba Relatório) não apaga nada — arquiva a contagem atual e começa uma nova do zero. O cadastro de produtos é sempre o mesmo, só os lançamentos ficam separados por sessão.
- **Histórico permanente**: aba dedicada com todos os lançamentos já feitos, agrupados por sessão de contagem, com busca por produto/código — dá pra ver o que foi contado em qualquer data. Na tela de Contagem também dá pra ver e desfazer os lançamentos da sessão em andamento.
- **Relatório**: tabela com o total por local e total geral de cada produto, com um seletor para ver o relatório da contagem atual ou de qualquer sessão anterior — útil para comparar contagens de datas diferentes. Exportável em Excel ou CSV.
- **Funciona offline**: os dados ficam salvos no próprio dispositivo (IndexedDB) e o app pode ser instalado na tela inicial (PWA), útil em depósitos com sinal de wifi ruim.

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
- Sincronização em nuvem para várias pessoas contarem ao mesmo tempo em dispositivos diferentes.
- Estoque mínimo/ideal por produto, gerando automaticamente uma lista de compras a partir da contagem.
- Comparação lado a lado entre duas sessões de contagem para identificar perdas/quebras automaticamente (hoje dá pra ver cada sessão separadamente e comparar manualmente).
