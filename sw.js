const CACHE="ovt-app-v38";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./ovt-192.png","./ovt-512.png"];

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
          <button onclick="location.href='./?shared=1&fallback=1&v=38'" style="border:0;border-radius:14px;padding:16px 18px;background:#ffb800;font-weight:800">
            Abrir OVT e selecionar o arquivo
          </button>
          </body></html>`;
          return new Response(fail,{headers:{"Content-Type":"text/html;charset=UTF-8"}});
        }

        // The app's mobile fallback is the stable path on Samsung/WhatsApp.
        const target=new URL("./",self.registration.scope);
        target.searchParams.set("shared","1");
        target.searchParams.set("fallback","1");
        target.searchParams.set("v","38");
        return Response.redirect(target.href,303);
      }catch(err){
        return Response.redirect(new URL("./?shared=1&fallback=1&v=38",self.registration.scope).href,303);
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
