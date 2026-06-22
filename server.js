const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Configuração original para ler qualquer tipo de texto enviado pelo app
app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const PASTA_COMANDOS = path.join(__dirname, 'comandos');

// Cria a pasta "comandos" se ela não existir
if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}

// Armazena temporariamente as requisições do App esperando resposta do Termux (Original)
const requisicoesPendentes = {};

// Contador global para dar o número (1), (2), (3) para as solicitações sem repetir
let contadorFila = 1;

app.get('/', (req, res) => {
    res.send('Servidor de Integração App <-> Termux Ativo com Fila de Códigos.');
});

// 1. ROTA PRINCIPAL QUE O APP (KODULAR) ACESSA VIA POST (UNIFICADA)
app.post('/', (req, res) => {
    try {
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        // ==========================================
        // NOVA FUNÇÃO: SOLICITAÇÃO DE CÓDIGO (NOVATOS)
        // ==========================================
        if (textoRecebido.includes('solicitacao_de_codigo')) {
            const numeroIdentificacao = contadorFila;
            contadorFila++; // Garante que o próximo ID será diferente (1, 2, 3...)

            // Cria o identificador único para o Termux entender quem é (Ex: solicitacao_de_codigo(1))
            const chaveIdentificadora = `solicitacao_de_codigo(${numeroIdentificacao})`;
            console.log(`[Nova Fila] Criando solicitação: ${chaveIdentificadora}. Salvando na pasta...`);

            // Salva na mesma pasta 'comandos' para o seu Termux ler de forma padronizada (Ex: comandos/solicitacao_de_codigo(1).txt)
            fs.writeFileSync(path.join(PASTA_COMANDOS, `${chaveIdentificadora}.txt`), "");

            // Segura o usuário novato na espera da resposta específica dele
            requisicoesPendentes[chaveIdentificadora] = res;

            // Timeout de segurança de 60 segundos para não travar o app do novato
            setTimeout(() => {
                if (requisicoesPendentes[chaveIdentificadora]) {
                    console.log(`Timeout: Termux não gerou o código para ${chaveIdentificadora}`);
                    requisicoesPendentes[chaveIdentificadora].status(200).send("Erro: Tempo limite esgotado.");
                    deletarArquivoComando(chaveIdentificadora);
                    delete requisicoesPendentes[chaveIdentificadora];
                }
            }, 60000);

            return; // Aguarda a resposta do Termux
        }

        // ==========================================
        // SUA FUNÇÃO ORIGINAL: COMANDOS B1, B2...
        // ==========================================
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

        return res.status(200).send("Comando inválido. Use B seguido de número ou solicitação de código.");

    } catch (error) {
        console.error("Erro ao processar app:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

// 2. ROTA PARA O TERMUX VER OS COMANDOS PENDENTES (Original - Agora lista os "B" e as "solicitações")
app.get('/termux/comandos', (req, res) => {
    try {
        const arquivos = fs.readdirSync(PASTA_COMANDOS);
        const comandosAtivos = arquivos.map(arq => path.parse(arq).name);
        return res.status(200).json(comandosAtivos);
    } catch (error) {
        return res.status(500).send("Erro ao ler comandos.");
    }
});

// 3. ROTA PARA O TERMUX DEVOLVER A RESPOSTA (UNIFICADA COM LIMPEZA DE TEXTO)
app.post('/termux/resposta', (req, res) => {
    try {
        const respostaTermux = req.body ? req.body.trim() : "";
        console.log("Resposta recebida do Termux:", respostaTermux);

        // Separa o cabeçalho (Ex: B1 ou solicitacao_de_codigo(1)) do restante da resposta
        const partes = respostaTermux.split(" ");
        const comandoBruto = partes[0];
        
        // Se a resposta vier do sistema novo de códigos, tratamos o nome da chave
        let comando = comandoBruto.includes('solicitacao_de_codigo') ? comandoBruto : comandoBruto.toUpperCase();
        
        // Pega tudo o que o Termux escreveu depois da chave identificadora
        let mensagemParaOApp = partes.slice(1).join(" ");

        if (requisicoesPendentes[comando]) {
            
            // Tratamento especial que você pediu para a solicitação de código:
            if (comando.includes('solicitacao_de_codigo')) {
                console.log(`[Nova Fila] Tratando resposta recebida: ${respostaTermux}`);
                
                // Limpa parênteses, o número de identificação e as letras, isolando apenas o código gerado final
                // Exemplo: se o Termux responder "solicitacao_de_codigo(1) 1882828282", ele filtra e vira apenas "1882828282"
                mensagemParaOApp = respostaTermux.replace(/solicitacao_de_codigo\s*\(\d+\)\s*/g, '').trim();
                
                console.log(`[Nova Fila] Enviando para o App apenas o número limpo: ${mensagemParaOApp}`);
            } else {
                console.log(`[Original] Enviando para o App a resposta do comando ${comando}: ${mensagemParaOApp}`);
            }
            
            // Envia a resposta final filtrada de volta para o Kodular
            requisicoesPendentes[comando].status(200).send(mensagemParaOApp);
            
            // Limpa a pasta e a memória do servidor
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

// Função auxiliar para deletar o arquivo de comando resolvido (Original)
function deletarArquivoComando(comando) {
    const caminhoArquivo = path.join(PASTA_COMANDOS, `${comando}.txt`);
    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }
}

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
