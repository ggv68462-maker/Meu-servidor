const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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
        // Converte as listas internas em texto com parênteses apenas na exibição
        const caixaExibicao = {};
        for (const id in caixa) {
            if (Array.isArray(caixa[id])) {
                caixaExibicao[id] = caixa[id].map(m => `(${m})`).join("");
            } else {
                caixaExibicao[id] = `(${caixa[id]})`;
            }
        }
        return res.json(caixaExibicao);
    }

    if (!url.startsWith("/?"))
        return res.send("");

    let texto = url.substring(2).trim();
    texto = texto.replace(/^ID=/i, "");

    const espaco = texto.indexOf(" ");

    // =========================
    // APP BUSCANDO RESPOSTA
    // =========================
    if (espaco === -1) {
        const id = texto;

        if (!respostas[id])
            return res.send("");

        const listaRespostas = respostas[id];

        delete respostas[id];
        delete caixa[id];

        salvarDados();

        // Entrega as mensagens envelopadas em () lado a lado
        if (Array.isArray(listaRespostas)) {
            return res.send(listaRespostas.map(m => `(${m})`).join(""));
        }
        return res.send(`(${listaRespostas})`);
    }

    const id = texto.substring(0, espaco).trim();
    const mensagem = texto.substring(espaco + 1).trim();

    // =========================
    // SE O ID JÁ EXISTE NA CAIXA, ADICIONA À LISTA PUREZA
    // =========================
    if (caixa[id]) {
        if (!Array.isArray(caixa[id])) {
            caixa[id] = [caixa[id]];
        }
        if (!Array.isArray(respostas[id])) {
            respostas[id] = respostas[id] ? [respostas[id]] : [];
        }

        caixa[id].push(mensagem);
        respostas[id].push(mensagem);
        
        salvarDados();
        return res.send("Resposta recebida");
    }

    // =========================
    // NOVO PEDIDO DO APP
    // =========================
    caixa[id] = [mensagem];
    respostas[id] = [mensagem];
    salvarDados();

    return res.send("Pedido armazenado");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
