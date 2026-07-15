const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// O armazenamento se chama estritamente "caixa", exatamente como você pediu
let caixa = {}; 

app.all('*', (req, res) => {
    // Texto puro para o App Inventor receber direto sem erro 701
    res.header("Content-Type", "text/plain; charset=utf-8");

    const urlCompleta = req.url;
    const temInterrogacao = urlCompleta.indexOf('?');

    // Se o link vier sem nada após a interrogação, volta vazio pra não travar
    if (temInterrogacao === -1) return res.send("");

    // Pega tudo que está depois do '?' de forma 100% bruta e decodifica espaços
    const textoBruto = decodeURIComponent(urlCompleta.substring(temInterrogacao + 1)).trim();

    // Captura o ID de forma dinâmica (Ex: ID=8 ou ID=A ou ID=828282)
    const matchId = textoBruto.match(/ID=([^& \s]+)/);
    if (!matchId) return res.send(""); // Se não enviou ID, não faz nada
    
    const id = matchId[1]; // Pega o código do ID (ex: "828282")

    // Pega APENAS a informação que está na frente do ID e dos números/letras
    // Remove "ID=codigo" e qualquer espaço ou caractere grudado na frente
    let informacaoLimpa = textoBruto.replace(/ID=[^& \s]+/, '').trim();
    if (informacaoLimpa.startsWith('&')) informacaoLimpa = informacaoLimpa.substring(1);

    // ==========================================
    // FLUXO DE LEITURA (Se veio SEM informação na frente, quer ler o que está guardado)
    // Exemplo: ://
    // ==========================================
    if (informacaoLimpa === "") {
        const conteudo = caixa[id] ? caixa[id] : "";
        
        // Se o conteúdo já for a resposta final (ou seja, se já foi respondido), apaga da caixa
        if (caixa[id]) {
            delete caixa[id]; // Limpa o espaço imediatamente após o envio
        }
        
        return res.send(conteudo); // Entrega só, só, só a informação limpa pro App correspondente
    }

    // ==========================================
    // FLUXO DE ENVIO (Se veio COM informação na frente, guarda na caixa desse ID)
    // Exemplo do App: :// video.mp4
    // Exemplo do Termux: :// oi tudo bem?
    // ==========================================
    caixa[id] = informacaoLimpa; 
    res.send("Armazenado"); 
});

app.listen(PORT, () => console.log(`Transporte rodando na porta ${PORT}`));
