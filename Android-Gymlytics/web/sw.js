const PREFIX='gymlytics-mobile-';
const CACHE=PREFIX+'gymlytics-bloques-perfil-catalogo-fotos-20261016-v06';
const ASSETS=['./','./index.html','./styles.css','./app.js','./dashboard.js','./offline-first.js','./offline-catalog-download.js','./catalog-sync-engine.js','./reference-overrides.js','./photo-sync-engine.js','./profile-policy.js','./cloud-sync.js','./sync-engine.js','./legacy-compat.js','./manifest.webmanifest','./assets/polea-alta.webp','./assets/jalon-pecho.webp','./icons/icon-192.png','./icons/icon-512.png'];
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
 const extension=url.pathname.split('.').pop()?.toLowerCase();
 const generatedAsset=url.origin===self.location.origin&&(
  url.pathname.includes('/assets/')&&['js','css','woff','woff2','png','webp','svg'].includes(extension)||
  ['script','style','font'].includes(req.destination)&&['js','css','woff','woff2'].includes(extension)
 );
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
