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

// Gravação síncrona segura no arquivo
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
        return res.json(caixa);
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

        const resposta = respostas[id];

        delete respostas[id];
        delete caixa[id];

        salvarDados();

        // Retorna todas as mensagens juntas, cada uma no seu próprio ()
        return res.send(resposta);
    }

    const id = texto.substring(0, espaco).trim();
    const mensagem = texto.substring(espaco + 1).trim();

    // Formata a mensagem envolvendo-a entre parênteses
    const mensagemFormatada = `(${mensagem})`;

    // =========================
    // SE O ID JÁ EXISTE NA CAIXA, ACUMULA
    // =========================
    if (caixa[id]) {
        // Concatena a nova mensagem formatada ao final da string existente
        respostas[id] = (respostas[id] || "") + mensagemFormatada;
        
        // Também atualiza na caixa para você ver pelo /?caixa
        caixa[id] = (caixa[id] || "") + mensagemFormatada;
        
        salvarDados();

        return res.send("Resposta recebida");
    }

    // =========================
    // NOVO PEDIDO DO APP
    // =========================
    caixa[id] = mensagemFormatada;
    respostas[id] = mensagemFormatada;
    salvarDados();

    return res.send("Pedido armazenado");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
