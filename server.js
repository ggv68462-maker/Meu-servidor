const express = require('express');
const app = express();

// Lê qualquer formato de texto enviado pelo Termux
app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 10000;
let conexoes = [];

app.get('/', (req, res) => {
    const rawUrl = req.url;
    
    if (rawUrl.includes('?')) {
        const partesUrl = rawUrl.split('?');
        
        // Remove o %20, decodifica espaços e limpa as pontas
        let info = decodeURIComponent(partesUrl[1]).replace(/%20/g, ' ').trim();

        // Se o app mandou coisas acumuladas antes, isola só o último comando por segurança
        if (info.includes('ID=')) {
            const trechos = info.split('ID=');
            info = 'ID=' + trechos[trechos.length - 1].trim();
        }

        const novaConexao = { id: info, respostaHttp: res };
        conexoes.push(novaConexao);

        // Se o usuário fechar o app, limpa a memória
        req.on('close', () => {
            conexoes = conexoes.filter(c => c !== novaConexao);
        });

        // Timeout seguro para o Render não dar erro 504
        setTimeout(() => {
            if (conexoes.includes(novaConexao)) {
                try { novaConexao.respostaHttp.status(200).send(""); } catch(e){}
                conexoes = conexoes.filter(c => c !== novaConexao);
            }
        }, 25000);
        return;
    }
    res.send('Ativo');
});

// Rota onde o Termux consulta os comandos que chegaram
app.get('/termux/pendentes', (req, res) => {
    const idsUnicos = [...new Set(conexoes.map(c => c.id))];
    res.status(200).json(idsUnicos);
});

// Rota onde o Termux entrega o link do vídeo
app.post('/termux/resposta', (req, res) => {
    const dados = req.body ? req.body.trim() : "";
    
    // Separa usando o |||
    const partes = dados.split('|||');
    const chave = partes[0];         // O comando/ID recebido do usuário
    const linkVideo = partes[1] || ""; // O link puro do vídeo que você configurou no Termux

    const conexoesDoUsuario = conexoes.filter(c => c.id === chave);

    if (conexoesDoUsuario.length > 0) {
        conexoesDoUsuario.forEach(con => {
            try {
                // MANDA O LINK DO VÍDEO PURO E LIMPO PRO COMPONENTE WEB1 DO CELULAR
                con.respostaHttp.status(200).send(linkVideo.trim());
            } catch (e) {}
        });

        // APAGA TUDO imediatamente após enviar o vídeo
        conexoes = conexoes.filter(c => c.id !== chave);

        return res.status(200).send("Vídeo enviado e fila limpa");
    }

    res.status(404).send("Pedido expirou");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando e aguardando na porta ${PORT}`);
});
