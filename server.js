const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const app = express();

// Mantém o estilo exato que você usa para aceitar qualquer entrada como texto/bruto
app.use(express.text({ type: '*/*', limit: '100mb' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');

if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}

const requisicoesPendentes = {};

app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo.');
});

// =========================================================================
// ROTA MODIFICADA: ACEITA QUALQUER MÍDIA DO APP E ENVIA DIRETO PRO TELEGRAM
// =========================================================================
app.post('/enviar-midia', async (req, res) => {
    try {
        if (!req.body || req.body.length === 0) {
            return res.status(200).send("Erro: Nenhum dado de arquivo recebido.");
        }

        // Pega o Content-Type original enviado ou usa um genérico
        const contentTypeOriginal = req.headers['content-type'] || 'application/octet-stream';
        
        // Pega o nome do arquivo enviado pelo cabeçalho ou cria um automático
        const nomeDoArquivo = req.headers['x-file-name'] || `midia_${Date.now()}.bin`;

        // Converte o texto recebido de volta para um Buffer binário puro (as cegas)
        const arquivoBuffer = Buffer.from(req.body, 'binary');

        // Cria o formulário obrigatório para o Telegram
        const form = new FormData();
        form.append('chat_id', '8880569466');
        form.append('document', arquivoBuffer, {
            filename: nomeDoArquivo,
            contentType: contentTypeOriginal
        });

        const urlTelegram = 'https://telegram.org';

        // Envia de forma assíncrona e cega para o seu Telegram
        const respostaTelegram = await axios.post(urlTelegram, form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // Retorna a resposta de sucesso para o aplicativo do Kodular
        return res.status(200).send("Sucesso: Arquivo enviado para o Telegram.");

    } catch (error) {
        console.error("Erro no envio do Telegram:", error.message);
        return res.status(200).send(`Erro ao processar mídia: ${error.message}`);
    }
});

// 1. ROTA QUE O APP (KODULAR) ACESSA VIA POST (Mantida original)
app.post('/', (req, res) => {
    try {
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        const regexComando = /^B\d+/i;
        
        if (regexComando.test(textoRecebido)) {
            const comando = textoRecebido.toUpperCase();
            console.log(`Comando válido detectado: ${comando}. Salvando na pasta...`);

            fs.writeFileSync(path.join(PASTA_COMANDOS, `${comando}.txt`), "");
            requisicoesPendentes[comando] = res;

            setTimeout(() => {
                if (requisicoesPendentes[comando]) {
                    console.log(`Timeout: Termux não respondeu ao comando ${comando}`);
                    requisicoesPendentes[comando].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoComando(comando);
                    delete requisicoesPendentes[comando];
                }
            }, 60000); 

            return; 
        }

        return res.status(200).send("Comando inválido. Use B seguido de um número.");

    } catch (error) {
        console.error("Erro ao processar app:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// 2. ROTA PARA O TERMUX VER OS COMANDOS PENDENTES (Mantida original)
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (error) {
        return res.status(500).send("Erro ao ler comandos.");
    }
});

// 3. ROTA PARA O TERMUX DEVOLVER A RESPOSTA (Mantida original)
app.post('/termux/resposta', (req, res) => {
    try {
        const respostaTermux = req.body ? req.body.trim() : "";
        console.log("Resposta recebida do Termux:", respostaTermux);

        const partes = respostaTermux.split(" ");
        const comando = partes[0].toUpperCase();
        const mensagemParaOApp = partes.slice(1).join(" ");

        if (requisicoesPendentes[comando]) {
            console.log(`Enviando para o App a resposta do comando ${comando}: ${mensagemParaOApp}`);
            
            requisicoesPendentes[comando].status(200).send(mensagemParaOApp);
            
            deletarArquivoComando(comando);
            delete requisicoesPendentes[comando];

            return res.status(200).send("Resposta repassada com sucesso.");
        }

        return res.status(404).send("Este comando não está esperando resposta ou já expirou.");

    } catch (error) {
        console.error("Erro ao processar resposta do Termux:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

function deletarArquivoComando(comando) {
    const caminhoArquivo = path.join(PASTA_COMANDOS, `${comando}.txt`);
    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }
}

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
