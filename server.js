const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// --- CONFIGURAÇÃO DE CAPACIDADE MÁXIMA PARA MÍDIAS PESADAS ---
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.raw({ type: 'image/*', limit: '500mb' }));
app.use(express.raw({ type: 'video/*', limit: '500mb' }));
app.use(express.text({ type: 'text/*', limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');
const PASTA_SOLICITACOES = path.join(__dirname, 'solicitacoes_temp'); 
const PASTA_MIDIAS = path.join(__dirname, 'midias_recebidas'); 

if (!fs.existsSync(PASTA_COMANDOS)) fs.mkdirSync(PASTA_COMANDOS);
if (!fs.existsSync(PASTA_SOLICITACOES)) fs.mkdirSync(PASTA_SOLICITACOES);
if (!fs.existsSync(PASTA_MIDIAS)) fs.mkdirSync(PASTA_MIDIAS);

// Permite abrir os links das mídias direto no navegador
app.use('/ver_midia', express.static(PASTA_MIDIAS));

const requisicoesPendentes = {};
const solicitacoesPendentes = {}; 

app.get('/', (req, res) => {
    res.send('Servidor Ativo.');
});

// 1. ROTA QUE O APP (KODULAR) ACESSA
app.post('/', (req, res) => {
    try {
        const dadosDoApp = req.query.dados ? req.query.dados.trim() : "";
        let veioMidia = false;

        // --- SALVA A MÍDIA E GERA O LINK NO LOG ---
        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
            veioMidia = true;
            const contentType = req.headers['content-type'] || '';
            const ehVideo = contentType.includes('video');
            const extensao = ehVideo ? 'mp4' : 'jpg';

            const nomeDoArquivo = `midia_${Date.now()}.${extensao}`; 
            const caminhoParaSalvar = path.join(PASTA_MIDIAS, nomeDoArquivo);
            fs.writeFileSync(caminhoParaSalvar, req.body);
            
            // PRINTA APENAS O LINK NO LOG, SÓ ISSO!
            console.log(`https://onrender.com{nomeDoArquivo}`);
        }

        // --- REGRA: ENVIOU MÍDIA? RESPONDE AGUARDE CONFIRMACAO ---
        if (veioMidia) {
            return res.status(200).send("aguarde confirmacao dos administradores");
        }

        // --- REGRA: CÓDIGO A1 PURO (IGNORA MAIÚSCULAS/MINÚSCULAS) ---
        if (dadosDoApp.toUpperCase() === "A1") {
            return res.status(200).send("cyp");
        }

        // --- MANUTENÇÃO DOS SEUS COMANDOS ORIGINAIS DO TERMUX ---
        const textoRecebido = dadosDoApp;
        const regexComandoB = /^B\d+/i;
        if (regexComandoB.test(textoRecebido)) {
            const comando = textoRecebido.toUpperCase();
            fs.writeFileSync(path.join(PASTA_COMANDOS, `${comando}.txt`), "");
            requisicoesPendentes[comando] = res;
            setTimeout(() => {
                if (requisicoesPendentes[comando]) {
                    requisicoesPendentes[comando].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoComando(comando);
                    delete requisicoesPendentes[comando];
                }
            }, 60000);
            return;
        }

        if (textoRecebido.toLowerCase().startsWith("solicitacao")) {
            const arquivosExistentes = fs.readdirSync(PASTA_SOLICITACOES);
            const numeroIdentificador = arquivosExistentes.length + 1;
            const chaveSolicitacao = `solicitacao_${numeroIdentificador}`;
            const nomeArquivo = `solicitacao_(${numeroIdentificador}).txt`;
            fs.writeFileSync(path.join(PASTA_SOLICITACOES, nomeArquivo), "");
            solicitacoesPendentes[chaveSolicitacao] = res;
            setTimeout(() => {
                if (solicitacoesPendentes[chaveSolicitacao]) {
                    solicitacoesPendentes[chaveSolicitacao].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoSolicitacao(nomeArquivo);
                    delete solicitacoesPendentes[chaveSolicitacao];
                }
            }, 60000);
            return;
        }

        return res.status(200).send("Processado.");

    } catch (erro) {
        console.error("Erro interno:", erro);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// 2. ROTAS DO TERMUX
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (erro) { return res.status(500).send("Erro"); }
});

app.get('/termux/solicitacoes', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_SOLICITACOES);
        const solicitacoesAtivas = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(solicitacoesAtivas);
    } catch (erro) { return res.status(500).send("Erro"); }
});

// 3. RESPOSTA DO TERMUX
app.post('/termux/resposta', (req, res) => {
    try {
        const respostaTermux = req.body ? req.body.trim() : "";
        if (respostaTermux.toLowerCase().includes("solicitacao_de_codigo")) {
            const indiceCodigo = respostaTermux.toLowerCase().search(/c[oó]digo/);
            let oQueVierDepois = "";
            if (indiceCodigo !== -1) oQueVierDepois = respostaTermux.substring(indiceCodigo + 6).trim();

            const chaves = Object.keys(solicitacoesPendentes);
            if (chaves.length > 0) {
                const primeiraChave = chaves[0];
                const numeroId = primeiraChave.split("_")[1];
                const nomeArquivo = `solicitacao_(${numeroId}).txt`;
                solicitacoesPendentes[primeiraChave].status(200).send(oQueVierDepois);
                deletarArquivoSolicitacao(nomeArquivo);
                delete solicitacoesPendentes[primeiraChave];
                return res.status(200).send("Ok");
            }
            return res.status(404).send("Nenhuma aguardando.");
        }

        const partes = respostaTermux.split(" ");
        if (partes.length > 0) {
            const comando = partes[0].toUpperCase();
            const mensagemParaOApp = partes.slice(1).join(" ");

            if (requisicoesPendentes[comando]) {
                requisicoesPendentes[comando].status(200).send(mensagemParaOApp);
                deletarArquivoComando(comando);
                delete requisicoesPendentes[comando];
                return res.status(200).send("Ok");
            }
        }
        return res.status(404).send("Nao encontrada.");
    } catch (erro) { return res.status(500).send("Erro"); }
});

function deletarArquivoComando(comando) {
    const caminho = path.join(PASTA_COMANDOS, `${comando}.txt`);
    if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
}
function deletarArquivoSolicitacao(nomeArquivo) {
    const caminho = path.join(PASTA_SOLICITACOES, nomeArquivo);
    if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
}

app.listen(PORT, () => {
    console.log(`Servidor Ativo na porta ${PORT}`);
});
