const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const HISTORICO_PATH = path.join(__dirname, "cotacoes.json");

const ORIGEM_FIXA = "Serra - ES";
const DESTINOS_PERMITIDOS = ["ES", "SP"];

// SAGIX
const SAGIX_PERCENTUAL_NOTA = 0.05;
const SAGIX_FRETE_MINIMO = 1250;
const ICMS_POR_UF = {
  ES: 0.07,
  SP: 0.12
};

// TJB provisório
const TJB_TAXA_FIXA = 75.04;
const TJB_VALOR_KG = 0.69678;
const TJB_PERCENTUAL_NOTA = 0.01;
const TJB_DESCARGA = 400;

function arredondarMoeda(valor) {
  return Number(valor.toFixed(2));
}

function lerHistorico() {
  if (!fs.existsSync(HISTORICO_PATH)) {
    fs.writeFileSync(HISTORICO_PATH, "[]");
  }

  try {
    const conteudo = fs.readFileSync(HISTORICO_PATH, "utf8");
    const historico = JSON.parse(conteudo);
    return Array.isArray(historico) ? historico : [];
  } catch (erro) {
    return [];
  }
}

function salvarHistorico(cotacao) {
  const historico = lerHistorico();
  const historicoLimitado = [cotacao, ...historico].slice(0, 20);

  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(historicoLimitado, null, 2));
}

function numeroValido(valor) {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

app.post("/calcular", (req, res) => {
  const { destino, valorNota, peso } = req.body;

  if (
    typeof destino !== "string" ||
    !DESTINOS_PERMITIDOS.includes(destino) ||
    !numeroValido(valorNota) ||
    !numeroValido(peso)
  ) {
    return res.status(400).json({
      erro: "Dados inválidos. Informe UF, valor da nota e peso maiores que zero."
    });
  }

  const freteBaseSagix = valorNota * SAGIX_PERCENTUAL_NOTA;
  const icmsSagix = freteBaseSagix * ICMS_POR_UF[destino];
  const valorSagixCalculado = freteBaseSagix + icmsSagix;
  const valorSagix = Math.max(valorSagixCalculado, SAGIX_FRETE_MINIMO);

  const valorTjb =
    TJB_TAXA_FIXA +
    peso * TJB_VALOR_KG +
    valorNota * TJB_PERCENTUAL_NOTA +
    TJB_DESCARGA;

  const melhorOpcao = valorSagix <= valorTjb ? "SAGIX" : "TJB";
  const economia = Math.abs(valorSagix - valorTjb);

  const resposta = {
    sagixAtende: true,
    freteBaseSagix: arredondarMoeda(freteBaseSagix),
    icmsSagix: arredondarMoeda(icmsSagix),
    valorSagix: arredondarMoeda(valorSagix),
    valorTjb: arredondarMoeda(valorTjb),
    melhorOpcao,
    economia: arredondarMoeda(economia)
  };

  salvarHistorico({
    data: new Date().toLocaleString("pt-BR"),
    origem: ORIGEM_FIXA,
    destino,
    valorNota: arredondarMoeda(valorNota),
    peso: arredondarMoeda(peso),
    valorSagix: resposta.valorSagix,
    valorTjb: resposta.valorTjb,
    melhorOpcao,
    economia: resposta.economia
  });

  return res.json(resposta);
});

app.get("/historico", (req, res) => {
  return res.json(lerHistorico());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
