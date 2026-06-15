const express = require("express");
const app = express();

app.use(express.json());

let mensagens = [];
let estoque = [];

// STATUS
app.get("/", (req, res) => {
res.send("Servidor online!");
});

// CHAT
app.get("/mensagens", (req, res) => {
res.json(mensagens);
});

app.post("/mensagens", (req, res) => {
mensagens.push(req.body);
res.json({ ok: true });
});

// ESTOQUE
app.get("/estoque", (req, res) => {
res.json(estoque);
});

app.post("/estoque", (req, res) => {
const link = req.body.link;

if (!link) {
return res.status(400).json({
ok: false,
erro: "link não informado"
});
}

const existe = estoque.find(item => item.link === link);

if (!existe) {
estoque.push({
link: link,
data: Date.now()
});
}

res.json({
ok: true,
total: estoque.length
});
});

app.listen(process.env.PORT || 3000);