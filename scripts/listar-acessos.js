const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const ACESSOS_PATH = path.join(__dirname, "..", "acessos.json");
const DATABASE_URL = process.env.DATABASE_URL;

function formatarLinha(acesso) {
  const data = acesso.data || "";
  const tipo = acesso.tipo || "";
  const ip = acesso.ip || "";
  const dispositivo = acesso.dispositivo || "";
  const rota = acesso.rota || "";
  const navegador = (acesso.user_agent || acesso.userAgent || "").slice(0, 80);

  return `${data} | ${tipo} | ${ip} | ${dispositivo} | ${rota} | ${navegador}`;
}

async function listarDoBanco() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const resultado = await pool.query(`
      SELECT data, tipo, ip, dispositivo, rota, user_agent
      FROM acessos
      ORDER BY criado_em DESC, id DESC
      LIMIT 50
    `);

    return resultado.rows;
  } finally {
    await pool.end();
  }
}

function listarLocal() {
  if (!fs.existsSync(ACESSOS_PATH)) return [];

  try {
    const acessos = JSON.parse(fs.readFileSync(ACESSOS_PATH, "utf8"));
    return Array.isArray(acessos) ? acessos.slice(0, 50) : [];
  } catch (erro) {
    return [];
  }
}

async function main() {
  const acessos = DATABASE_URL ? await listarDoBanco() : listarLocal();

  if (acessos.length === 0) {
    console.log("Nenhum acesso registrado ainda.");
    return;
  }

  console.log("Ultimos acessos:");
  acessos.forEach((acesso) => console.log(formatarLinha(acesso)));
}

main().catch((erro) => {
  console.error("Nao foi possivel listar os acessos:", erro.message);
  process.exit(1);
});
