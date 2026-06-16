function moeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function nomeDestino(uf) {
  return uf === "ES" ? "Espírito Santo" : "São Paulo";
}

function preencherMensagemErro(texto) {
  const resultado = document.getElementById("resultado");
  resultado.innerHTML = `<div class="empty"><h2>Dados inválidos</h2><p>${texto}</p></div>`;
}

async function calcular() {
  const destino = document.getElementById("ufDestino").value;
  const valorNota = Number(document.getElementById("valorNota").value);
  const peso = Number(document.getElementById("peso").value);
  const resultado = document.getElementById("resultado");
  const botao = document.getElementById("btnCalcular");

  if (!destino) {
    preencherMensagemErro("Selecione a UF de destino.");
    return;
  }

  if (valorNota <= 0 || Number.isNaN(valorNota)) {
    preencherMensagemErro("Informe um valor de nota fiscal maior que zero.");
    return;
  }

  if (peso <= 0 || Number.isNaN(peso)) {
    preencherMensagemErro("Informe o peso da carga maior que zero.");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Calculando...";

  try {
    const resposta = await fetch("/calcular", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        destino,
        valorNota,
        peso
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      preencherMensagemErro(dados.erro || "Falha ao calcular. Tente novamente.");
      return;
    }

    resultado.innerHTML = `
      <div class="summary">
        <div class="info-card">
          <span>Origem</span>
          <strong>Serra - ES</strong>
        </div>
        <div class="info-card">
          <span>UF destino</span>
          <strong>${nomeDestino(destino)}</strong>
        </div>
        <div class="info-card">
          <span>Peso</span>
          <strong>${peso} KG</strong>
        </div>
      </div>

      <div class="winner">
        <span>Melhor opção</span>
        <h2>${dados.melhorOpcao}</h2>
        <p>Economia estimada: ${moeda(dados.economia)}</p>
        ${dados.sagixAtende ? "" : `<p class="alert">SAGIX não atende a rota selecionada. Use TJB para esta cotação.</p>`}
      </div>

      <div class="table">
        <div class="row head">
          <div>Transportadora</div>
          <div>Status</div>
          <div>Valor</div>
        </div>
        <div class="row">
          <div>SAGIX</div>
          <div class="${dados.sagixAtende ? "ok" : "no"}">
            ${dados.sagixAtende ? "Atende" : "Não atende"}
          </div>
          <div class="value">
            ${dados.sagixAtende ? moeda(dados.valorSagix) : "-"}
          </div>
        </div>
        <div class="row">
          <div>TJB</div>
          <div class="ok">Atende</div>
          <div class="value">${moeda(dados.valorTjb)}</div>
        </div>
      </div>
    `;

    carregarHistorico();

  } catch (erro) {
    resultado.innerHTML = `<div class="empty"><h2>Erro</h2><p>Servidor indisponível no momento.</p></div>`;
  } finally {
    botao.disabled = false;
    botao.textContent = "Calcular Frete";
  }
}

async function carregarHistorico() {
  const historicoLista = document.getElementById("historicoLista");

  try {
    const resposta = await fetch("/historico");
    const historico = await resposta.json();

    if (!historico.length) {
      historicoLista.innerHTML = `<p style="color:#64748b;">Nenhuma cotação realizada ainda.</p>`;
      return;
    }

    historicoLista.innerHTML = historico.slice(0, 6).map(item => `
      <div class="history-item">
        <div><strong>${item.data}</strong></div>
        <div>${item.destino}</div>
        <div>${item.peso} KG</div>
        <div>${moeda(item.valorNota)}</div>
        <div><strong>${item.melhorOpcao}</strong></div>
      </div>
    `).join("");

  } catch (erro) {
    historicoLista.innerHTML = `<p style="color:#991b1b;">Erro ao carregar histórico.</p>`;
  }
}

carregarHistorico();