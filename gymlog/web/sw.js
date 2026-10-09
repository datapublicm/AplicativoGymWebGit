const CACHE='gymlog-mobile-v0.2-20261009';
const ASSETS=['./','./index.html','./styles.css','./catalogo.js','./app.js','./manifest.webmanifest','./assets/polea-alta.webp','./assets/jalon-pecho.webp','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(response=>{
   if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(req,clone)).catch(()=>{});}
   return response;
 }).catch(async()=>await caches.match(req)||Response.error()));
});
