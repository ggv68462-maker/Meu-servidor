const express = require("express");
const { exec } = require("child_process");

const app = express();

app.use(express.json());

app.post("/video", (req, res) => {

    const comando = req.body.comando;

    exec(
        `echo "${comando}" | bash /data/data/com.termux/files/home/estoque.sh`,
        (erro, stdout) => {

            if (erro) {
                return res.status(500).send("erro");
            }

            res.send(stdout.trim());
        }
    );
});

app.listen(3000, () => {
    console.log("Servidor online");
});
