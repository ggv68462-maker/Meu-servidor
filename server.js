const express = require("express");

const app = express();

// Aceita texto puro enviado pelo PostText do Kodular
app.use(express.text());

app.post("/video", (req, res) => {

    const comando = req.body.trim();

    console.log("Recebido:", comando);

    // Teste: devolve exatamente o que recebeu
    res.send(comando);

});

app.listen(3000, () => {
    console.log("Servidor online");
});
