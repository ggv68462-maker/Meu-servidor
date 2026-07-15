const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.text()); // Garante suporte caso venha como texto puro

// Caminho temporário seguro no Render para guardar a fila
const FILE_PATH = path.join('/tmp', 'mensagens_broker.json');

// Função auxiliar para ler o estado atual do banco temporário
function lerBanco() {
    if (!fs.existsSync(FILE_PATH)) return { filaA: {}, respostasB: {} };
    try {
        return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    } catch (e) {
        return { filaA: {}, respostasB: {} };
    }
}

// Função auxiliar para gravar alterações
function salvarBanco(dados) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(dados, null, 2));
}

// ==========================================
// 1. COMPONENTE A - ENVIA MENSAGEM (Com ID)
// ==========================================
app.post('/enviar-a', (req, res) => {
    const corpo = req.body.toString().trim();
    
    // Expressão regular para capturar "Id=XXXXX" ou "id=XXXXX" no início ou meio
    const matchId = corpo.match(/id\s*=\s*(\d+)/i);
    
    if (!matchId) {
        return res.status(400).send("Erro: Mensagem de A sem ID identificado.");
    }
    
    const idCodigo = matchId[1];
    const banco = lerBanco();
    
    // Armazena a mensagem pública exatamente como veio de A para o Termux ver
    banco.filaA[idCodigo] = corpo;
    salvarBanco(banco);
    
    console.log(`[A] Recebido ID ${idCodigo}. Aguardando processamento do Termux...`);
    
    // Mantém a requisição de A aberta (Long Polling) até que B responda
    let tentativas = 0;
    const checarResposta = setInterval(() => {
        const bancoAtualizado = lerBanco();
        
        if (bancoAtualizado.respostasB[idCodigo]) {
            clearInterval(checarResposta);
            
            // Pega o conteúdo gerado por B
            const respostaOriginalB = bancoAtualizado.respostasB[idCodigo];
            
            // Remove estritamente o "Id=XXXXXXXX" (e variações de espaços/letras) da string
            const regexLimpeza = new RegExp(`id\\s*=\\s*${idCodigo}\\s*`, 'i');
            const respostaLimpa = respostaOriginalB.replace(regexLimpeza, '').trim();
            
            // Limpa as duas mensagens do banco de dados (A e B limpos)
            delete bancoAtualizado.filaA[idCodigo];
            delete bancoAtualizado.respostasB[idCodigo];
            salvarBanco(bancoAtualizado);
            
            console.log(`[Render] Respondendo para o App A (Sem ID). Fila limpa.`);
            return res.send(respostaLimpa);
        }
        
        tentativas++;
        if (tentativas > 30) { // Timeout de 30 segundos para evitar travamento no Render
            clearInterval(checarResposta);
            const bancoTimeout = lerBanco();
            delete bancoTimeout.filaA[idCodigo];
            salvarBanco(bancoTimeout);
            return res.status(504).send("Timeout: O terminal B demorou para responder.");
        }
    }, 1000);
});

// ==========================================
// 2. TERMUX (B) - PUSH/GET PARA LER A FILA
// ==========================================
app.get('/procurar-mensagens', (req, res) => {
    const banco = lerBanco();
    // Expõe a fila de forma pública para o seu Termux ler o que o A enviou
    return res.json(banco.filaA);
});

// ==========================================
// 3. TERMUX (B) - DEVOLVE A RESPOSTA (Com ID)
// ==========================================
app.post('/responder-b', (req, res) => {
    const corpoB = req.body.toString().trim();
    const matchId = corpoB.match(/id\s*=\s*(\d+)/i);
    
    if (!matchId) {
        return res.status(400).send("Erro: Resposta de B sem ID identificado.");
    }
    
    const idCodigo = matchId[1];
    const banco = lerBanco();
    
    // Armazena a resposta de B mantendo a estrutura íntegra temporariamente
    banco.respostasB[idCodigo] = corpoB;
    salvarBanco(banco);
    
    console.log(`[B] Resposta recebida para o ID ${idCodigo}.`);
    return res.send("OK: Resposta processada pelo transporte.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Transporte rodando na porta ${PORT}`));
