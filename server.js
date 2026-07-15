const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// O armazenamento temporário em memória
let caixa = {}; 

// NOVO: Se acessar /caixa, o Render entrega tudo o que está guardado nela de forma pública
app.get('/caixa', (req, res) => {
    res.header("Content-Type", "application/json; charset=utf-8");
    return res.json(caixa);
});

// Mantém o resto do transporte bruto exatamente igual para o App e o Termux
app.all('*', (req, res) => {
    res.header("Content-Type", "text/plain; charset=utf-8");

    const urlCompleta = req.url;
    const temInterrogacao = urlCompleta.indexOf('?');

    if (temInterrogacao === -1) return res.send("");

    const textoBruto = decodeURIComponent(urlCompleta.substring(temInterrogacao + 1)).trim();

    const matchId = textoBruto.match(/ID=([^& \s]+)/);
    if (!matchId) return res.send(""); 
    
    const id = matchId; 

    let informacaoLimpa = textoBruto.replace(/ID=[^& \s]+/, '').trim();
    if (informacaoLimpa.startsWith('&')) informacaoLimpa = informacaoLimpa.substring(1);

    // FLUXO DE LEITURA (Se veio SEM informação na frente, entrega pro App e apaga)
    if (informacaoLimpa === "") {
        const conteudo = caixa[id] ? caixa[id] : "";
        if (caixa[id]) {
            delete caixa[id]; // Limpa espaço após enviar pro app correspondente
        }
        return res.send(conteudo); 
    }

    // FLUXO DE ENVIO (Guarda o texto limpo associado ao ID)
    caixa[id] = informacaoLimpa; 
    res.send("Armazenado"); 
});

app.listen(PORT, () => console.log(`Transporte rodando na porta ${PORT}`));
