const PREFIX='gymlytics-mobile-';
const CACHE=PREFIX+'v0.5-20261011';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/polea-alta.webp','./assets/jalon-pecho.webp','./icons/icon-192.png','./icons/icon-512.png'];
const STATIC_URLS=new Set(ASSETS.map(path=>new URL(path,self.location.href).href));

self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(
  keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))
 )).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||!STATIC_URLS.has(req.url))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok){
   const cloned=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,cloned)).catch(()=>{}));
  }
  return response;
 }).catch(()=>caches.match(req).then(cached=>cached||Response.error())));
});
