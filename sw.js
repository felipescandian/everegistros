const CACHE="ovt-app-v1";
const SHARE_CACHE="ovt-share-v2";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./ovt-192.png","./ovt-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim());
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
          const key=new URL("./__shared_file__",self.registration.scope).href;
          const headers=new Headers({
            "Content-Type": file.type || "application/octet-stream",
            "X-OVT-Filename": encodeURIComponent(file.name || "registro")
          });
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
