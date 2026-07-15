const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Pedidos aguardando resposta
const caixa = {};

// Respostas prontas para o app
const respostas = {};

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

        return res.send("Resposta recebida");
    }

    // =========================
    // NOVO PEDIDO DO APP
    // =========================
    caixa[id] = mensagem;

    return res.send("Pedido armazenado");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});