const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Configura o limite para 500MB para aceitar os vídeos pesados do seu aplicativo
app.use(express.json({ limit: '500mb' }));
app.use(express.raw({ type: 'image/*', limit: '500mb' }));
app.use(express.raw({ type: 'video/*', limit: '500mb' }));

const PORT = 3000;
const PASTA_TESTE = path.join(__dirname, 'midias_teste');
if (!fs.existsSync(PASTA_TESTE)) fs.mkdirSync(PASTA_TESTE);

// Rota principal onde o seu botão do Kodular vai bater
app.post('/', (req, res) => {
    try {
        // 1. Captura o texto formatado que o aplicativo mandou no (?dados=)
        const dadosDoApp = req.query.dados ? req.query.dados.trim() : "";
        console.log("Texto que chegou do App:", dadosDoApp);

        // 2. Verifica se chegou um arquivo e se ele é um vídeo ou uma foto
        let veioVideo = false;
        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
            const contentType = req.headers['content-type'] || '';
            const ehVideo = contentType.includes('video');
            const extensao = ehVideo ? 'mp4' : 'jpg';

            if (ehVideo) {
                veioVideo = true; // Marca que o arquivo recebido é um vídeo real
            }
            
            // Salva o arquivo enviado dentro da pasta de testes
            fs.writeFileSync(path.join(PASTA_TESTE, `teste_${Date.now()}.${extensao}`), req.body);
            console.log(`[ARQUIVO] Mídia salva! Tipo: ${extensao} | Tamanho: ${(req.body.length / (1024*1024)).toFixed(2)} MB`);
        }

        // 3. REGRA DO VÍDEO: Se o arquivo enviado for um vídeo, manda essa resposta obrigatoriamente
        if (veioVideo) {
            console.log("[REGRA] Vídeo detectado. Respondendo mensagem de permissão.");
            return res.status(200).send("aguardando permissão do ADM");
        }

        // 4. REGRA DO CÓDIGO A1: Se não for vídeo, mas o texto contiver 'A1', responde 'cyp'
        if (dadosDoApp.toUpperCase().includes("A1")) {
            console.log("[REGRA] Código A1 detectado. Respondendo 'cyp'");
            return res.status(200).send("cyp");
        }

        // Se mandar só uma foto normal sem o código A1, manda uma resposta padrão de sucesso
        return res.status(200).send("Envio realizado com sucesso.");

    } catch (erro) {
        console.error("Erro ao processar:", erro);
        return res.status(500).send("Erro interno no servidor de teste.");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de teste rodando com sucesso na porta ${PORT}`);
});
