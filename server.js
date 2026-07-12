const express = require("express");
const app = express();

// Aumenta o limite para aguentar o textão do Base64 das imagens
app.use(express.text({ limit: "500mb" }));

// Mudamos para um Array (lista) para conseguir guardar várias imagens ao mesmo tempo
let caixaTemporaria = [];

// Recebe o texto Base64 do aplicativo móvel
app.post("/guardar", (req, res) => {
    const base64Data = req.body;

    if (!base64Data) {
        return res.status(400).send("Nenhum dado recebido");
    }

    // .push() adiciona a nova imagem no final da lista sem apagar as outras
    caixaTemporaria.push(base64Data);

    console.log(`========== NOVA IMAGEM SALVA (Total: ${caixaTemporaria.length}) ==========`);
    // Mostra só os primeiros 50 caracteres no terminal para não travar o log do Render
    console.log(base64Data.substring(0, 50) + "..."); 
    console.log("=================================================");

    res.send("Imagem recebida com sucesso!");
});

// Envia a lista com todas as imagens salvas para quem pedir (retorna em formato JSON)
app.get("/pegar", (req, res) => {
    if (caixaTemporaria.length === 0) {
        return res.send("vazio");
    }

    // Retorna a lista completa com todas as strings Base64
    res.json(caixaTemporaria);
});

// Apaga todas as imagens da memória
app.get("/apagar", (req, res) => {
    caixaTemporaria = []; // Esvazia a lista

    console.log("Todas as imagens foram apagadas da memória");
    res.send("ok");
});

// Porta padrão para o Render funcionar (ele usa a variável process.env.PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
