const origemFixa = "Serra - ES";

const elementos = {
  ufDestino: document.getElementById("ufDestino"),
  valorNota: document.getElementById("valorNota"),
  peso: document.getElementById("peso"),
  resultado: document.getElementById("resultado"),
  botaoCalcular: document.getElementById("btnCalcular"),
  historicoLista: document.getElementById("historicoLista"),
  botaoExportarCsv: document.getElementById("btnExportCsv"),
  botaoTema: document.getElementById("btnTema"),
  botoesFiltro: document.querySelectorAll("[data-filtro]")
};

let filtroAtual = "";

function moeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function numeroFormatado(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    maximumFractionDigits: 2
  });
}

function nomeDestino(uf) {
  const nomes = {
    ES: "Espírito Santo",
    SP_CAPITAL: "São Paulo - Capital",
    SP_INTERIOR: "São Paulo - Interior",
    MG: "Minas Gerais",
    RJ: "Rio de Janeiro",
    BA: "Bahia"
  };

  return nomes[uf] || uf;
}

function showToast(mensagem, timeout = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = mensagem;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 220);
  }, timeout);
}

function aplicarTema(tema) {
  const claro = tema === "claro";
  document.body.classList.toggle("theme-light", claro);
  elementos.botaoTema.textContent = claro ? "Modo escuro" : "Modo claro";
  elementos.botaoTema.setAttribute("aria-pressed", String(claro));
  localStorage.setItem("temaCalculadoraFrete", tema);
}

function alternarTema() {
  const temaAtual = document.body.classList.contains("theme-light") ? "escuro" : "claro";
  aplicarTema(temaAtual);
}

function iniciarTema() {
  const temaSalvo = localStorage.getItem("temaCalculadoraFrete");
  aplicarTema(temaSalvo === "claro" ? "claro" : "escuro");
}

