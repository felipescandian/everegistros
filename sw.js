const CACHE="ovt-app-v28";
const SHARE_CACHE="ovt-share-v28";
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
        const file=form.get("file") || form.get("pdf");
        if(file && file.size){
          const cache=await caches.open(SHARE_CACHE);
          const key=new Request(new URL("./__shared_file__",self.registration.scope).href);
          const headers=new Headers({
            "Content-Type": file.type || "application/octet-stream",
            "X-OVT-Filename": encodeURIComponent(file.name || "registro"),
            "X-OVT-Size": String(file.size || 0)
          });

          // Replace any previous pending share.
          const oldKeys=await cache.keys();
          await Promise.all(oldKeys.map(k=>cache.delete(k)));
          await cache.put(key,new Response(file,{headers}));
        }
      }catch(err){
        console.error("share target",err);
      }
      return Response.redirect(new URL("./?shared=1",self.registration.scope).href,303);
    })());
    return;
  }

  if(event.request.method==="GET"){
    event.respondWith(
      fetch(event.request).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html")))
    );
  }
});
