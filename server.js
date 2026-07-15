const express = require('express');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 10000;
const conexoes = {};

app.get('/', (req, res) => {
    const rawUrl = req.url;
    
    if (rawUrl.includes('?')) {
        const chaveIdentificadora = rawUrl.split('?')[1];
        
        conexoes[chaveIdentificadora] = res;
        
        setTimeout(() => {
            if (conexoes[chaveIdentificadora]) {
                conexoes[chaveIdentificadora].status(200).send(""); 
                delete conexoes[chaveIdentificadora];
            }
        }, 55000);
        return;
    }
    
    res.send('Ativo');
});

app.get('/termux/pendentes', (req, res) => {
    return res.status(200).json(Object.keys(conexoes));
});

app.post('/termux/resposta/:chave', (req, res) => {
    const chaveIdentificadora = req.params.chave;
    const linkDoVideo = req.body ? req.body.trim() : "";

    if (conexoes[chaveIdentificadora]) {
        conexoes[chaveIdentificadora].status(200).send(linkDoVideo);
        delete conexoes[chaveIdentificadora];
        return res.status(200).send("Enviado");
    }
    return res.status(404).send("Expirou");
});

app.listen(PORT, '0.0.0.0');
