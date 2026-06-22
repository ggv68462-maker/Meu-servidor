const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');
// NOVO: Pasta isolada para as solicitações de código
const PASTA_SOLICITACOES = path.join(__dirname, 'solicitacao_de_codigo');

// Cria a pasta "comandos" se ela não existir
if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}

// NOVO: Cria a pasta "solicitacao_de_codigo" se ela não existir
if (!fs.existsSync(PASTA_SOLICITACOES)) {
    fs.mkdirSync(PASTA_SOLICITACOES);
}

// Armazena temporariamente as requisições do App esperando resposta do Termux
const requisicoesPendentes = {};
// NOVO: Armazena temporariamente os Apps esperando o código específico por ID Ex: { "1": res, "2": res }
const solicitacoesPendentes = {};

app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo.');
});

// 1. ROTA QUE O APP (KODULAR) ACESSA VIA POST
app.post('/', (req, res) => {
    try {
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        // --- FLUXO ORIGINAL DO COMANDO B (TOTALMENTE INTACTO) ---
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

        // --- NOVO FLUXO: SOLICITAÇÃO DE CÓDIGO (TOTALMENTE ISOLADO) ---
        // Identifica mensagens no formato exato: solicitação_de_codigo (X) ou solicitacao_de_codigo (X)
        const regexSolicitacao = /^solicita[cç]ã[oõ]_de_codigo\s*\((\d+)\)$/i;
        const matchSolicitacao = textoRecebido.match(regexSolicitacao);

        if (matchSolicitacao) {
            const idSolicitacao = matchSolicitacao[1]; // Pega o número de dentro do ( )
            console.log(`Nova solicitação de código detectada. ID: ${idSolicitacao}`);

            // Salva o arquivo na pasta exclusiva 'solicitacao_de_codigo' com o nome exato recebido
            fs.writeFileSync(path.join(PASTA_SOLICITACOES, `${textoRecebido}.txt`), "");

            // Guarda o objeto 'res' do App específico atrelado a esse ID
            solicitacoesPendentes[idSolicitacao] = res;

            // Timeout de 60s para não deixar a requisição do App travada caso o código nunca chegue
            setTimeout(() => {
                if (solicitacoesPendentes[idSolicitacao]) {
                    console.log(`Timeout: Código para solicitação ID ${idSolicitacao} não chegou.`);
                    solicitacoesPendentes[idSolicitacao].status(200).send("Erro: Tempo limite do código esgotado.");
                    deletarArquivoSolicitacao(textoRecebido);
                    delete solicitacoesPendentes[idSolicitacao];
                }
            }, 60000);

            return;
        }

        // --- NOVO FLUXO: RECEBIMENTO DO CÓDIGO (TOTALMENTE ISOLADO) ---
        // Identifica mensagens no formato: solicitação_de_codigo (X) NUMERO_DO_CODIGO
        const regexCodigoEntregue = /^solicita[cç]ã[oõ]_de_codigo\s*\((\d+)\)\s+(.+)$/i;
        const matchCodigo = textoRecebido.match(regexCodigoEntregue);

        if (matchCodigo) {
            const idSolicitacao = matchCodigo[1]; // Número identificador (X)
            const codigoExtraido = matchCodigo[2].trim(); // Apenas o número/texto final (ex: 828282828)

            if (solicitacoesPendentes[idSolicitacao]) {
                console.log(`Entregando código para a solicitação (${idSolicitacao}): ${codigoExtraido}`);

                // Devolve APENAS o código puro para o App correto que pediu lá atrás
                solicitacoesPendentes[idSolicitacao].status(200).send(codigoExtraido);

                // Limpa os arquivos e remove da lista de pendências
                const nomeArquivoOriginal = `solicitação_de_codigo (${idSolicitacao})`;
                deletarArquivoSolicitacao(nomeArquivoOriginal);
                deletarArquivoSolicitacao(`solicitacao_de_codigo (${idSolicitacao})`); // Garante a remoção se salvou sem acento
                delete solicitacoesPendentes[idSolicitacao];

                return res.status(200).send("Código repassado ao app correspondente com sucesso.");
            }

            return res.status(404).send("Esta solicitação de código não existe ou já expirou.");
        }

        // Se não cair em nenhuma das regras acima:
        return res.status(200).send("Comando inválido.");

    } catch (error) {
        console.error("Erro ao processar app:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// 2. ROTA PARA O TERMUX VER OS COMANDOS PENDENTES (TOTALMENTE INTACTO)
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (error) {
        return res.status(500).send("Erro ao ler comandos.");
    }
});

// NOVO: ROTA EXTRA CASO O TERMUX QUEIRA VER AS SOLICITAÇÕES DE CÓDIGO ATIVAS ISOLADAMENTE
app.get('/termux/solicitacoes', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_SOLICITACOES);
        const solicitacoesAtivas = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(solicitacoesAtivas);
    } catch (error) {
        return res.status(500).send("Erro ao ler solicitações.");
    }
});

// 3. ROTA PARA O TERMUX DEVOLVER A RESPOSTA DO COMANDO B (TOTALMENTE INTACTO)
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

// Função auxiliar para deletar o arquivo de comando resolvido (TOTALMENTE INTACTO)
function deletarArquivoComando(comando) {
    const caminhoArquivo = path.join(PASTA_COMANDOS, `${comando}.txt`);
    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }
}

// NOVO: Função auxiliar para deletar o arquivo de solicitação resolvido
function deletarArquivoSolicitacao(nomeArquivo) {
    const caminhoArquivo = path.join(PASTA_SOLICITACOES, `${nomeArquivo}.txt`);
    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }
}

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
