const express = require("express");

const app = express();

// aceita textos grandes (Base64)
app.use(express.json({ limit: "500mb" }));

let armazenamento = null;

// Receber e guardar o texto
app.post("/guardar", (req, res) => {
    const texto = req.body.texto;

    if (!texto) {
        return res.status(400).send("Texto vazio");
    }

    armazenamento = texto;

    console.log("Texto armazenado:", texto.length, "caracteres");

    res.send("OK - texto guardado");
});


// Termux pega o texto
app.get("/pegar", (req, res) => {

    if (armazenamento === null) {
        return res.status(404).send("Nenhum texto disponível");
    }

    res.send(armazenamento);
});


// Confirmar recebimento e apagar
app.post("/confirmar", (req, res) => {

    if (req.body.status === "ok") {

        armazenamento = null;

        console.log("Texto apagado");

        return res.send("OK - apagado");
    }

    res.status(400).send("Envie status: ok");
});


// Ver se tem algo guardado
app.get("/status", (req, res) => {

    if (armazenamento) {
        res.json({
            disponivel: true,
            tamanho: armazenamento.length
        });
    } else {
        res.json({
            disponivel: false
        });
    }

});


app.listen(3000, () => {
    console.log("Servidor iniciado na porta 3000");
});