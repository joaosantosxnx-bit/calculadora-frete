const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const regrasFrete = require("./data/freteRules");

const app = express();

app.use(cors());
app.use(express.json());

const HISTORICO_PATH = path.join(__dirname, "cotacoes.json");
const ACESSOS_PATH = path.join(__dirname, "acessos.json");
const REGRAS_EXTRAS_PATH = path.join(__dirname, "regras-extras.json");
const ADMIN_SENHA = process.env.ADMIN_SENHA || "";
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    })
  : null;

const ORIGEM_FIXA = "Serra - ES";
const NOMES_DESTINO = {
  ES: "Espírito Santo",
  SP_CAPITAL: "São Paulo - Capital",
  SP_INTERIOR: "São Paulo - Interior",
  MG: "Minas Gerais",
  RJ: "Rio de Janeiro",
  BA: "Bahia"
};
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

function lerRegrasExtrasLocais() {
  if (!fs.existsSync(REGRAS_EXTRAS_PATH)) return [];

  try {
    const regras = JSON.parse(fs.readFileSync(REGRAS_EXTRAS_PATH, "utf8"));
    return Array.isArray(regras) ? regras : [];
  } catch (erro) {
    return [];
  }
}

function gravarRegrasExtrasLocais(regras) {
  fs.writeFileSync(REGRAS_EXTRAS_PATH, JSON.stringify(regras, null, 2));
}

async function listarRegrasExtras() {
  if (!pool) return lerRegrasExtrasLocais();

  const resultado = await pool.query(`
    SELECT id, destino, destino_nome, transportadora, rkg, percentual_nota, minimo
    FROM regras_frete_extras
    ORDER BY destino, transportadora, id
  `);

  return resultado.rows.map((row) => ({
    id: row.id,
    destino: row.destino,
    destinoNome: row.destino_nome || "",
    transportadora: row.transportadora,
    rkg: Number(row.rkg),
    percentualNota: Number(row.percentual_nota),
    minimo: Number(row.minimo)
  }));
}

