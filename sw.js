const CACHE="ovt-app-v31";
const SHARE_CACHE="ovt-share-v31";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./ovt-192.png","./ovt-512.png"];

let pendingShare=null;

async function persistSharedFile(file){
  const buffer=await file.arrayBuffer();
  const meta={
    name:file.name||"registro",
    mime:file.type||"application/octet-stream",
    size:file.size||buffer.byteLength
  };

  // Fast path: keep it in the current service-worker process.
  pendingShare={...meta,buffer};

  // Fallback: also save it in Cache Storage in case the SW process restarts.
  try{
    const cache=await caches.open(SHARE_CACHE);
    const key=new Request(new URL("./__shared_file__",self.registration.scope).href);
    const headers=new Headers({
      "Content-Type":meta.mime,
      "X-OVT-Filename":encodeURIComponent(meta.name),
      "X-OVT-Size":String(meta.size)
    });
    const old=await cache.keys();
    await Promise.all(old.map(k=>cache.delete(k)));
    await cache.put(key,new Response(buffer,{headers}));
  }catch(err){
    console.warn("OVT share cache fallback failed",err);
  }
}

async function readPersistedShare(){
  if(pendingShare) return pendingShare;

  try{
    const cacheNames=await caches.keys();
    const shareNames=[
      SHARE_CACHE,
      "ovt-share",
      "ovt-share-v30",
      "ovt-share-v29",
      "ovt-share-v28",
      "ovt-share-v2",
      ...cacheNames.filter(n=>/^ovt-share/i.test(n))
    ].filter((v,i,a)=>a.indexOf(v)===i);

    for(const name of shareNames){
      if(!cacheNames.includes(name)) continue;
      const cache=await caches.open(name);
      const keys=await cache.keys();
      const req=keys.find(k=>k.url.includes("__shared_file__"));
      if(!req) continue;
      const res=await cache.match(req);
      if(!res) continue;

      const buffer=await res.arrayBuffer();
      if(!buffer.byteLength) continue;

      const encoded=res.headers.get("X-OVT-Filename")||"registro";
      let fileName="registro";
      try{fileName=decodeURIComponent(encoded)}catch(e){fileName=encoded}
      const mime=res.headers.get("Content-Type")||"application/octet-stream";

      pendingShare={name:fileName,mime,size:buffer.byteLength,buffer};
      return pendingShare;
    }
  }catch(err){
    console.warn("OVT could not read persisted share",err);
  }

  return null;
}

async function clearPersistedShare(){
  pendingShare=null;
  try{
    const names=await caches.keys();
    for(const name of names.filter(n=>/^ovt-share/i.test(n))){
      const cache=await caches.open(name);
      const keys=await cache.keys();
      await Promise.all(keys.map(k=>cache.delete(k)));
    }
  }catch(err){}
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

self.addEventListener("message",event=>{
  const data=event.data||{};
  if(data.type==="OVT_GET_SHARED_FILE"){
    event.waitUntil((async()=>{
      const share=await readPersistedShare();
      if(!share){
        event.source?.postMessage({
          type:"OVT_SHARED_FILE_ERROR",
          message:"Nenhum arquivo compartilhado foi localizado."
        });
        return;
      }

      // Clone before transfer so we keep a fallback copy until the page confirms load.
      const clone=share.buffer.slice(0);
      event.source?.postMessage({
        type:"OVT_SHARED_FILE",
        name:share.name,
        mime:share.mime,
        size:share.size,
        buffer:clone
      },[clone]);
    })());
  }

  if(data.type==="OVT_CLEAR_SHARED_FILE"){
    event.waitUntil(clearPersistedShare());
  }
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);

  if(event.request.method==="POST" && url.pathname.endsWith("/share-target")){
    event.respondWith((async()=>{
      let saved=false;
      let receivedName="";
      try{
        const form=await event.request.formData();
        let file=form.get("file") || form.get("pdf");

        if(!(file instanceof File) || !file.size){
          for(const value of form.values()){
            if(value instanceof File && value.size){
              file=value;
              break;
            }
          }
        }

        if(file && file.size){
          receivedName=file.name||"registro";
          await persistSharedFile(file);
          saved=true;
        }
      }catch(err){
        console.error("OVT share-target",err);
      }

      const target=new URL("./",self.registration.scope);
      target.searchParams.set("shared","1");
      target.searchParams.set("saved",saved?"1":"0");
      target.searchParams.set("v","31");
      if(receivedName) target.searchParams.set("name",receivedName);

      return Response.redirect(target.href,303);
    })());
    return;
  }

  if(event.request.method==="GET"){
    event.respondWith(
      fetch(event.request).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html")))
    );
  }
});
