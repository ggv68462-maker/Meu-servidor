const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;


const pastaDados = path.join(__dirname, "dados_caixa");

if (!fs.existsSync(pastaDados)) {
    fs.mkdirSync(pastaDados, { recursive: true });
}


const arquivoCaixa = path.join(pastaDados, "caixa.json");
const arquivoRespostas = path.join(pastaDados, "respostas.json");


let caixa = {};
let respostas = {};


// carregar
try {

    if (fs.existsSync(arquivoCaixa)) {
        caixa = JSON.parse(fs.readFileSync(arquivoCaixa, "utf8"));
    }

    if (fs.existsSync(arquivoRespostas)) {
        respostas = JSON.parse(fs.readFileSync(arquivoRespostas, "utf8"));
    }

} catch(e) {
    console.log("Erro carregando dados");
}



// salvar
function salvar(){

    fs.writeFileSync(
        arquivoCaixa,
        JSON.stringify(caixa, null, 2)
    );

    fs.writeFileSync(
        arquivoRespostas,
        JSON.stringify(respostas, null, 2)
    );

}


// pegar próximo número
function novoNumero(obj){

    const chaves = Object.keys(obj);

    if(chaves.length === 0)
        return "0";

    return String(
        Math.max(...chaves.map(Number)) + 1
    );

}



app.get("*",(req,res)=>{


    res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
    );


    let url = decodeURIComponent(req.url).trim();


    // ver caixa
    if(url === "/?caixa"){

        res.setHeader(
            "Content-Type",
            "application/json"
        );

        return res.send(
            JSON.stringify(caixa,null,2)
        );
    }



    if(!url.startsWith("/?"))
        return res.send("");



    let texto = url.substring(2).trim();

    texto = texto.replace(/^ID=/i,"");



    let espaco = texto.indexOf(" ");



    // APP BUSCANDO
    if(espaco === -1){


        let id = texto;


        let encontrados = [];


        for(let chave in respostas){

            if(respostas[chave].id === id){

                encontrados.push(
                    respostas[chave].mensagem
                );

            }

        }



        if(encontrados.length === 0)
            return res.send("");



        let retorno = encontrados.join("\n");



        // remove só as respostas desse ID

        for(let chave in respostas){

            if(respostas[chave].id === id){

                delete respostas[chave];

            }

        }


        salvar();


        return res.send(retorno);

    }





    // separar ID e mensagem

    let id = texto.substring(0,espaco).trim();

    let mensagem = texto.substring(espaco+1).trim();




    // resposta de fora

    if(Object.values(caixa).some(x => x.id === id)){


        let numero = novoNumero(respostas);


        respostas[numero] = {

            id:id,

            mensagem:mensagem

        };


        salvar();


        return res.send("Resposta recebida");

    }




    // novo pedido

    let numero = novoNumero(caixa);


    caixa[numero] = {

        id:id,

        mensagem:mensagem

    };


    salvar();


    return res.send("Pedido armazenado");


});





app.listen(PORT,()=>{

    console.log(
        "Servidor iniciado na porta "+PORT
    );

});