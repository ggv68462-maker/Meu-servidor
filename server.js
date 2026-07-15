const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;


// =========================
// ARQUIVOS DE DADOS
// =========================

const pastaDados = path.join(__dirname, "dados_caixa");

if (!fs.existsSync(pastaDados)) {
    fs.mkdirSync(pastaDados, { recursive: true });
}

const caminhoCaixa = path.join(pastaDados, "caixa.json");
const caminhoRespostas = path.join(pastaDados, "respostas.json");


let caixa = {};
let respostas = {};


// =========================
// CARREGAR DADOS
// =========================

try {

    if (fs.existsSync(caminhoCaixa)) {
        caixa = JSON.parse(
            fs.readFileSync(caminhoCaixa, "utf8")
        );
    }

    if (fs.existsSync(caminhoRespostas)) {
        respostas = JSON.parse(
            fs.readFileSync(caminhoRespostas, "utf8")
        );
    }

} catch(e) {

    console.log("Erro ao carregar dados:", e);

}



// =========================
// SALVAR DADOS
// =========================

function salvarDados(){

    fs.writeFileSync(
        caminhoCaixa,
        JSON.stringify(caixa, null, 2),
        "utf8"
    );


    fs.writeFileSync(
        caminhoRespostas,
        JSON.stringify(respostas, null, 2),
        "utf8"
    );

}



// =========================
// SERVIDOR
// =========================

app.get("*", (req,res)=>{


    res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
    );


    let url = decodeURIComponent(req.url).trim();



    // =========================
    // VER CAIXA
    // =========================

    if(url === "/?caixa"){

        res.setHeader(
            "Content-Type",
            "application/json"
        );

        return res.send(
            JSON.stringify(caixa,null,2)
        );

    }



    if(!url.startsWith("/?")){
        return res.send("");
    }



    let texto = url.substring(2).trim();


    // remove ID=
    texto = texto.replace(/^ID=/i,"");



    const espaco = texto.indexOf(" ");



    // =========================
    // APP BUSCA RESPOSTA
    // Ex: /?1234
    // =========================

    if(espaco === -1){

        const id = texto;


        if(!respostas[id]){
            return res.send("");
        }


        const resposta = respostas[id];


        // limpa depois de entregar

        delete respostas[id];
        delete caixa[id];

        salvarDados();


        return res.send(resposta);

    }



    // =========================
    // SEPARAR ID E MENSAGEM
    // =========================


    const id = texto
        .substring(0,espaco)
        .trim();


    const mensagem = texto
        .substring(espaco + 1)
        .trim();



    // =========================
    // RESPOSTA RECEBIDA
    // =========================


    if(caixa[id]){


        if(!respostas[id]){
            respostas[id] = "";
        }


        respostas[id] += `\n(${mensagem})`;


        salvarDados();


        return res.send(
            "Resposta recebida"
        );

    }



    // =========================
    // NOVO PEDIDO DO APP
    // =========================


    caixa[id] = `(${mensagem})`;

    // cria espaço para várias respostas
    respostas[id] = "";


    salvarDados();


    return res.send(
        "Pedido armazenado"
    );


});





app.listen(PORT,()=>{

    console.log(
        `Servidor iniciado na porta ${PORT}`
    );

});