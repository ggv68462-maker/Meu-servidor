const express = require("express");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

const arquivo = "caixa.txt";


// =========================
// MOSTRAR CAIXA
// =========================

app.get("/", (req, res) => {

    let url = decodeURIComponent(req.url).trim();


    if (url === "/?caixa") {

        if (!fs.existsSync(arquivo)) {
            return res.send("");
        }

        return res
            .type("text")
            .send(fs.readFileSync(arquivo, "utf8"));
    }



    if (!url.startsWith("/?")) {
        return res.send("");
    }



    // pega somente o que veio depois do ?
    let mensagem = url.substring(2);



    if (!mensagem) {
        return res.send("");
    }



    // salva exatamente o que recebeu
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