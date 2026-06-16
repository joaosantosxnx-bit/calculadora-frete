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
  botaoFiltrarSP: document.getElementById("btnFiltrarSP"),
  botaoFiltrarES: document.getElementById("btnFiltrarES"),
  botaoLimparFiltro: document.getElementById("btnLimparFiltro")
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
    SP: "São Paulo"
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

function alternarTema() {
  const html = document.documentElement;
  const temaAtivo = html.classList.toggle("theme-light");
  elementos.botaoTema.textContent = temaAtivo ? "Modo escuro" : "Modo claro";
  showToast(`Tema alterado para ${temaAtivo ? "claro" : "escuro"}.`);
}

function aplicarFiltro(uf) {
  filtroAtual = uf;
  elementos.botaoFiltrarSP.classList.toggle("filter-active", uf === "SP");
  elementos.botaoFiltrarES.classList.toggle("filter-active", uf === "ES");
  elementos.botaoLimparFiltro.classList.remove("filter-active");
  carregarHistorico();
  showToast(`Filtro aplicado: ${uf}`);
}

function limparFiltro() {
  filtroAtual = "";
  elementos.botaoFiltrarSP.classList.remove("filter-active");
  elementos.botaoFiltrarES.classList.remove("filter-active");
  elementos.botaoLimparFiltro.classList.add("filter-active");
  carregarHistorico();
  showToast("Filtro removido.");
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

    const colunas = ["data", "origem", "destino", "valorNota", "peso", "valorSagix", "valorTjb", "melhorOpcao", "economia"];
    const linhas = historico.map((item) => colunas.map((coluna) => escaparCsv(item[coluna])).join(";"));
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
    `SAGIX: ${moeda(dados.valorSagix)}`,
    `TJB: ${moeda(dados.valorTjb)}`,
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
      <p>Economia estimada: <strong>${moeda(dados.economia)}</strong></p>
    </div>

    <div class="comparison" role="table" aria-label="Comparativo de frete">
      <div class="comparison-row comparison-head" role="row">
        <div role="columnheader">Transportadora</div>
        <div role="columnheader">Valor</div>
      </div>
      <div class="comparison-row" role="row">
        <div role="cell"><strong>SAGIX</strong></div>
        <div class="value" role="cell">${moeda(dados.valorSagix)}</div>
      </div>
      <div class="comparison-row" role="row">
        <div role="cell"><strong>TJB</strong></div>
        <div class="value" role="cell">${moeda(dados.valorTjb)}</div>
      </div>
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

    elementos.historicoLista.innerHTML = historico.slice(0, 6).map((item) => `
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
elementos.botaoFiltrarSP.addEventListener("click", () => aplicarFiltro("SP"));
elementos.botaoFiltrarES.addEventListener("click", () => aplicarFiltro("ES"));
elementos.botaoLimparFiltro.addEventListener("click", limparFiltro);

carregarHistorico();
