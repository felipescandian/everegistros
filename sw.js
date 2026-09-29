const CACHE="ovt-app-v40";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./ovt-192.png","./ovt-512.png"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("ovt-app-")&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method==="POST" && url.pathname.endsWith("/share-target")){
    event.respondWith(Response.redirect(new URL("./?shared=1&fallback=1&v=40",self.registration.scope).href,303));
    return;
  }
  if(event.request.method==="GET"){
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html"))));
  }
});