function atualizarBotoesFiltro() {
  elementos.botoesFiltro.forEach((botao) => {
    const ativo = botao.dataset.filtro === filtroAtual;
    botao.classList.toggle("is-active", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
  });
}

function aplicarFiltro(uf) {
  filtroAtual = uf;
  atualizarBotoesFiltro();
  carregarHistorico();
}

function baixarArquivo(conteudo, nomeArquivo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escaparCsv(valor) {
  const texto = String(valor ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

async function exportarHistoricoCsv() {
  try {
    const resposta = await fetch("/historico");
    const historico = await resposta.json();

    if (!Array.isArray(historico) || historico.length === 0) {
      showToast("Nenhuma cotação no histórico.");
      return;
    }

    const colunas = ["data", "origem", "destino", "valorNota", "peso", "melhorOpcao", "melhorValor", "economia", "transportadoras"];
    const linhas = historico.map((item) => {
      const linha = {
        ...item,
        transportadoras: Array.isArray(item.transportadoras)
          ? item.transportadoras.map((transportadora) => `${transportadora.transportadora}: ${moeda(transportadora.valor)}`).join(" | ")
          : ""
      };

      return colunas.map((coluna) => escaparCsv(linha[coluna])).join(";");
    });
    const csv = `${colunas.join(";")}\n${linhas.join("\n")}`;
    const data = new Date().toISOString().slice(0, 10);

    baixarArquivo(csv, `historico-cotacoes-${data}.csv`, "text/csv;charset=utf-8;");
    showToast("Histórico exportado em CSV.");
  } catch (erro) {
    showToast("Não foi possível exportar o histórico.");
  }
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    showToast("Resumo copiado.");
  } catch (erro) {
    showToast("Não foi possível copiar automaticamente.");
  }
}

function exibirMensagem(titulo, texto, tipo = "empty") {
  elementos.resultado.innerHTML = `
    <div class="${tipo}">
      <span>Atenção</span>
      <h2>${titulo}</h2>
      <p>${texto}</p>
    </div>
  `;
}

function dadosDoFormulario() {
  return {
    destino: elementos.ufDestino.value,
    valorNota: Number(elementos.valorNota.value),
    peso: Number(elementos.peso.value)
  };
}

function validarFormulario({ destino, valorNota, peso }) {
  if (!destino) return "Selecione a UF de destino.";
  if (!Number.isFinite(valorNota) || valorNota <= 0) return "Informe um valor de nota fiscal maior que zero.";
  if (!Number.isFinite(peso) || peso <= 0) return "Informe o peso da carga maior que zero.";
  return "";
}

function montarResultado(dados, entrada) {
  const resumoCopiavel = [
    "Cotação de frete GEOFIN",
    `Origem: ${origemFixa}`,
    `Destino: ${nomeDestino(entrada.destino)}`,
    `Valor da nota: ${moeda(entrada.valorNota)}`,
    `Peso: ${numeroFormatado(entrada.peso)} kg`,
    `Melhor opção: ${dados.melhorOpcao}`,
    ...dados.transportadoras.map((item) => `${item.transportadora}: ${moeda(item.valor)}`),
    `Economia estimada: ${moeda(dados.economia)}`
  ].join("\n");

  elementos.resultado.innerHTML = `
    <div class="summary">
      <div class="info-card">
        <span>Origem</span>
        <strong>${origemFixa}</strong>
      </div>
      <div class="info-card">
        <span>UF destino</span>
        <strong>${nomeDestino(entrada.destino)}</strong>
      </div>
      <div class="info-card">
        <span>Peso</span>
        <strong>${numeroFormatado(entrada.peso)} kg</strong>
      </div>
    </div>

    <div class="winner">
      <span>Melhor opção</span>
      <h2>${dados.melhorOpcao}</h2>
      <p>Valor estimado: <strong>${moeda(dados.melhorValor)}</strong></p>
    </div>

    <div class="comparison" role="table" aria-label="Comparativo de frete">
      <div class="comparison-row comparison-head" role="row">
        <div role="columnheader">Transportadora</div>
        <div role="columnheader">Valor</div>
      </div>
      ${dados.transportadoras.map((item) => `
        <div class="comparison-row ${item.transportadora === dados.melhorOpcao ? "best-row" : ""}" role="row">
          <div role="cell"><strong>${item.transportadora}</strong></div>
          <div class="value" role="cell">${moeda(item.valor)}</div>
        </div>
      `).join("")}
    </div>

    <div class="result-actions">
      <button class="secondary-action" id="btnCopiarResumo" type="button">Copiar resumo</button>
    </div>
  `;

  document.getElementById("btnCopiarResumo").addEventListener("click", () => copiarTexto(resumoCopiavel));
}

async function calcular() {
  const entrada = dadosDoFormulario();
  const erroValidacao = validarFormulario(entrada);

  if (erroValidacao) {
    exibirMensagem("Dados inválidos", erroValidacao);
    return;
  }

  elementos.botaoCalcular.disabled = true;
  elementos.botaoCalcular.textContent = "Calculando...";

  try {
    const resposta = await fetch("/calcular", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(entrada)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      exibirMensagem("Não foi possível calcular", dados.erro || "Revise os dados e tente novamente.");
      return;
    }

    montarResultado(dados, entrada);
    carregarHistorico();
  } catch (erro) {
    exibirMensagem("Servidor indisponível", "Verifique se o sistema está rodando e tente novamente.");
  } finally {
    elementos.botaoCalcular.disabled = false;
    elementos.botaoCalcular.textContent = "Calcular frete";
  }
}

async function carregarHistorico() {
  try {
    const resposta = await fetch("/historico");
    const historico = await resposta.json();

    if (!Array.isArray(historico) || historico.length === 0) {
      elementos.historicoLista.innerHTML = `<p class="muted">Nenhuma cotação realizada ainda.</p>`;
      return;
    }

    const historicoFiltrado = filtroAtual
      ? historico.filter((item) => item.destino === filtroAtual)
      : historico;

    if (historicoFiltrado.length === 0) {
      elementos.historicoLista.innerHTML = `<p class="muted">Nenhuma cotação encontrada para este filtro.</p>`;
      return;
    }

    elementos.historicoLista.innerHTML = historicoFiltrado.slice(0, 6).map((item) => `
      <div class="history-item">
        <div>
          <span>Data</span>
          <strong>${item.data}</strong>
        </div>
        <div>
          <span>Destino</span>
          <strong>${nomeDestino(item.destino)}</strong>
        </div>
        <div>
          <span>Peso</span>
          <strong>${numeroFormatado(item.peso)} kg</strong>
        </div>
        <div>
          <span>Nota</span>
          <strong>${moeda(item.valorNota)}</strong>
        </div>
        <div>
          <span>Melhor</span>
          <strong>${item.melhorOpcao}</strong>
        </div>
      </div>
    `).join("");
  } catch (erro) {
    elementos.historicoLista.innerHTML = `<p class="error-text">Erro ao carregar histórico.</p>`;
  }
}

elementos.botaoCalcular.addEventListener("click", calcular);
elementos.botaoExportarCsv.addEventListener("click", exportarHistoricoCsv);
elementos.botaoTema.addEventListener("click", alternarTema);
elementos.botoesFiltro.forEach((botao) => {
  botao.addEventListener("click", () => aplicarFiltro(botao.dataset.filtro));
});

iniciarTema();
atualizarBotoesFiltro();
carregarHistorico();
