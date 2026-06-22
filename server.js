const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const regrasFrete = require("./data/freteRules");

const app = express();

app.use(cors());
app.use(express.json());

const HISTORICO_PATH = path.join(__dirname, "cotacoes.json");
const ACESSOS_PATH = path.join(__dirname, "acessos.json");
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    })
  : null;

const ORIGEM_FIXA = "Serra - ES";
const DESTINOS_PERMITIDOS = Object.keys(regrasFrete);
const DIVISOR_FINAL_COTACAO = 0.82;
const SAGIX_MENSAGEM_MINIMO = "SAGIX não atende esta operação, pois o valor da nota fiscal ficou abaixo do valor mínimo operacional aceito de R$ 1.250,00.";

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

function lerAcessosLocais() {
  if (!fs.existsSync(ACESSOS_PATH)) {
    fs.writeFileSync(ACESSOS_PATH, "[]");
  }

  try {
    const conteudo = fs.readFileSync(ACESSOS_PATH, "utf8");
    const acessos = JSON.parse(conteudo);
    return Array.isArray(acessos) ? acessos : [];
  } catch (erro) {
    return [];
  }
}

function salvarAcessoLocal(acesso) {
  const acessos = lerAcessosLocais();
  const acessosLimitados = [acesso, ...acessos].slice(0, 200);

  fs.writeFileSync(ACESSOS_PATH, JSON.stringify(acessosLimitados, null, 2));
}

async function inicializarBanco() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cotacoes (
      id SERIAL PRIMARY KEY,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data TEXT NOT NULL,
      origem TEXT NOT NULL,
      destino TEXT NOT NULL,
      valor_nota NUMERIC(12, 2) NOT NULL,
      peso NUMERIC(12, 2) NOT NULL,
      transportadoras JSONB NOT NULL,
      avisos JSONB NOT NULL,
      melhor_opcao TEXT NOT NULL,
      melhor_valor NUMERIC(12, 2) NOT NULL,
      economia NUMERIC(12, 2) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS acessos (
      id SERIAL PRIMARY KEY,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data TEXT NOT NULL,
      tipo TEXT NOT NULL,
      metodo TEXT NOT NULL,
      rota TEXT NOT NULL,
      ip TEXT NOT NULL,
      dispositivo TEXT NOT NULL,
      user_agent TEXT,
      referer TEXT
    )
  `);
}

function normalizarCotacaoBanco(row) {
  return {
    id: row.id,
    data: row.data,
    origem: row.origem,
    destino: row.destino,
    valorNota: Number(row.valor_nota),
    peso: Number(row.peso),
    transportadoras: row.transportadoras,
    avisos: row.avisos,
    melhorOpcao: row.melhor_opcao,
    melhorValor: Number(row.melhor_valor),
    economia: Number(row.economia)
  };
}

async function salvarCotacao(cotacao) {
  if (!pool) {
    salvarHistorico(cotacao);
    return;
  }

  await pool.query(
    `
      INSERT INTO cotacoes (
        data,
        origem,
        destino,
        valor_nota,
        peso,
        transportadoras,
        avisos,
        melhor_opcao,
        melhor_valor,
        economia
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
    `,
    [
      cotacao.data,
      cotacao.origem,
      cotacao.destino,
      cotacao.valorNota,
      cotacao.peso,
      JSON.stringify(cotacao.transportadoras),
      JSON.stringify(cotacao.avisos),
      cotacao.melhorOpcao,
      cotacao.melhorValor,
      cotacao.economia
    ]
  );
}

async function listarCotacoes() {
  if (!pool) return lerHistorico();

  const resultado = await pool.query(`
    SELECT
      id,
      data,
      origem,
      destino,
      valor_nota,
      peso,
      transportadoras,
      avisos,
      melhor_opcao,
      melhor_valor,
      economia
    FROM cotacoes
    ORDER BY criado_em DESC, id DESC
    LIMIT 20
  `);

  return resultado.rows.map(normalizarCotacaoBanco);
}

function obterIp(req) {
  const encaminhado = req.headers["x-forwarded-for"];
  const ip = Array.isArray(encaminhado)
    ? encaminhado[0]
    : encaminhado || req.socket.remoteAddress || req.ip || "";

  return ip.split(",")[0].trim().replace(/^::ffff:/, "") || "desconhecido";
}

function obterDispositivo(userAgent) {
  if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) return "celular";
  return "computador";
}

function criarAcesso(req, tipo) {
  const userAgent = req.headers["user-agent"] || "";

  return {
    data: new Date().toLocaleString("pt-BR"),
    tipo,
    metodo: req.method,
    rota: req.originalUrl || req.url,
    ip: obterIp(req),
    dispositivo: obterDispositivo(userAgent),
    userAgent,
    referer: req.headers.referer || ""
  };
}

async function salvarAcesso(acesso) {
  if (!pool) {
    salvarAcessoLocal(acesso);
    return;
  }

  await pool.query(
    `
      INSERT INTO acessos (
        data,
        tipo,
        metodo,
        rota,
        ip,
        dispositivo,
        user_agent,
        referer
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      acesso.data,
      acesso.tipo,
      acesso.metodo,
      acesso.rota,
      acesso.ip,
      acesso.dispositivo,
      acesso.userAgent,
      acesso.referer
    ]
  );
}

function registrarAcesso(req, tipo) {
  return salvarAcesso(criarAcesso(req, tipo)).catch((erro) => {
    console.error("Erro ao registrar acesso:", erro);
  });
}

function numeroValido(valor) {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

function calcularSagix(destino, valorNota) {
  const freteBase = valorNota * SAGIX_PERCENTUAL_NOTA;
  const aliquotaIcms = ICMS_POR_UF[destino];
  const icms = freteBase * aliquotaIcms;
  const valorCalculado = freteBase + icms;
  const valorFinal = valorCalculado / DIVISOR_FINAL_COTACAO;

  if (valorNota < SAGIX_FRETE_MINIMO) {
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
    valorFinal,
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

app.get("/", (req, res, next) => {
  registrarAcesso(req, "pagina_inicial");
  next();
});

app.use(express.static("public"));

app.post("/calcular", async (req, res) => {
  registrarAcesso(req, "calculo");

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

  const cotacao = {
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
  };

  try {
    await salvarCotacao(cotacao);
  } catch (erro) {
    console.error("Erro ao salvar cotação:", erro);
    return res.status(500).json({
      erro: "Cotação calculada, mas não foi possível salvar no histórico."
    });
  }

  return res.json(resposta);
});

app.get("/historico", async (req, res) => {
  registrarAcesso(req, "historico");

  try {
    const historico = await listarCotacoes();
    return res.json(historico);
  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar o histórico."
    });
  }
});

const PORT = process.env.PORT || 3000;

inicializarBanco()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((erro) => {
    console.error("Erro ao inicializar banco de dados:", erro);
    process.exit(1);
  });
