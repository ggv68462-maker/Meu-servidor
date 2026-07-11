const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();

app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;

const PASTA_COMANDOS = path.join(__dirname, 'comandos');

const TELEGRAM_TOKEN = "8938158627:AAFDHHbxf52DPtcKVgN3240O_kIoEnVPiLs";
const TELEGRAM_CHAT_ID = "8880569466";


const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: Infinity
    }
});


if (!fs.existsSync(PASTA_COMANDOS)) {
    fs.mkdirSync(PASTA_COMANDOS);
}

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}


const requisicoesPendentes = {};



app.get('/', (req,res)=>{
    res.send("Servidor ativo.");
});



// KODULAR ENVIA COMANDO

app.post('/', (req,res)=>{

try {

const textoRecebido = req.body ? req.body.trim() : "";

console.log("Recebido:", textoRecebido);


const regex = /^B\d+/i;


if(regex.test(textoRecebido)){


const comando = textoRecebido.toUpperCase();


fs.writeFileSync(
path.join(PASTA_COMANDOS, comando+".txt"),
""
);


requisicoesPendentes[comando] = res;



setTimeout(()=>{

if(requisicoesPendentes[comando]){

requisicoesPendentes[comando]
.status(200)
.send("Tempo esgotado");


deletarArquivoComando(comando);

delete requisicoesPendentes[comando];

}

},60000);


return;

}


res.send("Comando inválido");


}catch(e){

console.log(e);
res.status(500).send("Erro");

}

});




// TERMUX PEGA COMANDOS

app.get('/termux/comandos',(req,res)=>{

try{

const arquivos =
fs.readdirSync(PASTA_COMANDOS);


const lista =
arquivos.map(a=>path.parse(a).name);


res.json(lista);


}catch(e){

res.status(500).send("Erro");

}

});




// TERMUX DEVOLVE RESPOSTA

app.post('/termux/resposta',(req,res)=>{

try{


const texto = req.body.trim();


const partes = texto.split(" ");


const comando = partes[0].toUpperCase();


const mensagem = partes.slice(1).join(" ");



if(requisicoesPendentes[comando]){


requisicoesPendentes[comando]
.status(200)
.send(mensagem);


deletarArquivoComando(comando);


delete requisicoesPendentes[comando];


return res.send("OK");

}


res.status(404).send("Não encontrado");


}catch(e){

res.status(500).send("Erro");

}

});





// RECEBE QUALQUER MÍDIA E MANDA TELEGRAM

app.post('/telegram/media',
upload.single('media'),
async(req,res)=>{


try{


console.log("Arquivo recebido:", req.file);



if(!req.file){

return res
.status(400)
.send("Nenhum arquivo");

}



const form = new FormData();



form.append(
"chat_id",
TELEGRAM_CHAT_ID
);



form.append(
"document",
fs.createReadStream(req.file.path),
{
filename:req.file.originalname
}
);



const resposta = await axios.post(

`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`,

form,

{

headers:form.getHeaders(),

maxContentLength:Infinity,

maxBodyLength:Infinity

}

);



console.log(
"Telegram respondeu:",
resposta.data
);



fs.unlinkSync(req.file.path);



res.send("Arquivo enviado");


}catch(e){


console.log(
"ERRO:",
e.response?.data || e
);



res.status(500)
.send("Erro Telegram");


}

});






function deletarArquivoComando(comando){


const arquivo =
path.join(
PASTA_COMANDOS,
comando+".txt"
);


if(fs.existsSync(arquivo)){

fs.unlinkSync(arquivo);

}


}



app.listen(PORT,()=>{

console.log(
"Servidor rodando na porta "+PORT
);

});