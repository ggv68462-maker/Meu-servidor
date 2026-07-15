const express = require('express');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 10000;
const conexoes = {};

app.get('/', (req, res) => {
    const rawUrl = req.url;
    if (rawUrl.includes('?')) {
        const info = rawUrl.split('?')[1];
        conexoes[info] = res;
        setTimeout(() => {
            if (conexoes[info]) {
                conexoes[info].status(200).send("");
                delete conexoes[info];
            }
        }, 55000);
        return;
    }
    res.send('Ativo');
});

app.get('/termux/pendentes', (req, res) => {
    res.status(200).json(Object.keys(conexoes));
});

app.post('/termux/resposta/:chave', (req, res) => {
    const chave = req.params.chave;
    const resposta = req.body ? req.body.trim() : "";
    if (conexoes[chave]) {
        conexoes[chave].status(200).send(resposta);
        delete conexoes[chave];
        return res.status(200).send("Enviado");
    }
    res.status(404).send("Expirou");
});

app.listen(PORT, '0.0.0.0');
