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
const DIVISOR_FINAL_COTACAO = 0.82;
const SAGIX_MENSAGEM_MINIMO = "SAGIX não atende esta operação, pois o valor calculado ficou abaixo do valor mínimo operacional aceito de R$ 1.250,00.";

// SAGIX
const SAGIX_PERCENTUAL_NOTA = 0.05;
const SAGIX_FRETE_MINIMO = 1250;
const ICMS_POR_UF = {
  ES: 0.07,
  SP_CAPITAL: 0.12
};

// TJB oficial
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

function calcularSagix(destino, valorNota) {
  const freteBase = valorNota * SAGIX_PERCENTUAL_NOTA;
  const aliquotaIcms = ICMS_POR_UF[destino];
  const icms = freteBase * aliquotaIcms;
  const valorCalculado = freteBase + icms;

  if (valorCalculado < SAGIX_FRETE_MINIMO) {
    return {
      atende: false,
      mensagem: SAGIX_MENSAGEM_MINIMO,
      valorCalculado,
      detalhes: {
        freteBase,
        icms
      }
    };
  }

  return {
    atende: true,
    valorFinal: valorCalculado / DIVISOR_FINAL_COTACAO,
    detalhes: {
      freteBase,
      icms
    }
  };
}

function calcularTjb(valorNota, peso) {
  const valorCalculado =
    TJB_TAXA_FIXA +
    peso * TJB_VALOR_KG +
    valorNota * TJB_PERCENTUAL_NOTA +
    TJB_DESCARGA;

  return {
    valorFinal: valorCalculado / DIVISOR_FINAL_COTACAO
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
  const avisos = [];

  if (regra.tipo === "sagix") {
    if (!Object.prototype.hasOwnProperty.call(ICMS_POR_UF, destino)) {
      return { cotacao: null, avisos };
    }

    const calculo = calcularSagix(destino, valorNota);

    if (!calculo.atende) {
      avisos.push({
        transportadora: regra.transportadora,
        mensagem: calculo.mensagem
      });

      return { cotacao: null, avisos };
    }

    return {
      cotacao: {
        transportadora: regra.transportadora,
        tipo: regra.tipo,
        valor: arredondarMoeda(calculo.valorFinal)
      },
      avisos
    };
  }

  if (regra.tipo === "tjb") {
    const calculo = calcularTjb(valorNota, peso);

    return {
      cotacao: {
        transportadora: regra.transportadora,
        tipo: regra.tipo,
        valor: arredondarMoeda(calculo.valorFinal)
      },
      avisos
    };
  }

  if (regra.tipo === "base") {
    const calculo = calcularRegraBase(regra, valorNota, peso);

    return {
      cotacao: {
        transportadora: regra.transportadora,
        tipo: regra.tipo,
        valor: arredondarMoeda(calculo.valorFinal)
      },
      avisos
    };
  }

  return { cotacao: null, avisos };
}

function calcularTransportadoras(regrasDestino, destino, valorNota, peso) {
  const resultados = regrasDestino.map((regra) => calcularTransportadora(regra, destino, valorNota, peso));
  const transportadoras = resultados
    .map((resultado) => resultado.cotacao)
    .filter(Boolean)
    .sort((a, b) => a.valor - b.valor);
  const avisos = resultados.flatMap((resultado) => resultado.avisos);

  return {
    transportadoras,
    avisos
  };
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

  const { transportadoras, avisos } = calcularTransportadoras(regrasDestino, destino, valorNota, peso);

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
    avisos,
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
    avisos,
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
