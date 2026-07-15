const express = require('express');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const conexoes = {};

// Captura a URL bruta que vem do Kodular
app.get('/', (req, res) => {
    const textoBruto = req.url.split('?')[1];

    if (textoBruto) {
        conexoes[textoBruto] = res;

        setTimeout(() => {
            if (conexoes[textoBruto]) {
                conexoes[textoBruto].status(200).send("");
                delete conexoes[textoBruto];
            }
        }, 60000);
        return;
    }
    res.send("Online");
});

// Entrega a lista para o Termux
app.get('/termux/pendentes', (req, res) => {
    res.status(200).json(Object.keys(conexoes));
});

// Recebe do Termux e repassa ao App
app.post('/termux/resposta/:chave', (req, res) => {
    const chave = req.params.chave;
    const conteudo = req.body;

    if (conexoes[chave]) {
        conexoes[chave].status(200).send(conteudo);
        delete conexoes[chave];
    }
    res.status(200).send("");
});

app.listen(PORT);
