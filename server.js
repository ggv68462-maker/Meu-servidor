const express = require("express");

const app = express();

app.use(express.text({ limit: "500mb" }));

let caixaTemporaria = "";

// Recebe o código/texto
app.post("/guardar", (req, res) => {

    caixaTemporaria = req.body;

    console.log("========== NOVO CÓDIGO ==========");
    console.log(caixaTemporaria);
    console.log("=================================");

    res.send("Código recebido");

});


// Enviar para quem pedir
app.get("/pegar", (req, res) => {

    if (caixaTemporaria === "") {
        return res.send("vazio");
    }

    res.send(caixaTemporaria);

});


// Apagar
app.get("/apagar", (req, res) => {

    caixaTemporaria = "";

    console.log("Código apagado");

    res.send("ok");

});


app.listen(3000, () => {
    console.log("Servidor iniciado");
});