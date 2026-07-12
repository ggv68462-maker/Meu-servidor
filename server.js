const express = require("express");

const app = express();

app.use(express.text({ limit: "500mb" }));

let caixaTemporaria = "";

// Recebe qualquer texto
app.post("/guardar", (req, res) => {
    caixaTemporaria = req.body;

    console.log("Recebido:", caixaTemporaria.length, "caracteres");

    res.send("guardado");
});


// Termux pega
app.get("/pegar", (req, res) => {
    if (caixaTemporaria === "") {
        return res.send("vazio");
    }

    res.send(caixaTemporaria);
});


// Apaga
app.get("/apagar", (req, res) => {
    caixaTemporaria = "";

    console.log("apagado");

    res.send("ok");
});


// Ver tamanho
app.get("/status", (req, res) => {
    res.send(String(caixaTemporaria.length));
});


app.listen(3000, () => {
    console.log("Servidor online");
});