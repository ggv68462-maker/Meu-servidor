const express = require("express");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

const arquivo = "caixa.txt";


// =========================
// VER CAIXA
// =========================

app.get("/?caixa", (req, res) => {

    if (!fs.existsSync(arquivo)) {
        return res.send("");
    }

    return res.type("text").send(
        fs.readFileSync(arquivo, "utf8")
    );

});



// =========================
// RECEBER MENSAGEM
// =========================

app.get("*", (req, res) => {


    let texto = decodeURIComponent(req.url);


    if (!texto.startsWith("/?")) {
        return res.send("");
    }


    let mensagem = texto.substring(2).trim();



    if (mensagem === "caixa") {
        return res.send("");
    }



    // salva exatamente o que chegou

    fs.appendFileSync(
        arquivo,
        mensagem + "\n",
        "utf8"
    );



    return res.send("Salvo");

});



app.listen(PORT, () => {

    console.log(
        "Servidor iniciado na porta " + PORT
    );

});