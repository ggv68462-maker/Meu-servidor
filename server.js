const express = require('express');
const app = express();

// Configura o Express para ler o texto puro enviado pelo Kodular (PostText)
app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const LINK_RESPOSTA = "https://untitled-band-nuke-columnists.trycloudflare.com/VID-20260610-WA0002.mp4";

// Rota principal para testes no navegador
app.get('/', (req, res) => {
    res.send('Servidor do aplicativo ativo no Render.');
});

// Rota principal que o Kodular acessa diretamente
app.post('/', (req, res) => {
    try {
        // Captura o texto que veio do 'PostText' do Kodular
        const textoRecebido = req.body ? req.body.trim() : "";
        console.log("Texto recebido do app:", textoRecebido);

        // Verifica se o texto enviado começa com "B" (como configurado no app)
        if (textoRecebido.toUpperCase().startsWith("B")) {
            console.log("Comando válido detectado! Enviando link do vídeo.");
            
            // Retorna apenas o link do vídeo para o componente Web1 receber no evento 'GotText'
            return res.status(200).send(LINK_RESPOSTA);
        }

        // Caso receba um texto que não comece com B
        return res.status(200).send("Texto recebido, mas não inicia com B.");

    } catch (error) {
        console.error("Erro no processar:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
