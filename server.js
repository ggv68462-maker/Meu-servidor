const express = require('express');
const app = express();

// Configura o Express para entender dados enviados em formato JSON
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LINK_RESPOSTA = "https://trycloudflare.com";

// Rota principal para verificar se o servidor está online
app.get('/', (req, res) => {
    res.send('Servidor ativo e rodando no Render.');
});

// Rota de Webhook que recebe as mensagens do chat/plataforma
app.post('/webhook', (req, res) => {
    try {
        // Exibe os dados da mensagem recebida no log do Render
        console.log("Mensagem recebida:", req.body);

        // Devolve o link automaticamente como resposta estruturada
        return res.status(200).json({
            reply: LINK_RESPOSTA,
            message: "Resposta automática enviada."
        });

    } catch (error) {
        console.error("Erro ao processar mensagem:", error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
});

// Inicializa o servidor na porta correta exigida pelo Render
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
