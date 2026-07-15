const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Aceita absolutamente qualquer formato de dado no corpo se precisar
app.use(express.raw({ type: '*/*', limit: '50mb' }));

const FILE_PATH = path.join('/tmp', 'mensagens_broker.json');

function lerBanco() {
    if (!fs.existsSync(FILE_PATH)) return { filaA: {}, respostasB: {} };
    try {
        return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    } catch (e) {
        return { filaA: {}, respostasB: {} };
    }
}

function salvarBanco(dados) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(dados, null, 2));
}

// =========================================================================
// INTERCEPTADOR CENTRAL: Aceita qualquer ID variável vindo do Bot no link
// =========================================================================
app.all('/', (req, res) => {
    let dadosBrutosUrl = "";

    // Pega o texto bruto após o "?"
    if (req.url && req.url.includes('?')) {
        dadosBrutosUrl = req.url.substring(req.url.indexOf('?') + 1);
    }

    try {
        dadosBrutosUrl = decodeURIComponent(dadosBrutosUrl.replace(/\+/g, ' '));
    } catch (err) {}

    if (!dadosBrutosUrl && req.body) {
        dadosBrutosUrl = req.body.toString('utf8').trim();
    }

    // Pega qualquer sequência de números que apareça logo após "id="
    const matchId = dadosBrutosUrl.match(/id\s*=\s*(\d+)/i);
    
    if (!matchId) {
        // Se não achou nenhum ID na string, aí não tem como o transporte saber para quem entregar
        console.log(`[A] Erro: Nao foi encontrado nenhum ID no texto recebido.`);
        return res.status(400).send("Erro: ID nao identificado na URL.");
    }
    
    // O ID_VARIAVEL é o número capturado da requisição atual
    const idVariavel = matchId[1]; 
    const banco = lerBanco();
    
    // Guarda o texto público exatamente como veio na URL para o Termux ler
    banco.filaA[idVariavel] = dadosBrutosUrl;
    salvarBanco(banco);
    
    console.log(`[Transporte] Nova mensagem na gaveta do ID: ${idVariavel}`);
    
    // Segura a conexão do Niotron até o Termux responder para esta gaveta específica
    let tentativas = 0;
    const checarResposta = setInterval(() => {
        const bancoAtualizado = lerBanco();
        
        // Quando o Termux colocar uma resposta na gaveta desse ID variável, processa
        if (bancoAtualizado.respostasB[idVariavel]) {
            clearInterval(checarResposta);
            
            const respostaOriginalB = bancoAtualizado.respostasB[idVariavel];
            
            // Remove cirurgicamente a marcação correspondente àquele ID dinâmico
            const regexLimpeza = new RegExp(`id\\s*=\\s*${idVariavel}\\s*`, 'i');
            const respostaLimpa = respostaOriginalB.replace(regexLimpeza, '').trim();
            
            // Limpa as gavetas desse ID específico para liberar espaço
            delete bancoAtualizado.filaA[idVariavel];
            delete bancoAtualizado.respostasB[idVariavel];
            salvarBanco(bancoAtualizado);
            
            console.log(`[Transporte] Repassando info limpa para o ID ${idVariavel}`);
            return res.send(respostaLimpa);
        }
        
        tentativas++;
        if (tentativas > 30) { 
            clearInterval(checarResposta);
            const bancoTimeout = lerBanco();
            delete bancoTimeout.filaA[idVariavel];
            salvarBanco(bancoTimeout);
            return res.status(504).send("Timeout");
        }
    }, 1000);
});

// ==========================================
// 2. TERMUX (B) - PEGA A LISTA DE MENSAGENS
// ==========================================
app.get('/procurar-mensagens', (req, res) => {
    const banco = lerBanco();
    res.setHeader('Content-Type', 'application/json');
    return res.json(banco.filaA);
});

// ==========================================
// 3. TERMUX (B) - DEVOLVE A RESPOSTA DO ID
// ==========================================
app.post('/responder-b', (req, res) => {
    let corpoB = req.body ? req.body.toString('utf8').trim() : "";
    
    try {
        if (corpoB.includes('%') || corpoB.includes('+')) {
            corpoB = decodeURIComponent(corpoB.replace(/\+/g, ' '));
        }
    } catch (e) {}

    // Pega o ID que o Termux incluiu na resposta para saber em qual gaveta colocar
    const matchId = corpoB.match(/id\s*=\s*(\d+)/i);
    
    if (!matchId) {
        return res.status(400).send("Erro: Resposta sem ID informado.");
    }
    
    const idVariavelB = matchId[1];
    const banco = lerBanco();
    
    // Armazena na gaveta do ID correto
    banco.respostasB[idVariavelB] = corpoB;
    salvarBanco(banco);
    
    return res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Broker de transporte ativo na porta ${PORT}`));
