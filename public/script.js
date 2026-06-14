function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function nomeDestino(uf) {
    return uf === "ES" ? "Espírito Santo" : "São Paulo";
}

async function calcular() {
    const destino = document.getElementById("ufDestino").value;
    const valorNota = Number(document.getElementById("valorNota").value);
    const peso = Number(document.getElementById("peso").value);
    const resultado = document.getElementById("resultado");

    if (!destino || valorNota <= 0 || peso <= 0) {
        resultado.innerHTML = `
            <div class="alerta">
                Preencha todos os campos corretamente.
            </div>
        `;
        return;
    }

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

        resultado.innerHTML = `
            <div class="resumo">
                <div class="card-info">
                    <span>Origem</span>
                    <strong>Serra - ES</strong>
                </div>

                <div class="card-info">
                    <span>UF destino</span>
                    <strong>${nomeDestino(destino)}</strong>
                </div>

                <div class="card-info">
                    <span>Peso</span>
                    <strong>${peso} KG</strong>
                </div>
            </div>

            <div class="vencedor">
                <span>Melhor opção</span>
                <h2>${dados.melhorOpcao}</h2>
                <p>Economia estimada: ${moeda(dados.economia)}</p>
            </div>

            <div class="tabela">
                <div class="linha-tabela cabecalho">
                    <div>Transportadora</div>
                    <div>Status</div>
                    <div>Valor</div>
                </div>

                <div class="linha-tabela">
                    <div>SAGIX</div>
                    <div class="${dados.sagixAtende ? "status-ok" : "status-nao"}">
                        ${dados.sagixAtende ? "Atende" : "Não atende"}
                    </div>
                    <div class="valor">
                        ${dados.sagixAtende ? moeda(dados.valorSagix) : "-"}
                    </div>
                </div>

                <div class="linha-tabela">
                    <div>TJB</div>
                    <div class="status-ok">Atende</div>
                    <div class="valor">${moeda(dados.valorTjb)}</div>
                </div>
            </div>
        `;

        carregarHistorico();

    } catch (erro) {
        resultado.innerHTML = `
            <div class="alerta">
                Erro ao conectar com o servidor Node.js.
            </div>
        `;

        console.error(erro);
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
            <div class="historico-item">
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