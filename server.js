const express = require("express");
const app = express();

app.use(express.json());

let mensagens = [];

app.get("/", (req, res) => {
  res.send("Servidor online!");
});

app.get("/mensagens", (req, res) => {
  res.json(mensagens);
});

app.post("/mensagens", (req, res) => {
  mensagens.push(req.body);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000);