async function salvarRegraExtra(regra) {
  if (!pool) {
    const regras = lerRegrasExtrasLocais();
    const id = regras.reduce((maior, item) => Math.max(maior, Number(item.id) || 0), 0) + 1;
    const nova = { id, ...regra };
    gravarRegrasExtrasLocais([...regras, nova]);
    return nova;
  }

  const resultado = await pool.query(
    `
      INSERT INTO regras_frete_extras (destino, destino_nome, transportadora, rkg, percentual_nota, minimo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [regra.destino, regra.destinoNome, regra.transportadora, regra.rkg, regra.percentualNota, regra.minimo]
  );

  return { id: resultado.rows[0].id, ...regra };
}

async function removerRegraExtra(id) {
  if (!pool) {
    const regras = lerRegrasExtrasLocais();
    const restantes = regras.filter((item) => Number(item.id) !== id);
    gravarRegrasExtrasLocais(restantes);
    return restantes.length !== regras.length;
  }

  const resultado = await pool.query("DELETE FROM regras_frete_extras WHERE id = $1", [id]);
  return resultado.rowCount > 0;
}

// Junta as regras fixas do código com as cadastradas pelo painel.
// Uma regra cadastrada com o mesmo nome de transportadora no mesmo destino substitui a original.
async function obterRegrasCompletas() {
  const extras = await listarRegrasExtras();
  const regras = {};
  const nomes = { ...NOMES_DESTINO };

  Object.entries(regrasFrete).forEach(([destino, lista]) => {
    regras[destino] = [...lista];
  });

  extras.forEach((extra) => {
    const lista = regras[extra.destino] || [];
    const chave = extra.transportadora.toUpperCase();
    const semDuplicada = lista.filter((regra) => regra.transportadora.toUpperCase() !== chave);

    regras[extra.destino] = [
      ...semDuplicada,
      {
        transportadora: extra.transportadora,
        tipo: "base",
        rkg: extra.rkg,
        percentualNota: extra.percentualNota,
        minimo: extra.minimo
      }
    ];

    if (!nomes[extra.destino]) {
      nomes[extra.destino] = extra.destinoNome || extra.destino;
    }
  });

  return { regras, nomes };
}

async function inicializarBanco() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cotacoes (
      id SERIAL PRIMARY KEY,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data TEXT NOT NULL,
      cliente TEXT,
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
    ALTER TABLE cotacoes
    ADD COLUMN IF NOT EXISTS cliente TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS regras_frete_extras (
      id SERIAL PRIMARY KEY,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      destino TEXT NOT NULL,
      destino_nome TEXT,
      transportadora TEXT NOT NULL,
      rkg NUMERIC(14, 6) NOT NULL,
      percentual_nota NUMERIC(10, 6) NOT NULL,
      minimo NUMERIC(12, 2) NOT NULL DEFAULT 0
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
    cliente: row.cliente || "",
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
        cliente,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
    `,
    [
      cotacao.data,
      cotacao.cliente,
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
      cliente,
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
  const valorCalculado = Math.max(valorPorKg, valorPorNota, minimo);
  const valorFinal = valorCalculado / DIVISOR_FINAL_COTACAO;

  return {
    valorFinal,
    detalhes: {
      valorPorKg,
      valorPorNota,
      minimo,
      valorCalculado
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

  const { cliente, destino, valorNota, peso } = req.body || {};
  let regrasCompletas;

  try {
    regrasCompletas = (await obterRegrasCompletas()).regras;
  } catch (erro) {
    console.error("Erro ao carregar regras de frete:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar as regras de frete." });
  }

  const regrasDestino = Object.prototype.hasOwnProperty.call(regrasCompletas, destino)
    ? regrasCompletas[destino]
    : undefined;
  const clienteNormalizado = typeof cliente === "string" ? cliente.trim().slice(0, 120) : "";

  if (
    typeof destino !== "string" ||
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
    cliente: clienteNormalizado,
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

app.get("/destinos", async (req, res) => {
  try {
    const { regras, nomes } = await obterRegrasCompletas();
    const destinos = Object.keys(regras).map((codigo) => ({ codigo, nome: nomes[codigo] || codigo }));
    return res.json(destinos);
  } catch (erro) {
    console.error("Erro ao listar destinos:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar os destinos." });
  }
});

// ---------- Painel de cadastro (acesso restrito por senha) ----------

const TENTATIVAS_MAXIMAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const tentativasAdmin = new Map();

function hashSenha(texto) {
  return crypto.createHash("sha256").update(String(texto)).digest();
}

function senhaConfere(senhaInformada) {
  return crypto.timingSafeEqual(hashSenha(senhaInformada), hashSenha(ADMIN_SENHA));
}

function exigirAdmin(req, res, next) {
  if (!ADMIN_SENHA) {
    return res.status(503).json({ erro: "Cadastro desativado: defina a variável ADMIN_SENHA no servidor." });
  }

  const ip = obterIp(req);
  const agora = Date.now();
  const registro = tentativasAdmin.get(ip);

  if (registro && registro.bloqueadoAte > agora) {
    return res.status(429).json({ erro: "Muitas tentativas. Aguarde alguns minutos." });
  }

  if (!senhaConfere(req.headers["x-admin-senha"] || "")) {
    const falhasAnteriores = registro && registro.bloqueadoAte === 0 ? registro.falhas : 0;
    const falhas = falhasAnteriores + 1;

    tentativasAdmin.set(ip, {
      falhas,
      bloqueadoAte: falhas >= TENTATIVAS_MAXIMAS ? agora + BLOQUEIO_MS : 0
    });

    return res.status(401).json({ erro: "Senha incorreta." });
  }

  tentativasAdmin.delete(ip);
  return next();
}

function numeroNaoNegativo(valor) {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
}

function validarNovaRegra(corpo) {
  const destino = String(corpo.destino || "").trim().toUpperCase().replace(/\s+/g, "_");
  const destinoNome = String(corpo.destinoNome || "").trim().slice(0, 60);
  const transportadora = String(corpo.transportadora || "").trim().toUpperCase().slice(0, 60);
  const { rkg, percentualNota, minimo = 0 } = corpo;

  if (!/^[A-Z0-9_]{2,20}$/.test(destino)) return { erro: "Código de destino inválido (use letras, números ou _)." };
  if (!transportadora) return { erro: "Informe o nome da transportadora." };
  if (!numeroNaoNegativo(rkg) || !numeroNaoNegativo(percentualNota) || !numeroNaoNegativo(minimo)) {
    return { erro: "Valores devem ser números maiores ou iguais a zero." };
  }
  if (percentualNota >= 1) return { erro: "Percentual sobre a nota deve ser menor que 100%." };
  if (rkg === 0 && percentualNota === 0 && minimo === 0) return { erro: "Informe ao menos uma tarifa maior que zero." };

  return { regra: { destino, destinoNome, transportadora, rkg, percentualNota, minimo } };
}

app.get("/admin/fretes", exigirAdmin, async (req, res) => {
  try {
    const [extras, { regras, nomes }] = await Promise.all([listarRegrasExtras(), obterRegrasCompletas()]);
    const destinos = Object.keys(regras).map((codigo) => ({ codigo, nome: nomes[codigo] || codigo }));
    return res.json({ extras, destinos });
  } catch (erro) {
    console.error("Erro ao listar fretes cadastrados:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar os fretes cadastrados." });
  }
});

app.post("/admin/fretes", exigirAdmin, async (req, res) => {
  const { regra, erro } = validarNovaRegra(req.body || {});
  if (erro) return res.status(400).json({ erro });

  try {
    const salva = await salvarRegraExtra(regra);
    return res.status(201).json(salva);
  } catch (falha) {
    console.error("Erro ao salvar frete:", falha);
    return res.status(500).json({ erro: "Não foi possível salvar o frete." });
  }
});

app.delete("/admin/fretes/:id", exigirAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "Identificador inválido." });

  try {
    const removida = await removerRegraExtra(id);
    if (!removida) return res.status(404).json({ erro: "Frete não encontrado." });
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao remover frete:", erro);
    return res.status(500).json({ erro: "Não foi possível remover o frete." });
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
