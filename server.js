const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// --- CONFIGURAÇÃO DE CAPACIDADE MÁXIMA REMOVIDA (SEM LIMITES) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Permite receber dados binários brutos imensos (Fotos/Vídeos) enviados pelo Kodular
app.use(express.raw({ type: 'image/*' }));
app.use(express.raw({ type: 'video/*' }));
app.use(express.text({ type: 'text/*' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');
const PASTA_SOLICITACOES = path.join(__dirname, 'solicitacoes_temp'); 
const PASTA_MIDIAS = path.join(__dirname, 'midias_recebidas'); 

// Cria as pastas se não existirem
if (!fs.existsSync(PASTA_COMANDOS)) fs.mkdirSync(PASTA_COMANDOS);
if (!fs.existsSync(PASTA_SOLICITACOES)) fs.mkdirSync(PASTA_SOLICITACOES);
if (!fs.existsSync(PASTA_MIDIAS)) fs.mkdirSync(PASTA_MIDIAS);

// --- NOVA LINHA: PERMITE VER A FOTO/VÍDEO PELO NAVEGADOR ---
// Se você digitar: https://onrender.com ele abre na tela!
app.use('/ver_midia', express.static(PASTA_MIDIAS));

const requisicoesPendentes = {};
const solicitacoesPendentes = {}; 

app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo.');
});

// 1. ROTA QUE O APP (KODULAR) ACESSA VIA POST
app.post('/', (req, res) => {
    try {
        // --- CAPTURA E MOSTRA OS DADOS VINDOS DA URL (?dados=) ---
        const dadosDoApp = req.query.dados ? req.query.dados.trim() : "";
        
        console.log("-----------------------------------------");
        console.log("TEXTO BRUTO QUE VEIO NA URL:", req.query.dados); 
        console.log("CONTEÚDO DECODIFICADO:", dadosDoApp);
        console.log("-----------------------------------------");

        // --- SALVA O ARQUIVO DE FOTO/VÍDEO QUE VEIO NO CORPO (BODY) ---
        let veioVideo = false;
        let veioFoto = false;
        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
            const contentType = req.headers['content-type'] || '';
            const ehVideo = contentType.includes('video');
            const extensao = ehVideo ? 'mp4' : 'jpg';

            if (ehVideo) {
                veioVideo = true; 
            } else {
                veioFoto = true;
            }

            // Cria um nome fixo baseado no horário atual para o arquivo
            const nomeDoArquivo = `midia_${Date.now()}.${extensao}`; 
            const caminhoParaSalvar = path.join(PASTA_MIDIAS, nomeDoArquivo);
            
            fs.writeFileSync(caminhoParaSalvar, req.body);
            console.log(`[ARQUIVO SALVO] Link para ver no navegador:`);
            console.log(`https://onrender.com{nomeDoArquivo}`);
            console.log(`Tamanho do arquivo: ${(req.body.length / (1024*1024)).toFixed(2)} MB`);
            console.log("-----------------------------------------");
        }

        // --- REGRA DO VÍDEO ---
        if (veioVideo) {
            console.log("[REGRA] Vídeo detectado. Respondendo mensagem de permissão para o App.");
            return res.status(200).send("aguardando permissão do ADM");
        }

        // --- REGRA DA FOTO ---
        if (veioFoto) {
            console.log("[REGRA] Foto detectada. Respondendo mensagem de permissão para o App.");
            return res.status(200).send("aguardando permissão do ADM");
        }

        // --- REGRA DO CÓDIGO A1 ---
        if (dadosDoApp.toUpperCase().includes("A1")) {
            console.log("[REGRA] Código A1 detectado. Respondendo 'cyp' para o App.");
            return res.status(200).send("cyp");
        }

        // --- LÓGICA ANTIGA DE VALIDAÇÃO (CASO NÃO SEJA VÍDEO NEM A1) ---
        const textoRecebido = dadosDoApp;

        const regexComandoB = /^B\d+/i;
        if (regexComandoB.test(textoRecebido)) {
            const comando = textoRecebido.toUpperCase();
            console.log(`[BLOCO 1] Comando B detectado: ${comando}`);

            fs.writeFileSync(path.join(PASTA_COMANDOS, `${comando}.txt`), "");
            requisicoesPendentes[comando] = res;

            setTimeout(() => {
                if (requisicoesPendentes[comando]) {
                    console.log(`[BLOCO 1] Timeout comando ${comando}`);
                    requisicoesPendentes[comando].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoComando(comando);
                    delete requisicoesPendentes[comando];
                }
            }, 60000);

            return;
        }

        if (textoRecebido.toLowerCase().startsWith("solicitacao")) {
            console.log(`[BLOCO 2] Solicitação recebida: ${textoRecebido}`);

            const arquivosExistentes = fs.readdirSync(PASTA_SOLICITACOES);
            const numeroIdentificador = arquivosExistentes.length + 1;
            const chaveSolicitacao = `solicitacao_${numeroIdentificador}`;

            const nomeArquivo = `solicitacao_(${numeroIdentificador}).txt`;
            fs.writeFileSync(path.join(PASTA_SOLICITACOES, nomeArquivo), "");

            solicitacoesPendentes[chaveSolicitacao] = res;

            setTimeout(() => {
                if (solicitacoesPendentes[chaveSolicitacao]) {
                    console.log(`[BLOCO 2] Solicitação de timeout ${chaveSolicitacao}`);
                    solicitacoesPendentes[chaveSolicitacao].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoSolicitacao(nomeArquivo);
                    delete solicitacoesPendentes[chaveSolicitacao];
                }
            }, 60000);

            return;
        }

        return res.status(200).send("Envio de mídia e dados processado com sucesso.");

    } catch (erro) {
        console.error("Erro ao processar app:", erro);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// 2. ROTAS PARA O TERMUX VER OS COMANDOS PENDENTES
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (erro) {
        return res.status(500).send("Erro ao ler comandos.");
    }
});

app.get('/termux/solicitacoes', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_SOLICITACOES);
        const solicitacoesAtivas = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(solicitacoesAtivas);
    } catch (erro) {
        return res.status(500).send("Erro ao ler solicitações.");
    }
});

