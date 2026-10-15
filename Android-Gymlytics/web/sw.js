const PREFIX='gymlytics-mobile-';
const CACHE=PREFIX+'gymlytics-integridad-offline-20261015-v03';
const ASSETS=['./','./index.html','./styles.css','./app.js','./dashboard.js','./catalogo.js','./offline-first.js','./profile-policy.js','./cloud-sync.js','./sync-engine.js','./manifest.webmanifest','./assets/polea-alta.webp','./assets/jalon-pecho.webp','./icons/icon-192.png','./icons/icon-512.png'];
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
 const url=new URL(req.url);
 const generatedAsset=url.origin===self.location.origin&&
  (/\\/assets\\/[^/]+\\.(js|css|woff2?|png|webp|svg)$/.test(url.pathname)||
   (req.destination==='script'||req.destination==='style'||req.destination==='font')&&
   /\\.(js|css|woff2?)$/.test(url.pathname));
 // Vite genera chunks con nombres hash distintos del manifiesto de origen.
 // Sin almacenarlos tras una visita online, el reinicio 100% offline falla.
 if(req.method!=='GET'||!STATIC_URLS.has(req.url)&&!generatedAsset)return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok){
   const cloned=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,cloned)).catch(()=>{}));
  }
  return response;
 }).catch(()=>caches.match(req).then(cached=>cached||Response.error())));
});
