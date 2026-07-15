const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta principal de persistência exista no Render
const pastaDados = path.join(__dirname, "dados_caixa");
if (!fs.existsSync(pastaDados)) {
    fs.mkdirSync(pastaDados, { recursive: true });
}

// Caminho dos arquivos JSON
const caminhoCaixa = path.join(pastaDados, "caixa.json");
const caminhoRespostas = path.join(pastaDados, "respostas.json");

// Inicializa as variáveis lendo com segurança (ou cria objeto vazio)
let caixa = {};
let respostas = {};

try {
    if (fs.existsSync(caminhoCaixa)) {
        caixa = JSON.parse(fs.readFileSync(caminhoCaixa, "utf8")) || {};
    }
    if (fs.existsSync(caminhoRespostas)) {
        respostas = JSON.parse(fs.readFileSync(caminhoRespostas, "utf8")) || {};
    }
} catch (e) {
    console.error("Erro ao ler arquivos iniciais, iniciando vazio:", e);
    caixa = {};
    respostas = {};
}

// Função síncrona blindada para salvar o estado atualizado imediatamente
const salvarDados = () => {
    try {
        fs.writeFileSync(caminhoCaixa, JSON.stringify(caixa, null, 2), "utf8");
        fs.writeFileSync(caminhoRespostas, JSON.stringify(respostas, null, 2), "utf8");
    } catch (erro) {
        console.error("Erro crítico ao gravar arquivos no disco:", erro);
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

    const espaco = texto.indexOf(" ");

    // =========================
    // APP BUSCANDO RESPOSTA
    // Ex.: /?ID=123
    // =========================
    if (espaco === -1) {

        const id = texto;

        if (!respostas[id])
            return res.send("");

        const resposta = respostas[id];

        delete respostas[id];
        delete caixa[id];

        salvarDados(); // Grava a remoção no arquivo imediatamente

        // O APP RECEBE APENAS ISSO
        return res.send(resposta);
    }

    const id = texto.substring(0, espaco).trim();
    const mensagem = texto.substring(espaco + 1).trim();

    // =========================
    // SE O ID JÁ EXISTE NA CAIXA,
    // ISSO É UMA RESPOSTA
    // =========================
    if (caixa[id]) {

        respostas[id] = mensagem;
        salvarDados(); // Grava a nova resposta recebida no arquivo

        return res.send("Resposta recebida");
    }

    // =========================
    // NOVO PEDIDO DO APP
    // =========================
    caixa[id] = mensagem;
    salvarDados(); // Grava o novo pedido na caixa do arquivo

    return res.send("Pedido armazenado");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