// 3. ROTA PARA O TERMUX DEVOLVER A RESPOSTA
app.post('/termux/resposta', (req, res) => {
    try {
        const respostaTermux = req.body ? req.body.trim() : "";
        console.log("Resposta recebida do Termux:", respostaTermux);

        if (respostaTermux.toLowerCase().includes("solicitacao_de_codigo")) {
            const indiceCodigo = respostaTermux.toLowerCase().search(/c[oó]digo/);
            let oQueVierDepois = "";

            if (indiceCodigo !== -1) {
                oQueVierDepois = respostaTermux.substring(indiceCodigo + 6).trim();
            }

            const chaves = Object.keys(solicitacoesPendentes);
            if (chaves.length > 0) {
                const primeiraChave = chaves[0]; 
                const numeroId = primeiraChave.split("_")[1];
                const nomeArquivo = `solicitacao_(${numeroId}).txt`;

                console.log(`[BLOCO 2] Enviando conteúdo para o App: ${oQueVierDepois}`);
                solicitacoesPendentes[primeiraChave].status(200).send(oQueVierDepois);

                deletarArquivoSolicitacao(nomeArquivo);
                delete solicitacoesPendentes[primeiraChave];

                return res.status(200).send("Resposta do bloco 2 repassada.");
            }

            return res.status(404).send("Nenhuma solicitação aguardando resposta.");
        }

        const partes = respostaTermux.split(" ");
        const comando = partes[0].toUpperCase(); 
        const mensagemParaOApp = partes.slice(1).join(" ");

        if (requisicoesPendentes[comando]) {
            console.log(`[BLOCO 1] Enviando resposta do comando ${comando}: ${mensagemParaOApp}`);
            
            requisicoesPendentes[comando].status(200).send(mensagemParaOApp);
            
            deletarArquivoComando(comando);
            delete requisicoesPendentes[comando];

            return res.status(200).send("Resposta repassada com sucesso.");
        }

        return res.status(404).send("Este comando não está esperando resposta ou já expirou.");

    } catch (erro) {
        console.error("Erro ao processar resposta do Termux:", erro);
        return res.status(500).send("Erro interno no servidor.");
    }
});

function deletarArquivoComando(comando) {
    const caminhoArquivo = path.join(PASTA_COMANDOS, `${comando}.txt`);
    if (fs.existsSync(caminhoArquivo)) fs.unlinkSync(caminhoArquivo);
}

function deletarArquivoSolicitacao(nomeArquivo) {
    const caminhoArquivo = path.join(PASTA_SOLICITACOES, nomeArquivo);
    if (fs.existsSync(caminhoArquivo)) fs.unlinkSync(caminhoArquivo);
}

app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
