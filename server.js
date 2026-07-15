const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta exista no Render
const pastaDados = path.join(__dirname, "dados_caixa");
if (!fs.existsSync(pastaDados)) {
    fs.mkdirSync(pastaDados, { recursive: true });
}

const caminhoCaixa = path.join(pastaDados, "caixa.json");
const caminhoRespostas = path.join(pastaDados, "respostas.json");

const caixa = fs.existsSync(caminhoCaixa) ? JSON.parse(fs.readFileSync(caminhoCaixa, "utf8")) : {};
const respostas = fs.existsSync(caminhoRespostas) ? JSON.parse(fs.readFileSync(caminhoRespostas, "utf8")) : {};

const salvarDados = () => {
    try {
        fs.writeFileSync(caminhoCaixa, JSON.stringify(caixa, null, 2), "utf8");
        fs.writeFileSync(caminhoRespostas, JSON.stringify(respostas, null, 2), "utf8");
    } catch (e) {
        console.error("Erro ao salvar", e);
    }
};

app.get("*", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    const url = decodeURIComponent(req.url).trim();

    // =========================
    // MOSTRAR A CAIXA
    // =========================
    if (url === "/?caixa") {
        return res.json(caixa);
    }

    if (!url.startsWith("/?"))
        return res.send("");

    let texto = url.substring(2).trim();
    texto = texto.replace(/^ID=/i, "");

    // CORREÇÃO DO CORTE: Identifica onde a mensagem começa de verdade
    // Se a mensagem do seu app já começa com parênteses, chaves ou um padrão fixo, cortamos ali.
    // Caso contrário, pegamos o último espaço para isolar o ID completo (ex: "1234 B+") da mensagem.
    const ultimoEspaco = texto.lastIndexOf(" ");

    // =========================
    // APP BUSCANDO RESPOSTA (Não tem espaço separando mensagem)
    // =========================
    if (ultimoEspaco === -1) {
        const id = texto;

        if (!respostas[id])
            return res.send("");

        const resposta = respostas[id];

        delete respostas[id];
        delete caixa[id];
        salvarDados();

        return res.send(resposta);
    }

    // Separa o ID completo da mensagem usando o ponto de corte correto
    const id = texto.substring(0, ultimoEspaco).trim();
    const mensagemPura = texto.substring(ultimoEspaco + 1).trim();

    // Apenas adiciona entre () a mensagem recebida, exatamente como você pediu
    const novaMensagem = `(${mensagemPura})`;

    // =========================
    // SE O ID JÁ EXISTE NA CAIXA, APENAS CONCATENA (COPIA E COLA LADO A LADO)
    // =========================
    if (caixa[id]) {
        respostas[id] = (respostas[id] || "") + novaMensagem;
        caixa[id] = (caixa[id] || "") + novaMensagem;
        
        salvarDados();
        return res.send("Resposta recebida");
    }

    // =========================
    // NOVO PEDIDO DO APP
    // =========================
    caixa[id] = novaMensagem;
    respostas[id] = novaMensagem;
    salvarDados();

    return res.send("Pedido armazenado");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
