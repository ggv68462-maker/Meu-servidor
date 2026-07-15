const express = require('express');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const conexoes = {};

// Captura o link que vem do Kodular
app.get('/', (req, res) => {
    // Verifica se a URL do aplicativo contém o ponto de interrogação
    if (req.url.includes('?')) {
        // Pega EXATAMENTE o texto puro que está depois do "?"
        const textoPuro = req.url.split('?')[1];

        if (textoPuro) {
            conexoes[textoPuro] = res;

            // Limpa da memória após 60 segundos se o Termux não responder
            setTimeout(() => {
                if (conexoes[textoPuro]) {
                    conexoes[textoPuro].status(200).send("");
                    delete conexoes[textoPuro];
                }
            }, 60000);
            return;
        }
    }
    res.send("Online");
});

// Entrega a lista com os textos puros para o Termux ler
app.get('/termux/pendentes', (req, res) => {
    res.status(200).json(Object.keys(conexoes));
});

// Remove o comando da memória caso queira limpar manualmente
app.post('/termux/resposta/:chave', (req, res) => {
    const chave = req.params.chave;
    if (conexoes[chave]) {
        conexoes[chave].status(200).send("");
        delete conexoes[chave];
    }
    res.status(200).send("");
});

app.listen(PORT);
