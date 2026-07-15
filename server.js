const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Armazenamento temporário em memória
const mensagens = {};

// Captura tudo que entra na raiz ://meurender.com?...
app.get('/', (req, res) => {
    // Pega a string inteira depois do "?" da URL
    const urlCompleta = req.url.split('?')[1];

    if (!urlCompleta) {
        return res.status(400).send('Nenhum dado enviado.');
    }

    // Decodifica caracteres especiais da URL (ex: %20 vira espaço)
    const dadosBrutos = decodeURIComponent(urlCompleta);

    // Se a URL contém "checar", o Termux está lendo a mensagem de A
    if (dadosBrutos.startsWith('checar=')) {
        const idProcurado = dadosBrutos.replace('checar=', '').trim();
        if (mensagens[idProcurado]) {
            return res.send(mensagens[idProcurado].msgDeA);
        }
        return res.send('Nenhuma mensagem.');
    }

    // Se a URL contém "buscar", o Componente A está pegando a resposta final de B
    if (dadosBrutos.startsWith('buscar=')) {
        const idProcurado = dadosBrutos.replace('buscar=', '').trim();
        if (mensagens[idProcurado] && mensagens[idProcurado].respostaDeB) {
            const respostaFinal = mensagens[idProcurado].respostaDeB;
            delete mensagens[idProcurado]; // Apaga tudo da memória imediatamente
            return res.send(respostaFinal); // Retorna a informação pura, sem ID
        }
        return res.send('Aguardando...');
    }

    // Identifica o ID da mensagem (procura por "Id=" ou "id=")
    const matchId = dadosBrutos.match(/id=(\d+)/i);
    if (!matchId) {
        return res.status(400).send('ID nao encontrado na URL.');
    }

    const id = matchId[1];

    // Se o registro para esse ID já existe, significa que o Termux (B) está respondendo
    if (mensagens[id]) {
        // Remove a parte do "Id=12345" e pega apenas o texto limpo da frente
        const textoLimpoB = dadosBrutos.replace(new RegExp(`id=${id}`, 'i'), '').trim();
        
        mensagens[id].respostaDeB = textoLimpoB;
        mensagens[id].msgDeA = null; // Apaga a mensagem original de A
        return res.send('Resposta processada.');
    } 
    
    // Se o registro NÃO existe, é o Componente A enviando dados novos
    else {
        // Armazena a string bruta exatamente como veio de A
        mensagens[id] = { msgDeA: dadosBrutos, respostaDeB: null };
        return res.send('Mensagem guardada.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
