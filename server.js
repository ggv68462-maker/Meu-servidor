const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta principal exista no Render
const pastaDados = path.join(__dirname, "dados_caixa");
if (!fs.existsSync(pastaDados)) {
    fs.mkdirSync(pastaDados, { recursive: true });
}

// Arquivos para salvar as variáveis locais
const caminhoCaixa = path.join(pastaDados, "caixa.json");
const caminhoRespostas = path.join(pastaDados, "respostas.json");

// Inicializa lendo dos arquivos ou cria objetos vazios
let caixa = fs.existsSync(caminhoCaixa) ? JSON.parse(fs.readFileSync(caminhoCaixa, "utf8")) : {};
let respostas = fs.existsSync(caminhoRespostas) ? JSON.parse(fs.readFileSync(caminhoRespostas, "utf8")) : {};

// Função simples para salvar o estado atualizado
const salvarDados = () => {
    try {
        fs.writeFileSync(caminhoCaixa, JSON.stringify(caixa, null, 2), "utf8");
        fs.writeFileSync(caminhoRespostas, JSON.stringify(respostas, null, 2), "utf8");
    } catch (e) {
        console.error("Erro ao salvar arquivos", e);
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

    const texto = url.substring(2).trim();

    // REGEX PERFEITA: Captura tudo que estiver antes da mensagem como ID de forma exata
    // Exemplo: se o texto for "ID=1234 B+ mensagem_aqui", o ID isolado será "ID=1234 B+"
    const correspondencia = texto.match(/^(.+?)\s+(.+)$/);

    // =========================
    // APP BUSCANDO RESPOSTA (Não tem espaço separando mensagem)
    // Ex.: /?1234 ou /?ID=1234 B+
    // =========================
    if (!correspondencia) {
        const id = texto.replace(/^ID=/i, "").trim();

        if (!respostas[id])
            return res.send("");

        const resposta = respostas[id];

        delete respostas[id];
        delete caixa[id];

        salvarDados();

        return res.send(resposta);
    }

    // Extrai o ID e a mensagem de forma estrita usando a Regex
    const idBruto = correspondencia[1].trim();
    const id = idBruto.replace(/^ID=/i, "").trim(); // Remove o "ID=" apenas para o índice interno
    const mensagem = correspondencia[2].trim();

    // =========================
    // SE O ID JÁ EXISTE NA CAIXA, ATUALIZA A RESPOSTA (SEM SOMAR OU MULTIPLICAR)
    // =========================
    if (caixa[id]) {
        respostas[id] = mensagem;
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
