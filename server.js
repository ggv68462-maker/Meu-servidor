const express = require('express');
const app = express();

// Aceita qualquer formato vindo do Termux como texto puro
app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;

// Guarda as conexões do Kodular abertas na memória RAM
const requisicoesDoApp = {};

// 1. ROTA PRINCIPAL AJUSTADA PARA PEGAR O "/?" DO KODULAR
app.get('/', (req, res) => {
    // Pega o objeto de query (ex: se a URL for /?ID=123GOSTEI, req.query terá {"ID=123GOSTEI": ""})
    const chavesQuery = Object.keys(req.query);

    // Se o Kodular enviou algo depois do "?"
    if (chavesQuery.length > 0) {
        const chaveIdentificadora = chavesQuery[0]; // Captura o "ID=123GOSTEI"

        console.log(`[Kodular] Conexão aberta via Query: ${chaveIdentificadora}. Aguardando Termux...`);

        // Segura a conexão do aplicativo na memória
        requisicoesDoApp[chaveIdentificadora] = res;

        // Abre a janela de 60 segundos exatos
        setTimeout(() => {
            if (requisicoesDoApp[chaveIdentificadora]) {
                console.log(`[Timeout] O Termux não respondeu a tempo para: ${chaveIdentificadora}`);
                requisicoesDoApp[chaveIdentificadora].status(200).send(""); 
                delete requisicoesDoApp[chaveIdentificadora];
            }
        }, 60000);

        return; // Sai da função para deixar a conexão suspensa esperando o Termux
    }

    // Se alguém acessar a URL pura pelo navegador sem o "?", mostra essa mensagem:
    res.send('Servidor de Repasse Ativo e Pareado com o Kodular.');
});

// 2. ROTA PARA O TERMUX VER QUAIS IDS DO APP ESTÃO TRAVADOS ESPERANDO AGORA
app.get('/termux/pendentes', (req, res) => {
    const pendentes = Object.keys(requisicoesDoApp);
    return res.status(200).json(pendentes); // Retorna ex: ["ID=123GOSTEI"]
});

// 3. ROTA PARA O TERMUX ENVIAR A RESPOSTA
app.post('/termux/resposta/:chave', (req, res) => {
    const chaveIdentificadora = req.params.chave;
    const linkDoVideo = req.body ? req.body.trim() : "";

    if (requisicoesDoApp[chaveIdentificadora]) {
        console.log(`[Sucesso] Entregando resposta para o App: ${linkDoVideo}`);
        
        // Devolve o link direto para o bloco "get responseContent" do seu Kodular
        requisicoesDoApp[chaveIdentificadora].status(200).send(linkDoVideo);
        
        // Libera a memória do servidor
        delete requisicoesDoApp[chaveIdentificadora];

        return res.status(200).send("Enviado ao celular com sucesso.");
    }

    return res.status(404).send("Esta requisição já expirou ou não existe.");
});

app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
