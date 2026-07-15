const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Pasta de persistência no Render
const pastaDados = path.join(__dirname, "dados_caixa");
if (!fs.existsSync(pastaDados)) {
    fs.mkdirSync(pastaDados, { recursive: true });
}

const caminhoCaixa = path.join(pastaDados, "caixa.json");
const caminhoRespostas = path.join(pastaDados, "respostas.json");

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
    caixa = {};
    respostas = {};
}

const salvarDados = () => {
    try {
        fs.writeFileSync(caminhoCaixa, JSON.stringify(caixa, null, 2), "utf8");
        fs.writeFileSync(caminhoRespostas, JSON.stringify(respostas, null, 2), "utf8");
    } catch (erro) {
        console.error("Erro ao gravar arquivos:", erro);
    }
};

app.get("*", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    const url = decodeURIComponent(req.url).trim();

    // =========================
    // MOSTRAR A CAIXA
    // =========================
    if (url === "/?caixa") {
        const caixaExibicao = {};
        for (const id in caixa) {
            // Separa as mensagens guardadas por quebra de linha e envelopa cada uma em ()
            const linhas = caixa[id].split("\n");
            caixaExibicao[id] = linhas.map(m => `(${m})`).join("");
        }
        return res.json(caixaExibicao);
    }

    if (!url.startsWith("/?"))
        return res.send("");

    const textoBruto = url.substring(2).trim();

    // Captura o ID completo antes do último bloco de mensagem
    // Ex: "ID=1234 B+ Mensagem Aqui" -> ID: "1234 B+", Mensagem: "Mensagem Aqui"
    const regexSeparador = /^ID=(.+?)\s+(.+)$/i;
    const correspondencia = textoBruto.match(regexSeparador);

    // =========================
    // APP BUSCANDO RESPOSTA (Busca por ID exato, sem mensagem junto)
    // =========================
    if (!correspondencia) {
        const id = textoBruto.replace(/^ID=/i, "").trim();

        if (!respostas[id])
            return res.send("");

        const todasRespostas = respostas[id].split("\n").map(m => `(${m})`).join("");

        delete respostas[id];
        delete caixa[id];
        salvarDados();

        return res.send(todasRespostas);
    }

    const id = correspondencia[1].trim();
    const mensagem = correspondencia[2].trim();

    // =========================
    // SE O ID JÁ EXISTE NA CAIXA, ADICIONA MAIS UMA MENSAGEM
    // =========================
    if (caixa[id]) {
        // Guarda internamente separando por quebra de linha (\n) para não misturar as variáveis
        caixa[id] = caixa[id] + "\n" + mensagem;
        respostas[id] = respostas[id] + "\n" + mensaje;
        
        salvarDados();
        return res.send("Resposta recebida");
    }

    // =========================
    // NOVO PEDIDO DO APP
    // =========================
    caixa[id] = mensagem;
    respostas[id] = mensagem;
    salvarDados();

    return res.send("Pedido armazenado");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
