# Calculadora de Frete GEOFIN

## Fonte de regras de frete

A planilha original de fretes NÃO estará disponível para análise no Codex.

A base resumida da planilha deve ficar em:

data/freteRules.js

O Codex deve usar esse arquivo como fonte principal para regras de transportadoras, estados e cálculo.

## Regras de comportamento

- Leia este AGENTS.md antes de qualquer alteração.
- Pode executar comandos no terminal quando necessário.
- Pode alterar arquivos somente quando o usuário autorizar claramente.
- Antes de alterar server.js, explique quais mudanças serão feitas.
- Não invente novas fórmulas.
- Não altere layout sem autorização.
- Não crie campos de cidade.
- Não crie seções extras como "Atualizações recentes".
- Não mexa em node_modules.

## Estrutura do projeto

- server.js: API Node.js/Express.
- public/index.html: tela principal.
- public/style.css: visual responsivo.
- public/script.js: integração frontend com backend.
- data/freteRules.js: base de regras de frete.
- cotacoes.json: histórico beta local.

## Regras fixas

Origem sempre:
- Serra - ES

Destinos permitidos:
- SP_INTERIOR
- MG
- RJ
- BA

Não usar campo de cidade.

## Regra SAGIX

- 5% sobre valor da nota.
- ICMS ES = 7%.
- ICMS SP = 12%.
- Frete mínimo = R$ 1.250,00.
- SAGIX só deve ser usada em destinos onde estiver listada em data/freteRules.js.

## Regra tipo base

Para regras do tipo "base":

- valorPorKg = peso * rkg
- valorPorNota = valorNota * percentualNota
- valorFinal = maior entre valorPorKg, valorPorNota e minimo

Sempre usar o maior valor para evitar cotação abaixo.

## Melhor opção

- Calcular todas as transportadoras disponíveis para o destino.
- Mostrar todas no resultado.
- Escolher como melhor opção a transportadora com menor valor final.

## Processo esperado

Quando o usuário pedir para implementar:

1. Criar ou ajustar data/freteRules.js.
2. Ajustar server.js para ler data/freteRules.js.
3. Ajustar public/index.html para incluir os destinos.
4. Ajustar public/script.js para renderizar todas as transportadoras retornadas pela API.
5. Preservar o layout atual.
6. Testar com npm start.
7. Se funcionar, orientar git add, commit e push.

## Comandos permitidos

Pode executar:

npm start
git status
git add .
git commit -m "mensagem"
git push

Não executar comandos destrutivos sem autorização.
