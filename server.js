const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process'); // Importado para ler/gravar os códigos locais
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');

if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}

const requisicoesPendentes = {};

// =========================================================================
// NOVO BLOCO: ABA DE SOLICITAÇÕES DE CÓDIGO (PEDIDO POR VOCÊ)
// =========================================================================
const solicitacoesPendentes = {};

// Caminho exato do sistema de armazenamento do celular que você mandou
const PASTA_LOCAL_CELULAR = path.join(process.env.HOME || '/data/data/com.termux/files/home', 'storage', 'downloads', 'códigos');
const ARQUIVO_HISTORICO = path.join(PASTA_LOCAL_CELULAR, 'historico_codigos.txt');

// Garante que a pasta e o arquivo local existam no seu celular
if (!fs.existsSync(PASTA_LOCAL_CELULAR)) {
    fs.mkdirSync(PASTA_LOCAL_CELULAR, { recursive: true });
}
if (!fs.existsSync(ARQUIVO_HISTORICO)) {
    fs.writeFileSync(ARQUIVO_HISTORICO, '');
}

// Função que inspeciona o armazenamento local do celular para gerar um número sem repetir
function gerarCodigoUnicoCelular() {
    const historico = fs.readFileSync(ARQUIVO_HISTORICO, 'utf-8')
        .split('\n')
        .map(linha => linha.trim())
        .filter(linha => linha !== '');

    let novoCodigo = 1;
    while (historico.includes(novoCodigo.toString())) {
        novoCodigo++;
    }

    // Salva o número no armazenamento usando o seu sistema
    fs.appendFileSync(ARQUIVO_HISTORICO, novoCodigo + '\n');
    return novoCodigo;
}
// =========================================================================


app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo.');
});

// 1. ROTA QUE O APP ACESSA VIA POST (ATUALIZADA COM O SEGUNDO BLOCO)
app.post('/', (req, res) => {
    try {
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        // --- SEGUNDO BLOCO: VALIDAÇÃO DE SOLICITAÇÃO_DE_CODIGO ---
        // Regex que aceita maiúsculo, minúsculo, com ou sem acento, e pega o número variável dentro de ()
        const regexSolicitacao = /^solicita[cç]a[oõ]_de_codigo\s*\(([^)]+)\)/i;
        const matchSolicitacao = textoRecebido.match(regexSolicitacao);

        if (matchSolicitacao) {
            // Padroniza a chave para o formato "solicitação_de_codigo(X)" para evitar erros de busca
            const numeroVariavel = matchSolicitacao[1];
            const chaveChaveamento = `solicitação_de_codigo(${numeroVariavel})`;

            console.log(`[NOVO BLOCO] Solicitação detectada: ${chaveChaveamento}. Aguardando processamento...`);

            // Guarda a requisição aberta esperando a resposta
            solicitacoesPendentes[chaveChaveamento] = res;

            // Gera o código único inspecionando o armazenamento do celular (Aprende isso!)
            const numeroGerado = gerarCodigoUnicoCelular();

            // Monta o formato que o Termux vai ler: "solicitação_de_codigo (1) 182827272728"
            const termoComNumeroNaFrente = `solicitação_de_codigo (${numeroVariavel}) ${numeroGerado}`;

            // Simula o recebimento desse termo completo para processar imediatamente e devolver apenas o número
            processarRespostaSolicitacao(termoComNumeroNaFrente);
            return;
        }
        // --------------------------------------------------------

        // Bloco B1 original (Inalterado)
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

        return res.status(200).send("Comando inválido.");

    } catch (error) {
        console.error("Erro ao processar app:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// FUNÇÃO AUXILIAR DO SEGUNDO BLOCO: Pega o termo com números na frente e devolve só o número isolado
function processarRespostaSolicitacao(termoCompleto) {
    // Regex para separar a estrutura "solicitação_de_codigo (X)" do número que está na frente
    const regexSeparador = /^(solicita[cç]a[oõ]_de_codigo\s*\(([^)]+)\))\s+(.+)$/i;
    const match = termoCompleto.match(regexSeparador);

    if (match) {
        const numeroVariavel = match[2];
        const chaveChaveamento = `solicitação_de_codigo(${numeroVariavel})`;
        const apenasONumeroDaFrente = match[3];

        if (solicitacoesPendentes[chaveChaveamento]) {
            console.log(`[DEVOLVENDO] Mandando apenas o número ${apenasONumeroDaFrente} de volta para a solicitação (${numeroVariavel})`);
            
            // Devolve apenas o número para quem solicitou originalmente
            solicitacoesPendentes[chaveChaveamento].status(200).send(apenasONumeroDaFrente);
            
            // APAGA a solicitação imediatamente da aba para não ficar repetindo
            delete solicitacoesPendentes[chaveChaveamento];
            console.log(`[LIMPEZA] Chave ${chaveChaveamento} removida para evitar repetições.`);
        }
    }
}

// 2. ROTA PARA O TERMUX VER OS COMANDOS PENDENTES (Inalterada)
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (error) {
        return res.status(500).send("Erro ao ler comandos.");
    }
});

// 3. ROTA PARA O TERMUX DEVOLVER A RESPOSTA DO BLOCO B1 (Inalterada)
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
