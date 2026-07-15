const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Permite receber textos puros nas requisições
app.use(express.text());
app.use(express.json());

// Banco de dados temporário em memória
const buffer = {};

/**
 * 1. COMPONENTE A ENVIANDO DADOS
 * O link termina com ? seguido do ID e da mensagem.
 * Exemplo de URL que o A vai chamar: /enviar?ID=82828282 oi
 */
app.all('/enviar', (req, res) => {
    // Pega tudo que está depois do "?" na URL
    const urlParts = req.url.split('?');
    if (urlParts.length < 2) {
        return res.status(400).send("Formato inválido. Use ?ID=codigo mensagem");
    }

    const queryCompleta = decodeURIComponent(urlParts[1]);

    // Extrai o ID e o Conteúdo usando Regex (pega o que está entre 'ID=' e o primeiro espaço)
    const match = queryCompleta.match(/^ID=(\S+)\s+(.*)$/);

    if (!match) {
        return res.status(400).send("ID não encontrado no formato correto.");
    }

    const id = match[1];
    const mensagem = match[2];

    // Armazena no buffer público para o Termux (B) buscar
    buffer[id] = {
        mensagemDeA: mensagem,
        respostaDeB: null,
        status: 'aguardando_b'
    };

    // Mantém a conexão do Componente A aberta (Long Polling) até B responder
    const checarResposta = setInterval(() => {
        if (buffer[id] && buffer[id].status === 'respondido') {
            const respostaFinal = buffer[id].respostaDeB;
            
            clearInterval(checarResposta);
            delete buffer[id]; // Apaga tudo do mapa após enviar para o app A
            
            return res.send(respostaFinal);
        }
        
        // Timeout de segurança após 2 minutos para não travar o servidor
    }, 1000);
    
    req.on('close', () => clearInterval(checarResposta));
});

/**
 * 2. TERMUX (B) CONSULTA MENSAGENS PÚBLICAS
 * O Termux bate aqui para ver o que tem na fila para processar.
 */
app.get('/fila', (req, res) => {
    res.json(buffer);
});

/**
 * 3. TERMUX (B) DEVOLVE A RESPOSTA
 * Exemplo de corpo da requisição (texto plano): ID=82828282 oi tudo bem?
 */
app.post('/resposta', (express.text({ type: '*/*' })), (req, res) => {
    const corpo = req.body.trim();
    
    // Extrai o ID e o resto do texto que veio do Termux
    const match = corpo.match(/^ID=(\S+)\s+(.*)$/);
    
    if (!match) {
        return res.status(400).send("Formato da resposta inválido.");
    }
    
    const id = match[1];
    const informacaoPura = match[2]; // Removeu o ID, sobrou só a informação

    if (buffer[id]) {
        // Alimenta o buffer com a informação limpa e muda o status
        buffer[id].respostaDeB = informacaoPura;
        buffer[id].status = 'respondido';
        
        return res.send("Sucesso. Repassado para o usuário e apagado.");
    } else {
        return res.status(404).send("Esse ID não existe mais ou expirou.");
    }
});

app.listen(PORT, () => {
    console.log(`Transporte rodando na porta ${PORT}`);
});
