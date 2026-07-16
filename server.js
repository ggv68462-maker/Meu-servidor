const express = require('express');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
let conexoes = {};

// Captura o link vindo do Kodular
app.get('/', (req, res) => {
    if (req.url.includes('?')) {
        const textoPuro = req.url.split('?')[1]; // Pega só o que vem depois do "?"

        if (textoPuro && textoPuro.trim() !== "") {
            conexoes[textoPuro] = res;

            // Limpa após 60 segundos por segurança se o Termux sumir
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

// O Termux lê aqui. No momento em que ele lê, o servidor entrega e JÁ APAGA da memória!
app.get('/termux/pendentes', (req, res) => {
    const listaAtual = Object.keys(conexoes);
    
    // Responde para o Termux
    res.status(200).json(listaAtual);

    // Destrava os aplicativos em segundo plano enviando resposta vazia
    listaAtual.forEach(chave => {
        if (conexoes[chave]) {
            conexoes[chave].status(200).send("");
        }
    });

    // Zera a memória RAM na hora para a próxima leitura vir limpa
    conexoes = {};
});

app.listen(PORT);
