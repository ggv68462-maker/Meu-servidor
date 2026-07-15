const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Permite receber dados brutos em qualquer formato por precaução
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
// INTERCEPTADOR CENTRAL: Escuta a rota raiz (/) e trata o disparo "?ID=..."
// =========================================================================
app.all('/', (req, res) => {
    let dadosBrutosUrl = "";

    // Captura exatamente a string crua da URL após o caractere "?"
    if (req.url && req.url.includes('?')) {
        // Divide no primeiro "?" e pega tudo o que está à direita
        dadosBrutosUrl = req.url.substring(req.url.indexOf('?') + 1);
    }

    // Decodifica caracteres especiais da URL (converte %3D para =, + para espaço, etc.)
    try {
        dadosBrutosUrl = decodeURIComponent(dadosBrutosUrl.replace(/\+/g, ' '));
    } catch (err) {
        // Mantém o texto bruto se houver falha na conversão
    }

    // Se por acaso a URL veio sem nada após o "?", tenta ler o corpo como plano B
    if (!dadosBrutosUrl && req.body) {
        dadosBrutosUrl = req.body.toString('utf8').trim();
    }

    if (!dadosBrutosUrl) {
        return res.status(400).send("Erro: Nenhuma informacao foi localizada apos o '?' na URL.");
    }

    // Procura pela estrutura ID=XXXXX usando expressão regular flexível
    const matchId = dadosBrutosUrl.match(/id\s*=\s*(\d+)/i);
    
    if (!matchId) {
        console.log(`[A - ERRO] Texto capturado sem ID valido na URL: "${dadosBrutosUrl}"`);
        return res.status(400).send("Erro: ID de usuario nao localizado na string da URL.");
    }
    
    const idCodigo = matchId[1]; // Isola apenas os números do ID capturado
    const banco = lerBanco();
    
    // Armazena a informação da URL de forma pública para o Termux
    banco.filaA[idCodigo] = dadosBrutosUrl;
    salvarBanco(banco);
    
    console.log(`[A - SUCESSO] ID ${idCodigo} detectado na raiz. Conteudo: "${dadosBrutosUrl}"`);
    
    // Mantém o robô aguardando a resposta do Termux (Long Polling)
    let tentativas = 0;
    const checarResposta = setInterval(() => {
        const bancoAtualizado = lerBanco();
        
        if (bancoAtualizado.respostasB[idCodigo]) {
            clearInterval(checarResposta);
            
            const respostaOriginalB = bancoAtualizado.respostasB[idCodigo];
            
            // Remove cirurgicamente a tag ID=XXXXXX da resposta fornecida pelo Termux
            const regexLimpeza = new RegExp(`id\\s*=\\s*${idCodigo}\\s*`, 'i');
            const respostaLimpa = respostaOriginalB.replace(regexLimpeza, '').trim();
            
            // Remove os registros processados para limpar o banco temporário
            delete bancoAtualizado.filaA[idCodigo];
            delete bancoAtualizado.respostasB[idCodigo];
            salvarBanco(bancoAtualizado);
            
            console.log(`[Render] Enviando resposta limpa de volta para o Bot: "${respostaLimpa}"`);
            return res.send(respostaLimpa);
        }
        
        tentativas++;
        if (tentativas > 30) { 
            clearInterval(checarResposta);
            const bancoTimeout = lerBanco();
            delete bancoTimeout.filaA[idCodigo];
            salvarBanco(bancoTimeout);
            return res.status(504).send("Timeout: O terminal do Termux nao respondeu a tempo.");
        }
    }, 1000);
});

// ==========================================
// 2. TERMUX (B) - CONSOME A FILA BRUTA
// ==========================================
app.get('/procurar-mensagens', (req, res) => {
    const banco = lerBanco();
    res.setHeader('Content-Type', 'application/json');
    return res.json(banco.filaA);
});

// ==========================================
// 3. TERMUX (B) - DEVOLVE A RESPOSTA BRUTA
// ==========================================
app.post('/responder-b', (req, res) => {
    let corpoB = req.body ? req.body.toString('utf8').trim() : "";
    
    try {
        if (corpoB.includes('%') || corpoB.includes('+')) {
            corpoB = decodeURIComponent(corpoB.replace(/\+/g, ' '));
        }
    } catch (e) {}

    const matchId = corpoB.match(/id\s*=\s*(\d+)/i);
    
    if (!matchId) {
        return res.status(400).send("Erro: Resposta do Termux sem ID valido.");
    }
    
    const idCodigo = matchId[1];
    const banco = lerBanco();
    
    banco.respostasB[idCodigo] = corpoB;
    salvarBanco(banco);
    
    return res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de Transporte na URL Raiz ativo na porta ${PORT}`));
