const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const HISTORICO_PATH = path.join(__dirname, "cotacoes.json");

// SAGIX
const SAGIX_PERCENTUAL_NOTA = 0.05;
const SAGIX_FRETE_MINIMO = 1250;
const ICMS_ES = 0.07;
const ICMS_SP = 0.12;

// TJB provisório
const TJB_TAXA_FIXA = 75.04;
const TJB_VALOR_KG = 0.69678;
const TJB_PERCENTUAL_NOTA = 0.01;
const TJB_DESCARGA = 400;

function lerHistorico() {
    if (!fs.existsSync(HISTORICO_PATH)) {
        fs.writeFileSync(HISTORICO_PATH, "[]");
    }

    return JSON.parse(fs.readFileSync(HISTORICO_PATH, "utf8"));
}

function salvarHistorico(cotacao) {
    const historico = lerHistorico();

    historico.unshift(cotacao);

    const historicoLimitado = historico.slice(0, 20);

    fs.writeFileSync(HISTORICO_PATH, JSON.stringify(historicoLimitado, null, 2));
}

app.post("/calcular", (req, res) => {
    const { destino, valorNota, peso } = req.body;

    if (
        typeof destino !== "string" ||
        !["ES", "SP"].includes(destino) ||
        typeof valorNota !== "number" ||
        valorNota <= 0 ||
        typeof peso !== "number" ||
        peso <= 0
    ) {
        return res.status(400).json({
            erro: "Dados inválidos."
        });
    }

    const sagixAtende = destino === "ES" || destino === "SP";
    let freteBaseSagix = 0;
    let icmsSagix = 0;
    let valorSagix = null;

    if (sagixAtende) {
        freteBaseSagix = valorNota * SAGIX_PERCENTUAL_NOTA;
        const aliquotaIcms = destino === "ES" ? ICMS_ES : ICMS_SP;
        icmsSagix = freteBaseSagix * aliquotaIcms;
        valorSagix = freteBaseSagix + icmsSagix;
        valorSagix = Math.max(valorSagix, SAGIX_FRETE_MINIMO);
    }

    let valorTjb =
        TJB_TAXA_FIXA +
        peso * TJB_VALOR_KG +
        valorNota * TJB_PERCENTUAL_NOTA +
        TJB_DESCARGA;

    const divisor = 0.82;
    if (sagixAtende && valorSagix !== null) {
        valorSagix = valorSagix / divisor;
    }
    valorTjb = valorTjb / divisor;

    let melhorOpcao = "TJB";
    let economia = 0;

    if (sagixAtende && valorSagix !== null) {
        if (valorSagix < valorTjb) {
            melhorOpcao = "SAGIX";
            economia = valorTjb - valorSagix;
        } else {
            melhorOpcao = "TJB";
            economia = valorSagix - valorTjb;
        }
    }

    const cotacao = {
        data: new Date().toLocaleString("pt-BR"),
        origem: "Serra - ES",
        destino,
        valorNota,
        peso,
        valorSagix,
        valorTjb,
        melhorOpcao,
        economia
    };

    salvarHistorico(cotacao);

    res.json({
        sagixAtende,
        freteBaseSagix: Number(freteBaseSagix.toFixed(2)),
        icmsSagix: Number(icmsSagix.toFixed(2)),
        valorSagix: valorSagix === null ? null : Number(valorSagix.toFixed(2)),
        valorTjb: Number(valorTjb.toFixed(2)),
        melhorOpcao,
        economia: Number(economia.toFixed(2))
    });
});

app.get("/historico", (req, res) => {
    res.json(lerHistorico());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});