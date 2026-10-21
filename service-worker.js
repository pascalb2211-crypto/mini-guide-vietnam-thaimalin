/* ===================== SERVICE WORKER — Mini-guide Vietnam =====================
   Pages et images du mini-guide conservées sur le téléphone pour une lecture sans internet.
   - Pages : réseau d'abord (toujours à jour en ligne), copie enregistrée en secours.
   - Images : copie enregistrée d'abord, mise à jour discrète en arrière-plan.
   - Le téléchargement complet des images se lance après la saisie du mot de passe.
   Si vous ajoutez une page ou une image NOUVELLE, ajoutez-la aux listes ci-dessous
   (ou relancez l'outil de conversion) pour qu'elle soit aussi téléchargée d'avance.
================================================================================ */
const CACHE = 'tm-mg-vietnam';
const CORE = [
  "./",
  "index.html",
  "gate.js",
  "pwa.js",
  "zones.json",
  "manifest.json",
  "page0.html",
  "page1.html",
  "page2.html",
  "page3.html",
  "page4.html",
  "page5.html",
  "page6.html",
  "page7.html",
  "page8.html",
  "page9.html",
  "page10.html",
  "page11.html",
  "page12.html",
  "page13.html",
  "page14.html",
  "page15.html",
  "page16.html",
  "page17.html",
  "page18.html",
  "page19.html",
  "page20.html",
  "page21.html",
  "page22.html",
  "page23.html",
  "page24.html",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png"
];
const IMAGES = [
  "images/cover.webp",
  "images/page1.webp",
  "images/page10.webp",
  "images/page11.webp",
  "images/page12.webp",
  "images/page13.webp",
  "images/page14.webp",
  "images/page15.webp",
  "images/page16.webp",
  "images/page17.webp",
  "images/page18.webp",
  "images/page19.webp",
  "images/page2.webp",
  "images/page20.webp",
  "images/page21.webp",
  "images/page22.webp",
  "images/page23.webp",
  "images/page24.webp",
  "images/page3.webp",
  "images/page4.webp",
  "images/page5.webp",
  "images/page6.webp",
  "images/page7.webp",
  "images/page8.webp",
  "images/page9.webp"
];

async function clean(res){
  if(!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const failed = [];
    await Promise.all(CORE.map(async u => {
      try{
        const res = await fetch(u, { cache: 'reload' });
        if(!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
        await cache.put(u, await clean(res));
      }catch(e){ failed.push(u); }
    }));
    if(failed.length){ throw new Error('Pré-cache incomplet : ' + failed.slice(0, 3).join(', ')); }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.indexOf('tm-mg-vietnam') === 0 && k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

function scopeRel(url){
  const base = new URL(self.registration.scope).pathname;
  let p = new URL(url).pathname;
  p = p.indexOf(base) === 0 ? p.slice(base.length) : p.replace(/^\//, '');
  return p;
}

async function offlinePage(req){
  let hit = await caches.match(req, { ignoreSearch: true });
  if(!hit){
    let p = scopeRel(req.url).replace(/\/+$/, '');
    const c = !p ? 'index.html' : (/\.[a-z0-9]+$/i.test(p) ? p : p + '.html');
    hit = await caches.match(c, { ignoreSearch: true });
  }
  return hit ? clean(hit) : Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // météo, taux de change, liens externes : réseau seul

  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req).then(async res => {
        if(res && res.status === 200 && res.type !== 'opaqueredirect'){
          const copy = await clean(res.clone());
          caches.open(CACHE).then(c => c.put(req, copy));
          return res.redirected ? clean(res) : res;
        }
        return res;
      }).catch(() => offlinePage(req))
    );
    return;
  }

  if(/\.(webp|png|jpe?g|gif|svg|ico)$/i.test(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if(res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    }));
    return;
  }

  event.respondWith(
    fetch(req).then(res => {
      if(res && res.status === 200){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(h => h ? clean(h) : Response.error()))
  );
});

self.addEventListener('message', event => {
  const d = event.data || {};
  const port = event.ports && event.ports[0];
  const say = m => { try{ if(port) port.postMessage(m); }catch(e){} };
  if(d.type === 'STATUS'){
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      let have = 0;
      for(const u of IMAGES){ if(await cache.match(u)) have++; }
      say({ phase: 'status', have, total: IMAGES.length });
    })());
  } else if(d.type === 'DOWNLOAD_ALL'){
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const todo = [];
      for(const u of IMAGES){ if(!(await cache.match(u))) todo.push(u); }
      let done = 0, failed = 0, i = 0;
      const total = todo.length;
      await Promise.all(Array.from({ length: Math.min(4, total) }, async () => {
        while(i < total){
          const u = todo[i++];
          try{
            const res = await fetch(u, { cache: 'reload' });
            if(!res.ok) throw new Error('HTTP ' + res.status);
            await cache.put(u, res);
          }catch(e){ failed++; }
          say({ phase: 'progress', done: ++done, total });
        }
      }));
      say({ phase: 'done', total, failed });
    })());
  }
});
