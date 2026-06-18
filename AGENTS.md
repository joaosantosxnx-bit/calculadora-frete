# REGRAS DE NEGÓCIO - CALCULADORA DE FRETE GEOFIN

## IMPORTANTE

Antes de alterar qualquer arquivo:

1. Explicar o problema encontrado.
2. Explicar quais arquivos serão alterados.
3. Explicar a solução proposta.

Não executar comandos destrutivos.

---

## ESTADOS DISPONÍVEIS

Estados atualmente utilizados no sistema:

* ES
* SP Cap.
* SP Int.
* MG
* RJ
* BA

Não adicionar novos estados sem autorização.

---

## SAGIX

A SAGIX atende somente:

* ES
* SP Cap.

A SAGIX NÃO atende:

* SP Int.
* MG
* RJ
* BA

### Fórmula

freteBase = valorNota × 5%

ICMS:

* ES = 7%
* SP Cap. = 12%

valorFinal = freteBase + ICMS

### Regra de Valor Mínimo

Valor mínimo operacional aceito:

R$ 1.250,00

IMPORTANTE:

Se o valor calculado for menor que R$ 1.250,00:

NÃO ajustar para R$ 1.250,00.

NÃO exibir cotação da SAGIX.

Exibir mensagem:

"SAGIX não atende esta operação, pois o valor calculado ficou abaixo do valor mínimo operacional aceito de R$ 1.250,00."

---

## TJB

A TJB atende:

* ES
* SP Cap.
* SP Int.
* MG
* RJ
* BA

IMPORTANTE:

Não utilizar:

* média histórica
* R$/kg histórico
* valores médios da planilha
* cotações históricas

O erro anterior gerou valor de R$ 44.598,19 utilizando R$/kg histórico.

Isso está incorreto.

A TJB deve utilizar exclusivamente a lógica oficial implementada no backend.

Não substituir a regra da TJB por médias ou cálculos históricos.

---

## LAYOUT

Não alterar:

* layout atual
* responsividade atual
* identidade visual atual

Não criar:

* campo cidade
* seção "Atualizações Recentes"
* novas abas
* novos componentes visuais

---

## COMANDOS PERMITIDOS

* npm start
* git status
* git add .
* git commit
* git push

Executar somente quando autorizado.
