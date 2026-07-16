const express = require('express');
const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 10000;
let conexoes = [];

app.get('/', (req, res) => {
    const rawUrl = req.url;
    
    if (rawUrl.includes('?')) {
        const partesUrl = rawUrl.split('?');
        
        // Pega tudo que vem depois do /? remove o %20 e limpa os espaços das pontas
        let info = decodeURIComponent(partesUrl[1]).replace(/%20/g, ' ').trim();

        const novaConexao = { id: info, respostaHttp: res };
        conexoes.push(novaConexao);

        // Se o aplicativo fechar ou desconectar, limpa da memória
        req.on('close', () => {
            conexoes = conexoes.filter(c => c !== novaConexao);
        });

        // Timeout seguro para o Render (25 segundos)
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

// Envia a lista limpa (sem %20) para o Termux ler
app.get('/termux/pendentes', (req, res) => {
    const idsUnicos = [...new Set(conexoes.map(c => c.id))];
    res.status(200).json(idsUnicos);
});

// Recebe a resposta do Termux e faz a separação
app.post('/termux/resposta', (req, res) => {
    const dados = req.body ? req.body.trim() : "";
    
    // Separa o código vindo do Termux usando o separador |||
    const partes = dados.split('|||');
    const chave = partes[0];      // O ID/Código que veio do App original
    const resposta = partes[1] || ""; // O "OK" enviado pelo Termux

    const conexoesDoUsuario = conexoes.filter(c => c.id === chave);

    if (conexoesDoUsuario.length > 0) {
        conexoesDoUsuario.forEach(con => {
            try {
                // Devolve o "OK" para o componente Web1 do aplicativo
                con.respostaHttp.status(200).send(resposta);
            } catch (e) {}
        });

        // APAGA TUDO: Remove permanentemente qualquer rastro desse ID do servidor
        conexoes = conexoes.filter(c => c.id !== chave);

        return res.status(200).send("Enviado e limpo");
    }

    res.status(404).send("Expirou");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
