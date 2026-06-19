const express = require('express');
const app = express();

app.use(express.json());

// Memória temporária para armazenar a lista vinda do Termux
let bancoEstoque = [];

app.get("/", (req, res) => {
    res.send("Servidor central online!");
});

// Rota onde o Termux envia a lista com códigos e links
app.post("/atualizar-estoque", (req, res) => {
    const { itens } = req.body;
    if (!itens || !Array.isArray(itens)) {
        return res.status(400).json({ OK: false, erro: "Formato de dados inválido" });
    }
    bancoEstoque = itens;
    console.log(`Estoque atualizado pelo Termux. Total de itens: ${bancoEstoque.length}`);
    res.json({ OK: true, total: bancoEstoque.length });
});

// Rota onde o aplicativo solicita o link enviando o código por parâmetro (ex: /obter-link?codigo=B1)
app.get("/obter-link", (req, res) => {
    const codigoBuscado = req.query.codigo;
    
    if (!codigoBuscado) {
        return res.status(400).json({ OK: false, erro: "Código não informado" });
    }

    const itemEncontrado = bancoEstoque.find(item => item.codigo.toUpperCase() === codigoBuscado.toUpperCase());

    if (!itemEncontrado) {
        return res.status(404).json({ OK: false, erro: "Código não localizado no estoque atual" });
    }

    // Retorna a URL direta do vídeo para o aplicativo efetuar o download
    res.json({ OK: true, link: itemEncontrado.link, nome: itemEncontrado.nome });
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Servidor central rodando com sucesso.");
});
