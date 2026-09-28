const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const crypto = require("crypto");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb){
    if(!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return cb(null,true);
    return cb(new Error("Origin not allowed"));
  }
}));

const upload = multer({
  dest: path.join(os.tmpdir(), "ovt-upload"),
  limits: { fileSize: 100 * 1024 * 1024 }
});

function convert(inputPath, outDir){
  return new Promise((resolve,reject)=>{
    execFile(
      "libreoffice",
      ["--headless","--convert-to","pdf","--outdir",outDir,inputPath],
      {timeout:120000},
      (err,stdout,stderr)=>{
        if(err) return reject(new Error(stderr || stdout || err.message));
        resolve();
      }
    );
  });
}

app.get("/health",(req,res)=>res.json({ok:true,service:"OVT PPTX→PDF"}));

app.post("/convert",upload.single("file"),async(req,res)=>{
  if(!req.file) return res.status(400).send("Arquivo ausente.");
  const original=req.file.originalname || "registro.pptx";
  if(!original.toLowerCase().endsWith(".pptx")){
    fs.unlink(req.file.path,()=>{});
    return res.status(400).send("Envie um arquivo PPTX.");
  }

  const job=crypto.randomUUID();
  const dir=path.join(os.tmpdir(),"ovt-convert",job);
  fs.mkdirSync(dir,{recursive:true});
  const input=path.join(dir,"entrada.pptx");
  fs.renameSync(req.file.path,input);

  try{
    await convert(input,dir);
    const pdf=path.join(dir,"entrada.pdf");
    if(!fs.existsSync(pdf)) throw new Error("PDF não foi gerado.");

    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Cache-Control","no-store");
    res.setHeader("X-Content-Type-Options","nosniff");

    const stream=fs.createReadStream(pdf);
    stream.pipe(res);
    stream.on("close",()=>fs.rm(dir,{recursive:true,force:true},()=>{}));
  }catch(err){
    fs.rm(dir,{recursive:true,force:true},()=>{});
    res.status(500).send("Falha na conversão: "+err.message);
  }
});

const port=process.env.PORT || 3000;
app.listen(port,()=>console.log("OVT converter listening on "+port));
