const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Armazenamento temporário na memória do Render
let dadosDeA = {}; // Guarda o que o Termux vai ler
let dadosDeB = {}; // Guarda o que o App vai ler

// 1. APP (A) ENVIA TUDO DEPOIS DO '?'
// O App chama: https://onrender.com
app.all('/salvarA', (req, res) => {
    const urlCompleta = req.url;
    const temInterrogacao = urlCompleta.indexOf('?');

    if (temInterrogacao === -1) return res.send("Sem dados");

    // Pega absolutamente TUDO que está depois do '?'
    const stringBruta = urlCompleta.substring(temInterrogacao + 1);
    
    // Procura o ID na string (ex: ID=828282) para saber onde guardar
    const matchId = stringBruta.match(/ID=([^& \s]+)/);
    if (!matchId) return res.send("ID nao encontrado");
    
    const id = matchId[1];

    // Guarda a informação bruta de A
    dadosDeA[id] = stringBruta;
    delete dadosDeB[id]; // Limpa histórico antigo se houver

    res.send("Armazenado");
});

// 2. TERMUX (B) COLETA O QUE A MANDOU
app.get('/lerParaTermux', (req, res) => {
    res.json(dadosDeA);
});

// 3. TERMUX (B) RESPONDE DEVOLVENDO TUDO DEPOIS DO '?'
// O Termux chama: https://onrender.com tudo bem?
app.all('/salvarB', (req, res) => {
    const urlCompleta = req.url;
    const temInterrogacao = urlCompleta.indexOf('?');

    if (temInterrogacao === -1) return res.send("Sem dados");

    const stringBruta = urlCompleta.substring(temInterrogacao + 1);
    
    const matchId = stringBruta.match(/ID=([^& \s]+)/);
    if (!matchId) return res.send("ID nao encontrado");
    
    const id = matchId[1];

    // 1. APAGA a mensagem que o A tinha mandado (o Termux já leu)
    delete dadosDeA[id];

    // 2. Tira o ID da resposta para o App receber apenas a informação limpa
    // Remove "ID=XXXXXX" e qualquer caractere que sobrou grudado
    let informacaoLimpa = stringBruta.replace(/ID=[^& \s]+/, '').trim();
    if (informacaoLimpa.startsWith('&')) informacaoLimpa = informacaoLimpa.substring(1);

    // 3. Armazena temporariamente para o App pegar
    dadosDeB[id] = informacaoLimpa;

    res.send("Recebido");
});

// 4. APP (A) PEGA A INFORMAÇÃO LIMPA SEM O ID
// O App chama: https://onrender.com
app.get('/pegarResposta', (req, res) => {
    const urlCompleta = req.url;
    const matchId = urlCompleta.match(/ID=([^& \s]+)/);
    
    if (!matchId) return res.send("");
    const id = matchId[1];

    if (dadosDeB[id]) {
        const respostaFinal = dadosDeB[id];
        
        // APAGA a resposta do B do Render imediatamente após enviar pro App
        delete dadosDeB[id]; 
        
        return res.send(respostaFinal); // Envia só o texto limpo
    }

    res.send(""); // Se B não respondeu ainda, volta vazio
});

app.listen(PORT, () => console.log(`Rodando proxy na porta ${PORT}`));
