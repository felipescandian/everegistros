const CACHE="ovt-app-v33";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./ovt-192.png","./ovt-512.png"];

function bytesToBase64(bytes){
  let binary="";
  const CHUNK=0x8000;
  for(let i=0;i<bytes.length;i+=CHUNK){
    binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+CHUNK,bytes.length)));
  }
  return btoa(binary);
}

function escJs(s){
  return JSON.stringify(String(s||""));
}

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys
      .filter(k=>k.startsWith("ovt-app-") && k!==CACHE)
      .map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);

  if(event.request.method==="POST" && url.pathname.endsWith("/share-target")){
    event.respondWith((async()=>{
      try{
        const form=await event.request.formData();
        let file=form.get("file") || form.get("pdf");

        if(!file || !file.size){
          for(const value of form.values()){
            if(value && typeof value==="object" && typeof value.arrayBuffer==="function" && value.size){
              file=value;
              break;
            }
          }
        }

        if(!file || !file.size){
          const fail=`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
          <body style="margin:0;background:#02060d;color:white;font-family:Arial,sans-serif;padding:28px">
          <h2>OVT Correção</h2>
          <p>O WhatsApp abriu o OVT, mas não enviou o arquivo junto.</p>
          <p>Isso acontece em alguns aparelhos com arquivos do WhatsApp.</p>
          <button onclick="location.href='./?shared=1&fallback=1&v=33'" style="border:0;border-radius:14px;padding:16px 18px;background:#ffb800;font-weight:800">
            Abrir OVT e selecionar o arquivo
          </button>
          </body></html>`;
          return new Response(fail,{headers:{"Content-Type":"text/html;charset=UTF-8"}});
        }

        const bytes=new Uint8Array(await file.arrayBuffer());
        const b64=bytesToBase64(bytes);
        const name=file.name||"registro";
        const type=file.type||"application/octet-stream";

        // IMPORTANT: this page itself receives the POST response.
        // It writes the file to IndexedDB in PAGE context, then redirects to the app.
        const bridge=`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>OVT • Recebendo arquivo</title>
<style>
html,body{margin:0;height:100%;background:#02060d;color:#fff;font-family:Arial,sans-serif}
.wrap{height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box}
.card{width:min(520px,100%);border:1px solid #0d85c9;border-radius:24px;padding:28px;background:#071624;text-align:center}
h1{margin:0 0 12px;font-size:30px}
#pct{font-size:52px;font-weight:900;color:#ffc21b;margin:15px 0 10px}
.track{height:13px;border-radius:999px;overflow:hidden;background:#172433}
#bar{height:100%;width:0;background:linear-gradient(90deg,#119cff,#ffc21b);transition:width .18s ease}
#msg{color:#a9bed1;margin-top:14px}
</style>
</head>
<body><div class="wrap"><div class="card">
<h1>OVT Correção</h1>
<div id="pct">0%</div>
<div class="track"><div id="bar"></div></div>
<div id="msg">Recebendo arquivo do WhatsApp…</div>
</div></div>
<script>
const NAME=${escJs(name)};
const TYPE=${escJs(type)};
const B64=${escJs(b64)};
function prog(p,m){
 document.getElementById("pct").textContent=p+"%";
 document.getElementById("bar").style.width=p+"%";
 if(m) document.getElementById("msg").textContent=m;
}
function openDb(){
 return new Promise((resolve,reject)=>{
   const r=indexedDB.open("ovt-share-db",1);
   r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("shares"))db.createObjectStore("shares",{keyPath:"id"});}
   r.onsuccess=()=>resolve(r.result);
   r.onerror=()=>reject(r.error);
 });
}
(async()=>{
 try{
   prog(15,"Arquivo recebido do WhatsApp.");
   const db=await openDb();
   prog(35,"Preparando armazenamento…");
   await new Promise((resolve,reject)=>{
     const tx=db.transaction("shares","readwrite");
     tx.objectStore("shares").put({id:"pending",name:NAME,type:TYPE,b64:B64,savedAt:Date.now()});
     tx.oncomplete=()=>resolve();
     tx.onerror=()=>reject(tx.error);
   });
   db.close();
   prog(75,"Arquivo entregue ao OVT.");
   await new Promise(r=>setTimeout(r,250));
   prog(100,"Abrindo correção…");
   await new Promise(r=>setTimeout(r,250));
   location.replace("./?shared=1&v=32");
 }catch(err){
   document.getElementById("msg").textContent="Falha ao preparar o arquivo: "+(err&&err.message||err);
 }
})();
<\/script></body></html>`;

        return new Response(bridge,{headers:{"Content-Type":"text/html;charset=UTF-8"}});
      }catch(err){
        const body=`<!doctype html><meta charset="utf-8"><body style="background:#02060d;color:white;font-family:sans-serif;padding:30px"><h2>OVT Correção</h2><p>Falha ao receber o arquivo: ${String(err&&err.message||err)}</p></body>`;
        return new Response(body,{headers:{"Content-Type":"text/html;charset=UTF-8"}});
      }
    })());
    return;
  }

  if(event.request.method==="GET"){
    event.respondWith(
      fetch(event.request).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html")))
    );
  }
});
