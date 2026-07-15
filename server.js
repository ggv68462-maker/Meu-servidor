const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// 🔥 CONFIGURAÇÃO CRUCIAL: Aceita absolutamente QUALQUER tipo de dado (texto, binário, formulários)
// Transforma tudo o que chega em um Buffer bruto, sem tentar adivinhar ou falhar por formato inválido
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

// ==========================================
// 1. COMPONENTE A (Niotron Bot) - ENVIA QUALQUER COISA
// ==========================================
app.post('/enviar-a', (req, res) => {
    // Converte o buffer bruto recebido diretamente em string UTF-8
    let corpoBruto = req.body ? req.body.toString('utf8').trim() : "";
    
    // Tratamento para decodificar caso o componente Web1 envie como URL Encoded (ex: ID%3D82828282+GOSTEI)
    try {
        if (corpoBruto.includes('%') || corpoBruto.includes('+')) {
            corpoBruto = decodeURIComponent(corpoBruto.replace(/\+/g, ' '));
        }
    } catch (err) {
        // Se falhar na decodificação, mantém o texto exatamente como veio do buffer
    }

    if (!corpoBruto) {
        return res.status(400).send("Erro: Corpo da mensagem vazio.");
    }

    // Procura pela estrutura ID=XXXXX usando regex flexível no texto bruto decodificado
    const matchId = corpoBruto.match(/id\s*=\s*(\d+)/i);
    
    if (!matchId) {
        console.log(`[A - ERRO BRUTO] Recebido sem ID identificável: "${corpoBruto}"`);
        return res.status(400).send("Erro: ID de usuário não localizado no fluxo.");
    }
    
    const idCodigo = matchId[1];
    const banco = lerBanco();
    
    // Armazena o dado bruto público exatamente como veio
    banco.filaA[idCodigo] = corpoBruto;
    salvarBanco(banco);
    
    console.log(`[A - SUCESSO] Armazenado ID ${idCodigo}. Conteúdo Bruto: "${corpoBruto}"`);
    
    // Inicia o mecanismo de espera (Long Polling) para segurar o Niotron até o Termux responder
    let tentativas = 0;
    const checarResposta = setInterval(() => {
        const bancoAtualizado = lerBanco();
        
        if (bancoAtualizado.respostasB[idCodigo]) {
            clearInterval(checarResposta);
            
            const respostaOriginalB = bancoAtualizado.respostasB[idCodigo];
            
            // Remove cirurgicamente a marcação ID=XXXXXX da resposta do Termux para o App receber apenas dados
            const regexLimpeza = new RegExp(`id\\s*=\\s*${idCodigo}\\s*`, 'i');
            const respostaLimpa = respostaOriginalB.replace(regexLimpeza, '').trim();
            
            // Limpa as filas do arquivo temporário
            delete bancoAtualizado.filaA[idCodigo];
            delete bancoAtualizado.respostasB[idCodigo];
            salvarBanco(bancoAtualizado);
            
            console.log(`[Render] Respondendo de volta para o Bot Niotron (Sem ID): "${respostaLimpa}"`);
            return res.send(respostaLimpa);
        }
        
        tentativas++;
        if (tentativas > 30) { 
            clearInterval(checarResposta);
            const bancoTimeout = lerBanco();
            delete bancoTimeout.filaA[idCodigo];
            salvarBanco(bancoTimeout);
            return res.status(504).send("Timeout: O terminal do Termux demorou.");
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
        return res.status(400).send("Erro: Resposta do Termux sem ID válido.");
    }
    
    const idCodigo = matchId[1];
    const banco = lerBanco();
    
    banco.respostasB[idCodigo] = corpoB;
    salvarBanco(banco);
    
    return res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de Transporte Totalmente Aberto na porta ${PORT}`));
