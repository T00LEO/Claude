# Contagem de Bebidas

App simples para conferência de estoque de bebidas, feito para ser usado no celular durante a contagem física (depósito, bar, prateleira etc).

## Funcionalidades

- **Cadastro em massa de produtos**: importe uma planilha (.xlsx, .xls ou .csv) e mapeie as colunas para Código, Nome, Categoria e Unidade. Reimportar a mesma planilha atualiza os produtos existentes (por código ou nome) em vez de duplicar.
- **Cadastro manual**: adicionar, editar e excluir produtos individualmente.
- **Teclado numérico dedicado**: entrada de quantidade sempre com 2 casas decimais (estilo calculadora/PDV), com atalhos rápidos +1/+6/+12/+24 para fardos e caixas.
- **Locais de contagem**: crie quantos locais quiser (Estoque, Bar, Prateleira, Câmara fria...). Um mesmo produto pode ser contado em vários locais, e um novo lançamento **soma** ao que já foi contado naquele local — nunca sobrescreve.
- **Histórico com desfazer**: todo lançamento fica registrado com data/hora; é possível remover um lançamento específico se algo for digitado errado, sem perder o restante da contagem.
- **Relatório**: tabela com o total por local e total geral de cada produto, exportável em Excel ou CSV, pronta para comparar com o estoque esperado.
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
- Comparação entre contagens de datas diferentes para identificar perdas/quebras.
