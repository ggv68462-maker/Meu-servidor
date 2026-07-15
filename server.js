const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta principal de persistência exista no Render
const pastaDados = path.join(__dirname, "dados_caixa");
if (!fs.existsSync(pastaDados)) {
    fs.mkdirSync(pastaDados);
}

// Arquivos para salvar o estado
const caminhoCaixa = path.join(pastaDados, "caixa.json");
const caminhoRespostas = path.join(pastaDados, "respostas.json");

// Inicializa as variáveis lendo dos arquivos (ou cria vazio se não existirem)
const caixa = fs.existsSync(caminhoCaixa) ? JSON.parse(fs.readFileSync(caminhoCaixa)) : {};
const respostas = fs.existsSync(caminhoRespostas) ? JSON.parse(fs.readFileSync(caminhoRespostas)) : {};

// Função auxiliar para salvar o estado atualizado
const salvarDados = () => {
    fs.writeFileSync(caminhoCaixa, JSON.stringify(caixa, null, 2));
    fs.writeFileSync(caminhoRespostas, JSON.stringify(respostas, null, 2));
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
        
        salvarDados(); // Salva após deletar

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
        salvarDados(); // Salva a nova resposta

        return res.send("Resposta recebida");
    }

    // =========================
    // NOVO PEDIDO DO APP
    // =========================
    caixa[id] = mensagem;
    salvarDados(); // Salva o novo pedido

    return res.send("Pedido armazenado");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
