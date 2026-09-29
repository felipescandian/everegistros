const CACHE="ovt-app-v30";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./ovt-192.png","./ovt-512.png"];

function openShareDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open("ovt-share-db",1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains("shares")) db.createObjectStore("shares",{keyPath:"id"});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("IndexedDB indisponível"));
  });
}

async function saveSharedFile(file){
  const buffer=await file.arrayBuffer();
  const db=await openShareDb();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("shares","readwrite");
      tx.objectStore("shares").put({
        id:"pending",
        name:file.name||"registro",
        type:file.type||"application/octet-stream",
        size:file.size||buffer.byteLength,
        savedAt:Date.now(),
        buffer
      });
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error("Transação cancelada"));
    });
  }finally{
    db.close();
  }
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

        // Some Android senders may expose the first File under another form key.
        if(!(file instanceof File) || !file.size){
          for(const value of form.values()){
            if(value instanceof File && value.size){
              file=value;
              break;
            }
          }
        }

        if(file && file.size) await saveSharedFile(file);
      }catch(err){
        console.error("OVT share-target",err);
      }

      return Response.redirect(
        new URL("./?shared=1&handoff=idb&v=30",self.registration.scope).href,
        303
      );
    })());
    return;
  }

  if(event.request.method==="GET"){
    event.respondWith(
      fetch(event.request).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html")))
    );
  }
});
