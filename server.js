const express = require('express');
const app = express();

// Mantém o suporte para ler o formato de texto que seu Termux envia
app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 10000;

// Mudamos para Array para conseguir guardar múltiplos pedidos do mesmo ID
let conexoes = [];

app.get('/', (req, res) => {
    const rawUrl = req.url;
    if (rawUrl.includes('?')) {
        const partesUrl = rawUrl.split('?');
        const info = decodeURIComponent(partesUrl[1]).replace(/%20/g, ' ').trim();

        // Cria o registro da nova conexão recebida
        const novaConexao = { id: info, respostaHttp: res };
        conexoes.push(novaConexao);

        // Se o cliente fechar a aba/desconectar, limpa ele da lista para evitar travamentos
        req.on('close', () => {
            conexoes = conexoes.filter(c => c !== novaConexao);
        });

        // Mantém preso por 25 segundos (Abaixo do limite de 30s do Render)
        setTimeout(() => {
            if (conexoes.includes(novaConexao)) {
                try { novaConexao.respostaHttp.status(200).send(""); } catch(e){}
                conexoes = conexoes.filter(c => c !== novaConexao); // Remove da lista
            }
        }, 25000);
        return;
    }
    res.send('Ativo');
});

// Retorna apenas a lista de IDs únicos pendentes para o Termux
app.get('/termux/pendentes', (req, res) => {
    const idsUnicos = [...new Set(conexoes.map(c => c.id))];
    res.status(200).json(idsUnicos);
});

// Rota onde o Termux responde e limpa TUDO daquele ID
app.post('/termux/resposta', (req, res) => {
    const dados = req.body ? req.body.trim() : "";
    const partes = dados.split('|||');
    const chave = partes[0]; // O ID do usuário
    const resposta = partes[1] || ""; // O "OK" ou qualquer outra resposta

    // Filtra todas as conexões que batem com esse ID específico
    const conexoesDoUsuario = conexoes.filter(c => c.id === chave);

    if (conexoesDoUsuario.length > 0) {
        // Responde e libera TODAS as requisições presas desse ID de uma vez só
        conexoesDoUsuario.forEach(con -> {
            try {
                con.respostaHttp.status(200).send(resposta);
            } catch (e) {
                // Ignora se a conexão já tiver sido fechada
            }
        });

        // APAGA TUDO: Remove permanentemente todas as conexões desse ID do array global
        conexoes = conexoes.filter(c => c.id !== chave);

        return res.status(200).send("Enviado e limpo");
    }

    res.status(404).send("Expirou ou ID nao encontrado");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando e gerenciando arrays na porta ${PORT}`);
});
