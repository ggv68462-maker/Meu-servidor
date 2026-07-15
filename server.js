const express = require('express');
const app = express();

// Aceita qualquer formato vindo do Termux como texto puro
app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;

// Guarda as conexões do Kodular abertas na memória RAM
const requisicoesDoApp = {};

// 1. ROTA QUE ENCAIXA PERFEITAMENTE NOS SEUS BLOCOS DO KODULAR (GET)
// Captura qualquer URL que comece com "/ID=" (Ex: /ID=123GOSTEI, /ID=55B+)
app.get('/ID=:restoDaUrl', (req, res) => {
    // Reconstrói a chave exatamente como o Kodular enviou (ex: "ID=123GOSTEI")
    const chaveIdentificadora = 'ID=' + req.params.restoDaUrl;

    console.log(`[Kodular] Conexão aberta para: ${chaveIdentificadora}. Aguardando Termux...`);

    // Segura a conexão do aplicativo na memória
    requisicoesDoApp[chaveIdentificadora] = res;

    // Abre a janela de 60 segundos exatos
    setTimeout(() => {
        if (requisicoesDoApp[chaveIdentificadora]) {
            console.log(`[Timeout] O Termux não respondeu a tempo para: ${chaveIdentificadora}`);
            // Envia um aviso para o Web1.GotText não ficar travado vazio
            requisicoesDoApp[chaveIdentificadora].status(200).send(""); 
            delete requisicoesDoApp[chaveIdentificadora];
        }
    }, 60000);
});

// 2. ROTA PARA O TERMUX VER QUAIS IDS DO APP ESTÃO TRAVADOS ESPERANDO AGORA
app.get('/termux/pendentes', (req, res) => {
    const pendentes = Object.keys(requisicoesDoApp);
    return res.status(200).json(pendentes); // Retorna ex: ["ID=123GOSTEI"]
});

// 3. ROTA PARA O TERMUX ENVIAR A RESPOSTA (O LINK DO VÍDEO)
// O Termux faz um POST para https://render.com
app.post('/termux/resposta/:chave', (req, res) => {
    const chaveIdentificadora = req.params.chave;
    const linkDoVideo = req.body ? req.body.trim() : "";

    if (requisicoesDoApp[chaveIdentificadora]) {
        console.log(`[Sucesso] Entregando link do vídeo para o App: ${linkDoVideo}`);
        
        // Devolve o link direto para o bloco "get responseContent" do seu Kodular
        requisicoesDoApp[chaveIdentificadora].status(200).send(linkDoVideo);
        
        // Libera a memória do servidor
        delete requisicoesDoApp[chaveIdentificadora];

        return res.status(200).send("Enviado ao celular com sucesso.");
    }

    return res.status(404).send("Esta requisição já expirou ou não existe.");
});

// Rota base padrão do Render
app.get('/', (req, res) => {
    res.send('Servidor de Repasse Ativo e Pareado com o Kodular.');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
