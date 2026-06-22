const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');
const PASTA_SOLICITACOES = path.join(__dirname, 'solicitacoes_temp'); // Pasta do segundo bloco

// Cria as pastas se não existirem
if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}
if (!fs.existsSync(PASTA_SOLICITACOES)) {
    fs.mkdirSync(PASTA_SOLICITACOES);
}

// Armazena temporariamente as requisições esperando resposta do Termux
const requisicoesPendentes = {};
const solicitacoesPendentes = {}; // Controle do segundo bloco

app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo.');
});

// 1. ROTA QUE O APP (KODULAR) ACESSA VIA POST
app.post('/', (req, res) => {
    try {
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        // --- PRIMEIRO BLOCO: ATIVADO QUANDO COMEÇA COM "B" ---
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

        // --- SEGUNDO BLOCO: ATIVADO QUANDO COMEÇA COM "SOLICITACAO" ---
        if (textoRecebido.toLowerCase().startsWith("solicitacao")) {
            console.log(`[BLOCO 2] Solicitação detectada: ${textoRecebido}`);

            // Conta quantos arquivos já existem para definir o número incremental: (1), (2), (3)...
            const arquivosExistentes = fs.readdirSync(PASTA_SOLICITACOES);
            const numeroIdentificador = arquivosExistentes.length + 1;
            const chaveSolicitacao = `solicitacao_${numeroIdentificador}`;

            // Salva o arquivo temporário na pasta correspondente
            const nomeArquivo = `solicitacao_(${numeroIdentificador}).txt`;
            fs.writeFileSync(path.join(PASTA_SOLICITACOES, nomeArquivo), "");

            // Segura a requisição do App
            solicitacoesPendentes[chaveSolicitacao] = res;

            setTimeout(() => {
                if (solicitacoesPendentes[chaveSolicitacao]) {
                    console.log(`[BLOCO 2] Timeout solicitação ${chaveSolicitacao}`);
                    solicitacoesPendentes[chaveSolicitacao].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoSolicitacao(nomeArquivo);
                    delete solicitacoesPendentes[chaveSolicitacao];
                }
            }, 60000);

            return;
        }

        return res.status(200).send("Comando inválido. Use B ou Solicitação.");

    } catch (error) {
        console.error("Erro ao processar app:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// 2. ROTAS PARA O TERMUX VER OS COMANDOS PENDENTES
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (error) {
        return res.status(500).send("Erro ao ler comandos.");
    }
});

// Rota extra para o Termux também listar os arquivos do segundo bloco, se precisar saber quais estão ativos
app.get('/termux/solicitacoes', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_SOLICITACOES);
        const solicitacoesAtivas = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(solicitacoesAtivas);
    } catch (error) {
        return res.status(500).send("Erro ao ler solicitações.");
    }
});

// 3. ROTA PARA O TERMUX DEVOLVER A RESPOSTA
app.post('/termux/resposta', (req, res) => {
    try {
        const respostaTermux = req.body ? req.body.trim() : "";
        console.log("Resposta recebida do Termux:", respostaTermux);

        // Verifica se a resposta pertence ao segundo bloco (solicitacao_de_codigo)
        if (respostaTermux.toLowerCase().includes("solicitacao_de_codigo")) {
            // Extrai apenas os números contidos no texto enviado pelo Termux
            const apenasNumeros = respostaTermux.replace(/\D/g, "");

            // Localiza a primeira requisição que está esperando na fila do segundo bloco
            const chaves = Object.keys(solicitacoesPendentes);
            if (chaves.length > 0) {
                const primeiraChave = chaves[0];
                const numeroId = primeiraChave.split("_")[1];
                const nomeArquivo = `solicitacao_(${numeroId}).txt`;

                console.log(`[BLOCO 2] Enviando apenas o número para o App: ${apenasNumeros}`);
                
                // Envia APENAS o número recebido para o aplicativo
                solicitacoesPendentes[primeiraChave].status(200).send(apenasNumeros);

                deletarArquivoSolicitacao(nomeArquivo);
                delete solicitacoesPendentes[primeiraChave];

                return res.status(200).send("Resposta do bloco 2 repassada.");
            }

            return res.status(404).send("Nenhuma solicitação aguardando resposta.");
        }

        // Se não for do segundo bloco, segue a lógica padrão do primeiro bloco (Comandos B)
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

    } catch (error) {
        console.error("Erro ao processar resposta do Termux:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// Funções auxiliares para deletar arquivos resolvidos
function deletarArquivoComando(comando) {
    const caminhoArquivo = path.join(PASTA_COMANDOS, `${comando}.txt`);
    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }
}

function deletarArquivoSolicitacao(nomeArquivo) {
    const caminhoArquivo = path.join(PASTA_SOLICITACOES, nomeArquivo);
    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }
}

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
