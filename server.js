const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const regrasFrete = require("./data/freteRules");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const HISTORICO_PATH = path.join(__dirname, "cotacoes.json");

const ORIGEM_FIXA = "Serra - ES";
const DESTINOS_PERMITIDOS = Object.keys(regrasFrete);

// SAGIX
const SAGIX_PERCENTUAL_NOTA = 0.05;
const SAGIX_FRETE_MINIMO = 1250;
const ICMS_POR_UF = {
  ES: 0.07,
  SP_CAPITAL: 0.12,
  SP_INTERIOR: 0.12
};

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

function calcularSagix(destino, valorNota) {
  const freteBase = valorNota * SAGIX_PERCENTUAL_NOTA;
  const aliquotaIcms = ICMS_POR_UF[destino];
  const icms = freteBase * aliquotaIcms;
  const valorFinal = Math.max(freteBase + icms, SAGIX_FRETE_MINIMO);

  return {
    valorFinal,
    detalhes: {
      freteBase,
      icms
    }
  };
}

function calcularRegraBase(regra, valorNota, peso) {
  const valorPorKg = peso * regra.rkg;
  const valorPorNota = valorNota * regra.percentualNota;
  const minimo = regra.minimo || 0;
  const valorFinal = Math.max(valorPorKg, valorPorNota, minimo);

  return {
    valorFinal,
    detalhes: {
      valorPorKg,
      valorPorNota,
      minimo
    }
  };
}

function calcularTransportadora(regra, destino, valorNota, peso) {
  if (regra.tipo === "sagix") {
    if (!Object.prototype.hasOwnProperty.call(ICMS_POR_UF, destino)) {
      return null;
    }

    const calculo = calcularSagix(destino, valorNota);

    return {
      transportadora: regra.transportadora,
      tipo: regra.tipo,
      valor: arredondarMoeda(calculo.valorFinal)
    };
  }

  if (regra.tipo === "base") {
    const calculo = calcularRegraBase(regra, valorNota, peso);

    return {
      transportadora: regra.transportadora,
      tipo: regra.tipo,
      valor: arredondarMoeda(calculo.valorFinal)
    };
  }

  return null;
}

app.post("/calcular", (req, res) => {
  const { destino, valorNota, peso } = req.body;
  const regrasDestino = regrasFrete[destino];

  if (
    typeof destino !== "string" ||
    !DESTINOS_PERMITIDOS.includes(destino) ||
    !Array.isArray(regrasDestino) ||
    regrasDestino.length === 0 ||
    !numeroValido(valorNota) ||
    !numeroValido(peso)
  ) {
    return res.status(400).json({
      erro: "Dados inválidos. Informe UF, valor da nota e peso maiores que zero."
    });
  }

  const transportadoras = regrasDestino
    .map((regra) => calcularTransportadora(regra, destino, valorNota, peso))
    .filter(Boolean)
    .sort((a, b) => a.valor - b.valor);

  if (transportadoras.length === 0) {
    return res.status(400).json({
      erro: "Nenhuma transportadora disponível para o destino informado."
    });
  }

  const melhorCotacao = transportadoras[0];
  const maiorCotacao = transportadoras[transportadoras.length - 1];
  const economia = maiorCotacao.valor - melhorCotacao.valor;

  const resposta = {
    transportadoras,
    melhorOpcao: melhorCotacao.transportadora,
    melhorValor: melhorCotacao.valor,
    economia: arredondarMoeda(economia)
  };

  salvarHistorico({
    data: new Date().toLocaleString("pt-BR"),
    origem: ORIGEM_FIXA,
    destino,
    valorNota: arredondarMoeda(valorNota),
    peso: arredondarMoeda(peso),
    transportadoras,
    melhorOpcao: resposta.melhorOpcao,
    melhorValor: resposta.melhorValor,
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
