const express = require('express');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
// O Render define a porta automaticamente por esta variável
const PORT = process.env.PORT || 3000;

// Aceita absolutamente qualquer tipo de mídia ou dado bruto sem restrição de tamanho
app.use(express.raw({ type: '*/*', limit: '500mb' }));

app.post('/upload', async (req, res) => {
    try {
        const contentTypeOriginal = req.headers['content-type'] || 'application/octet-stream';
        const nomeDoArquivo = req.headers['x-file-name'] || `midia_${Date.now()}.bin`;
        const arquivoBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

        const form = new FormData();
        form.append('chat_id', '8880569466');
        form.append('document', arquivoBuffer, {
            filename: nomeDoArquivo,
            contentType: contentTypeOriginal
        });

        const urlTelegram = 'https://telegram.org';

        const respostaTelegram = await axios.post(urlTelegram, form, {
            headers: {
                ...form.getHeaders()
            },
            // Evita que o Axios derrube a conexão por timeout em uploads muito grandes
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return res.status(200).json(respostaTelegram.data);

    } catch (error) {
        return res.status(500).json({ erro: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor escutando na porta ${PORT}`);
});
