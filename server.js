const express = require('express');
const fs = require('fs');
const path = require('path');
// Importações necessárias para a nova rota do Telegram
const axios = require('axios');
const FormData = require('form-data');

const app = express();

app.use(express.text({ type: '*/*', limit: '100mb' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');

// Cria a pasta "comandos" se ela não existir
if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}

// Armazena temporariamente as requisições do App esperando resposta do Termux
const requisicoesPendentes = {};

app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo.');
});

// 1. ROTA QUE O APP (KODULAR) ACESSA VIA POST
app.post('/', (req, res) => {
    try {
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        // Expressão regular para validar qualquer comando que comece com B seguido de números (B1, B2, B10, etc)
        const regexComando = /^B\d+/i;
        
        if (regexComando.test(textoRecebido)) {
            const comando = textoRecebido.toUpperCase();
            console.log(`Comando válido detectado: ${comando}. Salvando na pasta...`);

            // Salva o comando em um arquivo dentro da pasta 'comandos' (Ex: comandos/B1.txt)
            // O conteúdo inicial do arquivo é vazio, pois o Termux vai preencher
            fs.writeFileSync(path.join(PASTA_COMANDOS, `${comando}.txt`), "");

            // Guarda a resposta (res) aberta. Ela vai esperar até o Termux responder ou dar timeout (60s)
            requisicoesPendentes[comando] = res;

            // Define um limite de tempo para não travar o app se o Termux demorar demais
            setTimeout(() => {
                if (requisicoesPendentes[comando]) {
                    console.log(`Timeout: Termux não respondeu ao comando ${comando}`);
                    requisicoesPendentes[comando].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoComando(comando);
                    delete requisicoesPendentes[comando];
                }
            }, 60000); 

            return; // Não responde o "res" ainda. Aguarda o Termux.
        }

        return res.status(200).send("Comando inválido. Use B seguido de um número.");

    } catch (error) {
        console.error("Erro ao processar app:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// 2. ROTA PARA O TERMUX VER OS COMANDOS PENDENTES (O Termux fará um GET aqui)
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        // Remove a extensão .txt para listar apenas os nomes dos comandos (Ex: ["B1", "B2"])
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (error) {
        return res.status(500).send("Erro ao ler comandos.");
    }
});

// 3. ROTA PARA O TERMUX DEVOLVER A RESPOSTA (O Termux fará um POST aqui)
// Exemplo de texto enviado pelo Termux: "B1 Conteúdo que vai pro aplicativo"
app.post('/termux/resposta', (req, res) => {
    try {
        const respostaTermux = req.body ? req.body.trim() : "";
        console.log("Resposta recebida do Termux:", respostaTermux);

        // Separa o código do comando (Ex: B1) do restante do texto
        const partes = respostaTermux.split(" ");
        const comando = partes[0].toUpperCase();
        
        // Pega tudo o que veio DEPOIS do comando B1
        const mensagemParaOApp = partes.slice(1).join(" ");

        if (requisicoesPendentes[comando]) {
            console.log(`Enviando para o App a resposta do comando ${comando}: ${mensagemParaOApp}`);
            
            // Devolve APENAS o que estava na frente do comando para o Kodular
            requisicoesPendentes[comando].status(200).send(mensagemParaOApp);
            
            // Limpa o arquivo da pasta e a lista de pendentes
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

// =========================================================================
// ROTA ADICIONADA: PROCESSA E ENVIA QUALQUER POSTFILE PARA O TELEGRAM AS CEGAS
// =========================================================================
app.post('/enviar-midia', async (req, res) => {
    try {
        if (!req.body || req.body.length === 0) {
            return res.status(200).send("Erro: Nenhum dado de arquivo recebido.");
        }

        // Reconstrói com segurança os bytes crus a partir da string fornecida pelo middleware
        const arquivoBuffer = Buffer.from(req.body, 'binary');

        const form = new FormData();
        form.append('chat_id', '8880569466');
        form.append('document', arquivoBuffer, {
            filename: `midia_${Date.now()}.bin`,
            contentType: 'application/octet-stream'
        });

        const urlTelegram = 'https://telegram.org';

        await axios.post(urlTelegram, form, {
            headers: { ...form.getHeaders() },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return res.status(200).send("Sucesso: Enviado ao Telegram.");
    } catch (error) {
        console.error("Erro Telegram:", error.message);
        return res.status(200).send(`Erro: ${error.message}`);
    }
});

// Função auxiliar para deletar o arquivo de comando resolvido
function deletarArquivoComando(comando) {
    const caminhoArquivo = path.join(PASTA_COMANDOS, `${comando}.txt`);
    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }
}

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
