const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Gavetas temporárias na memória do Render
let dadosDeA = {}; 
let dadosDeB = {}; 

app.all('*', (req, res) => {
    // Define o cabeçalho como texto puro para o App Inventor não dar erro 701
    res.header("Content-Type", "text/plain; charset=utf-8");

    const urlCompleta = req.url; // Pega tudo a partir da barra '/'
    const temInterrogacao = urlCompleta.indexOf('?');

    // Se o app ou termux chamou o link sem o '?', retorna vazio e não quebra
    if (temInterrogacao === -1) {
        return res.send("");
    }

    // Recorta tudo o que está DEPOIS da interrogação de forma bruta
    const stringBruta = urlCompleta.substring(temInterrogacao + 1);
    
    // Captura o número do ID que veio na string
    const matchId = stringBruta.match(/ID=([^& \s]+)/);
    if (!matchId) return res.send(""); // Se não achou a palavra ID=, ignora
    
    const id = matchId[1];

    // --- IDENTIFICAÇÃO DOS FLUXOS ---

    // 1. SE FOR O TERMUX CONSULTANDO: O termux vai chamar o link com a palavra "ler"
    // Exemplo: https://onrender.com
    if (stringBruta.includes('ler')) {
        return res.json(dadosDeA);
    }

    // 2. SE FOR O TERMUX ENVIANDO A RESPOSTA: O termux coloca "RESPOSTA=" na frente
    // Exemplo: https://onrender.com tudo bem?
    if (stringBruta.includes('RESPOSTA=')) {
        // Apaga a mensagem velha que o A tinha deixado (o Termux já leu e respondeu)
        delete dadosDeA[id];

        // Limpa a resposta: tira o ID e a palavra RESPOSTA= para deixar só o texto puro
        let textoLimpo = stringBruta.replace(/ID=[^& \s]+/, '')
                                    .replace(/RESPOSTA=/, '')
                                    .replace(/&/g, '')
                                    .trim();
        
        // Guarda na gaveta do B para o app buscar
        dadosDeB[id] = decodeURIComponent(textoLimpo); 
        return res.send("Recebido pelo Render");
    }

    // 3. SE FOR O APP TENTANDO PEGAR A RESPOSTA DO TERMUX: O app coloca "buscar" no link
    // Exemplo: https://onrender.com
    if (stringBruta.includes('buscar')) {
        if (dadosDeB[id]) {
            const respostaFinal = dadosDeB[id];
            delete dadosDeB[id]; // Apaga do Render imediatamente após entregar pro App
            return res.send(respostaFinal); // Entrega só o texto limpo de B
        }
        return res.send(""); // Se o Termux ainda não respondeu, volta vazio
    }

    // 4. FLUXO PADRÃO: Se o App enviar os dados direto com o ID
    // Exemplo: https://onrender.com
    dadosDeA[id] = stringBruta;
    delete dadosDeB[id]; // Limpa respostas antigas desse ID

    res.send("Armazenado no Render");
});

app.listen(PORT, () => console.log(`Rodando proxy na porta ${PORT}`));
