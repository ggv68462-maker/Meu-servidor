const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Configura o servidor para aceitar absolutamente QUALQUER tipo de dado no corpo da requisição
app.use(express.json()); // Lê JSON
app.use(express.text({ type: '*/*' })); // Lê qualquer texto puro ou formato estranho
app.use(express.urlencoded({ extended: true })); // Lê formulários

// O INTERCEPTADOR ABSOLUTO (Middleware de Log)
app.use((req, res, next) => {
    console.log("\n========================================================");
    console.log(`🚨 [NOVA ENTRADA] - ${new Date().toLocaleString('pt-BR')}`);
    console.log(`[MÉTODO]: ${req.method} | [ROTA]: ${req.url}`);
    console.log("========================================================");
    
    // 1. Mostra quem enviou (IP e metadados)
    console.log("👉 [CABEÇALHOS / HEADERS]:");
    console.log(JSON.stringify(req.headers, null, 2));
    
    // 2. Mostra parâmetros de URL (ex: ?id=10&nome=teste)
    if (Object.keys(req.query).length > 0) {
        console.log("\n👉 [PARÂMETROS DA URL / QUERY]:");
        console.log(JSON.stringify(req.query, null, 2));
    }
    
    // 3. Mostra o conteúdo bruto (o "filé" do que foi enviado: texto, número, etc.)
    console.log("\n👉 [CONTEÚDO RECEBIDO / BODY]:");
    if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
        console.log("(Corpo vazio ou formato binário não legível)");
    } else if (typeof req.body === 'object') {
        console.log(JSON.stringify(req.body, null, 2));
    } else {
        console.log(req.body); // Cospe o texto/número puro na tela
    }
    
    console.log("======================= FIM DO LOG =====================\n");
    next();
});

// Rota genérica para responder 'OK' para qualquer requisição e não deixar quem enviou esperando
app.all('*', (req, res) => {
    res.status(200).send("Dado recebido e processado no log do servidor!");
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de Log Absoluto rodando na porta ${PORT}`);
});
