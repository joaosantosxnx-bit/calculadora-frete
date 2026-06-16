# Projeto: Calculadora de Frete GEOFIN

Sistema web em Node.js + Express para simulação de frete interno.

## Contexto
- Origem sempre fixa: Serra - ES.
- Destinos permitidos: Espírito Santo e São Paulo.
- Projeto publicado no Render.
- Frontend fica na pasta public.
- Backend fica no server.js.
- Histórico atual fica em cotacoes.json.
- É uma versão beta, então manter o selo "VERSÃO BETA".

## Regras de cálculo
### SAGIX
- Frete base = 5% do valor da nota fiscal.
- ICMS ES = 7%.
- ICMS SP = 12%.
- Valor SAGIX = frete base + ICMS.
- Frete mínimo SAGIX = R$ 1.250,00.

### TJB
- Fórmula atual provisória:
  - taxa fixa: 75.04
  - valor por kg: 0.69678
  - percentual nota: 1%
  - descarga: 400
- Não mostrar descarga separada na tela.

## Regras visuais
- Visual precisa parecer sistema corporativo.
- Evitar aparência amadora.
- Layout precisa funcionar bem no celular.
- Usar as logos em public/assets.
- Não usar caminhão no título.
- Manter interface limpa e profissional.
- Preferir verde, branco e tons escuros.
- Não deixar campos de cidade. Usar somente UF destino.

## Estrutura
- public/index.html: tela principal.
- public/style.css: visual.
- public/script.js: comunicação com API.
- server.js: API Node.js.
- cotacoes.json: histórico local.

## Como rodar
npm start

Abrir:
http://localhost:3000

## Deploy
- GitHub: calculadora-frete.
- Hospedagem: Render.
- Para atualizar online:
git add .
git commit -m "mensagem"
git push

## Cuidado
- Não subir node_modules.
- Não apagar cotacoes.json sem deixar [].
- Não mudar regra de negócio sem avisar.