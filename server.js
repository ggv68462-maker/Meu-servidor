const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');

// Cria a pasta "comandos" se ela não existir
if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}

// Armazena temporariamente as requisições do App esperando resposta do Termux
const requisicoesPendentes = {};
const solicitacoesPendentes = {};

// Sistema de armazenamento local para os códigos gerados (Aprende isso)
const PASTA_LOCAL_CELULAR = path.join(process.env.HOME || '/data/data/com.termux/files/home', 'storage', 'downloads', 'códigos');
const ARQUIVO_HISTORICO = path.join(PASTA_LOCAL_CELULAR, 'historico_codigos.txt');

// Garante que a pasta e o arquivo de histórico existam no celular
if (!fs.existsSync(PASTA_LOCAL_CELULAR)) {
    fs.mkdirSync(PASTA_LOCAL_CELULAR, { recursive: true });
}
if (!fs.existsSync(ARQUIVO_HISTORICO)) {
    fs.writeFileSync(ARQUIVO_HISTORICO, '');
}

// Função para gerar o número sequencial sem repetir inspecionando o arquivo local
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

// FUNÇÃO AUXILIAR: Pega o termo processado e devolve só o número isolado para o App
function processarRespostaSolicitacao(termoCompleto) {
    const regexSeparador = /^(solicita[cç]a[oõ]_de_codigo\s*(\([^)]*\))?)\s+(.+)$/i;
    const match = termoCompleto.match(regexSeparador);

    if (match) {
        const baseTermo = match[1].trim();
        // Normaliza a chave para buscar no objeto de pendentes
        const chaveChaveamento = baseTermo.replace(/\s+/g, '').toLowerCase();
        const apenasONumeroDaFrente = match[3].trim();

        if (solicitacoesPendentes[chaveChaveamento]) {
            console.log(`[DEVOLVENDO] Mandando apenas o número ${apenasONumeroDaFrente} de volta.`);
            
            // Devolve apenas o número para o Kodular
            solicitacoesPendentes[chaveChaveamento].status(200).send(apenasONumeroDaFrente);
            
            // APAGA a solicitação imediatamente para não ficar repetindo
            delete solicitacoesPendentes[chaveChaveamento];
            console.log(`[LIMPEZA] Chave ${chaveChaveamento} removida para evitar repetições.`);
        }
    }
}

app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo.');
});

// 1. ROTA QUE O APP (KODULAR) ACESSA VIA POST
app.post('/', (req, res) => {
    try {
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        // --- NOVO BLOCO: SOLICITAÇÃO DE CÓDIGO (VARIÁVEL IGNORADA / OPCIONAL) ---
        // Aceita de todo jeito: "solicitacao_de_codigo", "solicitação_de_codigo (1)", maiúsculas, etc.
        const regexSolicitacao = /^solicita[cç]a[oõ]_de_codigo(\s*\(([^)]*)\))?/i;
        const matchSolicitacao = textoRecebido.match(regexSolicitacao);

        if (matchSolicitacao) {
            // Normaliza o texto recebido removendo espaços e jogando para minúsculo para usar como chave estável
            const chaveChaveamento = textoRecebido.replace(/\s+/g, '').toLowerCase();

            console.log(`[SOLICITAÇÃO] Detectada: ${textoRecebido}. Aguardando processamento...`);

            // Guarda a requisição aberta esperando a resposta
            solicitacoesPendentes[chaveChaveamento] = res;

            // Gera o código único sequencial inspecionando o armazenamento do celular
            const numeroGerado = gerarCodigoUnicoCelular();

            // Monta a estrutura temporária para devolução rápida
            const termoComNumeroNaFrente = `${textoRecebido} ${numeroGerado}`;

            // Processa a resposta para enviar apenas o número e deletar a solicitação
            processarRespostaSolicitacao(termoComNumeroNaFrente);
            return;
        }
        // ------------------------------------------------------------------------

        // --- BLOCO ORIGINAL B (TOTALMENTE ISOLADO E INALTERADO) ---
        const regexComando = /^B\d+/i;
        
        if (regexComando.test(textoRecebido)) {
            const comando = textoRecebido.toUpperCase();
            console.log(`Comando válido detectado: ${comando}. Salvando na pasta...`);

            // Salva o comando em um arquivo dentro da pasta 'comandos' (Ex: comandos/B1.txt)
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
        // ----------------------------------------------------------

        return res.status(200).send("Comando inválido.");

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
