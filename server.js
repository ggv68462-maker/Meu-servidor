const express = require("express");

const app = express();

app.use(express.text());

app.post("/video", (req, res) => {

    const comando = req.body.trim();

    console.log("Recebido:", comando);

    if (!/^B\d+$/.test(comando)) {
        return res.status(400).send("Comando inválido");
    }

    res.send("OK:" + comando);

});

app.listen(process.env.PORT || 3000, () => {
    console.log("Servidor online");
});
