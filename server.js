const express = require('express');
const app = express();

app.use(express.text({ type: '/' }));

const conexoes = {};

// App A envia: URL deve ser /enviar/ID_DO_CANAL (Ex: /enviar/12345)
app.post('/enviar/:id', (req, res) => {
const id = req.params.id;

conexoes[id] = res;  

setTimeout(() => {  
    if (conexoes[id]) {  
        conexoes[id].status(200).send("Timeout");  
        delete conexoes[id];  
    }  
}, 60000);

});

// Ponta B responde: URL deve ser /responder/ID_DO_CANAL (Ex: /responder/12345)
app.post('/responder/:id', (req, res) => {
const id = req.params.id;
const resposta = req.body ? req.body.trim() : "";

if (conexoes[id]) {  
    conexoes[id].status(200).send(resposta);  
    delete conexoes[id];  
    return res.status(200).send("Enviado");  
}  
return res.status(404).send("Sem canal");

});

app.listen(3000);