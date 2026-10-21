/* ===================== MINI-GUIDE EN APPLI : installation + hors-ligne =====================
   - Enregistre le service worker (copie des pages pour fonctionner sans internet).
   - Après la saisie du mot de passe : téléchargement automatique des pages du guide
     pour une lecture sans internet (une seule fois, en ligne).
   - Bandeau « Installer » (Android / iPhone) sur la première page.
   Le mot de passe, lui, reste géré par gate.js (inchangé).
============================================================================================ */
(function(){
  'use strict';
  var me = document.currentScript || document.querySelector('script[src*="pwa.js"]');
  var NAME = (me && me.getAttribute('data-name')) || 'Mini-guide';
  var SLUG = (me && me.getAttribute('data-slug')) || 'guide';
  var WANTS_BANNER = !!(me && me.getAttribute('data-banner'));
  var UA = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /android/i.test(UA);
  var isMobile = isIOS || isAndroid;
  var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var deferred = null;

  function store(k, v){
    try{
      if(v === undefined) return localStorage.getItem(k);
      if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }catch(e){ return null; }
  }

  var css = [
    '.tmpwa-banner{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:9500;max-width:520px;margin:0 auto;background:#1a1d24;border:1px solid #d35400;border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.55);color:#fff;font-family:"Segoe UI",Arial,sans-serif}',
    '.tmpwa-banner img{width:44px;height:44px;border-radius:10px;flex:none}',
    '.tmpwa-banner p{margin:0;flex:1;font-size:14px;line-height:1.35;color:#dcd6d0}',
    '.tmpwa-banner strong{display:block;color:#f0955a;font-size:15px}',
    '.tmpwa-go{background:linear-gradient(135deg,#d35400,#f0955a);color:#fff;border:0;border-radius:24px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer;flex:none}',
    '.tmpwa-x{background:none;border:0;color:#aaa;font-size:20px;cursor:pointer;padding:4px 6px;flex:none}',
    '.tmpwa-sheet{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center;font-family:"Segoe UI",Arial,sans-serif}',
    '.tmpwa-box{background:#1a1d24;border:1px solid #333;border-radius:20px 20px 0 0;padding:24px 22px max(24px,env(safe-area-inset-bottom));max-width:520px;width:100%;color:#fff}',
    '.tmpwa-box h3{margin:0 0 12px;color:#f0955a;font-size:20px}',
    '.tmpwa-box ol{margin:0 0 16px;padding-left:20px;line-height:1.7;color:#dcd6d0}',
    '.tmpwa-box .tmpwa-go{width:100%;padding:12px 24px;font-size:15px}',
    '.tmpwa-chip{position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:100001;max-width:92%;background:#1a1d24;border:1px solid #d35400;color:#fff;border-radius:999px;padding:9px 16px;font:600 13px/1.3 "Segoe UI",Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5);text-align:center}',
    '.tmpwa-chip.ok{border-color:#2e7d4f}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- service worker ---------- */
  var swReady = null;
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('service-worker.js').catch(function(e){ console.warn('Service worker non enregistré', e); });
    });
    swReady = navigator.serviceWorker.ready;
  }

  /* ---------- installation ---------- */
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferred = e;
    if(WANTS_BANNER && !locked()) showBanner();
  });
  window.addEventListener('appinstalled', function(){
    deferred = null; var b = document.querySelector('.tmpwa-banner'); if(b) b.remove();
  });

  function sheet(title, steps){
    var wrap = document.createElement('div'); wrap.className = 'tmpwa-sheet';
    var box = document.createElement('div'); box.className = 'tmpwa-box';
    var h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
    var ol = document.createElement('ol');
    steps.forEach(function(t){ var li = document.createElement('li'); li.textContent = t; ol.appendChild(li); });
    box.appendChild(ol);
    var c = document.createElement('button'); c.type = 'button'; c.className = 'tmpwa-go'; c.textContent = 'J’ai compris';
    c.addEventListener('click', function(){ wrap.remove(); });
    wrap.addEventListener('click', function(ev){ if(ev.target === wrap) wrap.remove(); });
    box.appendChild(c); wrap.appendChild(box); document.body.appendChild(wrap);
  }

  function install(){
    if(deferred){
      var d = deferred; deferred = null; d.prompt();
      d.userChoice.then(function(){ var b = document.querySelector('.tmpwa-banner'); if(b) b.remove(); });
      return;
    }
    if(isIOS){
      sheet('Installer le mini-guide sur votre iPhone', [
        'Ouvrez cette page dans Safari.',
        'Touchez l’icône Partager (le carré avec une flèche vers le haut).',
        'Choisissez « Sur l’écran d’accueil », puis touchez « Ajouter ».'
      ]);
    } else {
      sheet('Installer le mini-guide sur votre téléphone', [
        'Ouvrez cette page dans Chrome.',
        'Touchez le menu ⋮ en haut à droite.',
        'Choisissez « Installer l’application » (ou « Ajouter à l’écran d’accueil »).'
      ]);
    }
  }

  function showBanner(){
    if(isStandalone || !isMobile || document.querySelector('.tmpwa-banner')) return;
    var off = parseInt(store('tmpwa_banner_off_' + SLUG) || '0', 10);
    if(off && Date.now() - off < 14 * 24 * 3600 * 1000) return;
    var bar = document.createElement('div'); bar.className = 'tmpwa-banner';
    var img = document.createElement('img'); img.src = 'icons/icon-192.png'; img.alt = '';
    var p = document.createElement('p');
    var s = document.createElement('strong'); s.textContent = 'Installez le mini-guide';
    p.appendChild(s); p.appendChild(document.createTextNode('Utilisable sans internet, depuis votre écran d’accueil.'));
    var go = document.createElement('button'); go.type = 'button'; go.className = 'tmpwa-go'; go.textContent = 'Installer';
    go.addEventListener('click', install);
    var x = document.createElement('button'); x.type = 'button'; x.className = 'tmpwa-x'; x.setAttribute('aria-label', 'Fermer'); x.textContent = '✕';
    x.addEventListener('click', function(){ store('tmpwa_banner_off_' + SLUG, String(Date.now())); bar.remove(); });
    [img, p, go, x].forEach(function(n){ bar.appendChild(n); });
    document.body.appendChild(bar);
  }

  /* ---------- téléchargement hors-ligne (après le mot de passe) ---------- */
  var chip = null;
  function say(text, ok, ms){
    if(!chip){ chip = document.createElement('div'); chip.className = 'tmpwa-chip'; document.body.appendChild(chip); }
    chip.className = 'tmpwa-chip' + (ok ? ' ok' : ''); chip.textContent = text;
    if(ms){ var c = chip; setTimeout(function(){ if(chip === c){ c.remove(); chip = null; } }, ms); }
  }

  function ask(msg, onProgress){
    return swReady.then(function(reg){
      return new Promise(function(resolve, reject){
        var sw = reg.active; if(!sw){ reject(new Error('indisponible')); return; }
        var ch = new MessageChannel();
        ch.port1.onmessage = function(e){
          var m = e.data || {};
          if(m.phase === 'progress' && onProgress) onProgress(m);
          else if(m.phase === 'status' || m.phase === 'done') resolve(m);
          else if(m.phase === 'error') reject(new Error(m.message || 'erreur'));
        };
        sw.postMessage(msg, [ch.port2]);
      });
    });
  }

  var started = false;
  function offlineSetup(){
    if(started || !swReady || isNetworkOff()) return;
    started = true;
    ask({ type: 'STATUS' }).then(function(s){
      if(s.have >= s.total) { return; }
      say('📥 Téléchargement du guide pour le hors-ligne…');
      return ask({ type: 'DOWNLOAD_ALL' }, function(m){
        say('📥 Téléchargement du guide… ' + Math.round(100 * m.done / Math.max(1, m.total)) + ' %');
      }).then(function(r){
        if(r.failed){
          say('Téléchargement incomplet (' + r.failed + ' page(s)). Touchez ici pour réessayer.', false);
          chip.style.cursor = 'pointer'; chip.onclick = function(){ started = false; offlineSetup(); };
        } else {
          say('✓ Guide disponible hors-ligne', true, 4000);
        }
      });
    }).catch(function(){ started = false; if(chip){ chip.remove(); chip = null; } });
  }
  function isNetworkOff(){ return navigator.onLine === false; }

  /* ---------- déverrouillage (gate.js affiche un écran « Accès protégé ») ---------- */
  function locked(){
    var g = document.getElementById('pwGate');          /* guide en une seule page (écran #pwGate masqué par la classe « hidden ») */
    if(g) return !g.classList.contains('hidden');
    return !!document.querySelector('[class*="Gate"]');
  }
  var done = false;
  function onUnlocked(){
    if(done) return; done = true;
    if(WANTS_BANNER){ if(isIOS) showBanner(); else if(deferred) showBanner(); }
    offlineSetup();
  }
  function watch(){
    if(!locked()){ onUnlocked(); return; }
    var mo = new MutationObserver(function(){ if(!locked()){ mo.disconnect(); onUnlocked(); } });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('online', function(){ if(done) offlineSetup(); });
  if(document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();

/* ===================== BARRE DE BOUTONS EN BAS (téléphone et tablette) =====================
   Dans le navigateur, rien ne change. Une fois le guide installé, une barre fixe en bas de l'écran
   donne un accès direct : couverture, page précédente / suivante, liste des pages (ou sommaire).
========================================================================================================= */
(function(){
  'use strict';
  var me = document.querySelector('script[src*="pwa.js"]');
  var MODE = me && me.getAttribute('data-nav');                 /* "pages" = une page HTML par page ; "spa" = guide en une seule page */
  if(!MODE) return;
  if(window.top !== window.self) return;
  var TOTAL = parseInt(me.getAttribute('data-total') || '0', 10);
  var FIRST = parseInt(me.getAttribute('data-first') || '1', 10);   /* 0 si le guide a une couverture page0 */

  function ready(fn){ if(document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function locked(){
    var g = document.getElementById('pwGate');
    if(g) return !g.classList.contains('hidden');
    return !!document.querySelector('[class*="Gate"]');
  }
  var css = '#tmTab{display:none;position:fixed;left:0;right:0;bottom:0;z-index:1500;background:#0d1117f2;border-top:1px solid #ffffff1f;padding:6px 4px max(8px,env(safe-area-inset-bottom));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-family:"Segoe UI",Arial,sans-serif}' +
    '#tmTab button{flex:1;min-width:0;border:0;background:none;color:#cfd6dd;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;font:600 10.5px/1.1 "Segoe UI",Arial,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '#tmTab button b{font-size:21px;line-height:1;font-weight:400}#tmTab button:active{background:#ffffff14;border-radius:10px}' +
    '#tmTab button.on{color:#f0955a}#tmTab button[disabled]{opacity:.35}' +
    '#tmTab .mid b{font:800 15px/1 "Segoe UI",Arial,sans-serif;color:#fff;margin-top:3px}' +
    '#tmSheet{position:fixed;inset:0;z-index:1600;background:#000a;display:none;align-items:flex-end;justify-content:center}#tmSheet.open{display:flex}' +
    '#tmSheet .box{width:100%;max-width:560px;max-height:78vh;overflow:auto;background:#161a21;color:#fff;border-radius:20px 20px 0 0;padding:16px 16px max(18px,env(safe-area-inset-bottom));font-family:"Segoe UI",Arial,sans-serif}' +
    '#tmSheet h3{margin:0 0 12px;font-size:16px}#tmSheet .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}' +
    '#tmSheet .grid a,#tmSheet .grid button,#tmSheet .list button{border:1px solid #ffffff2a;background:#ffffff0d;color:#fff;border-radius:12px;padding:12px 0;text-align:center;text-decoration:none;font:700 15px "Segoe UI",Arial,sans-serif;cursor:pointer}' +
    '#tmSheet .book a{display:block;border:1px solid #ffffff2a;background:#ffffff0d;color:#fff;border-radius:12px;padding:12px 16px;text-decoration:none}#tmSheet .book a b{display:block;font-size:15px}#tmSheet .book a small{opacity:.7;font-size:12.5px}#tmSheet .toc button{display:flex;align-items:center;gap:12px;width:100%}#tmSheet .toc .num{flex:0 0 34px;height:34px;border-radius:50%;background:#ffffff1a;display:flex;align-items:center;justify-content:center;font-size:14px}#tmSheet .toc .cur{background:#d3540033;border-color:#d35400}#tmSheet .toc .cur .num{background:#d35400}#tmSheet .toc .addfav{background:#d35400;border-color:#d35400;margin-bottom:6px}#tmSheet .grid .cur{background:#d35400;border-color:#d35400}#tmSheet .list{display:grid;gap:8px}#tmSheet .list button{text-align:left;padding:14px 16px;font-size:15px}' +
    '@media(max-width:800px){#tmTab{display:flex}#tmTab.lock{display:none}body.tmHasTab{padding-bottom:calc(84px + env(safe-area-inset-bottom)) !important}body.tmHasTab .zoomBtn{bottom:92px}}';

  function el(tag, attrs, html){ var e = document.createElement(tag); for(var k in attrs||{}) e.setAttribute(k, attrs[k]); if(html != null) e.innerHTML = html; return e; }
  function btn(icon, label, fn, cls){ var b = el('button', { type: 'button', 'class': cls || '' }, '<b>' + icon + '</b>' + label); b.addEventListener('click', fn); return b; }

  function build(){
    if(document.getElementById('tmTab')) return;
    var st = el('style', {}, css); document.head.appendChild(st);
    var bar = el('div', { id: 'tmTab', role: 'navigation', 'aria-label': 'Navigation du guide' });
    var sheet = el('div', { id: 'tmSheet' }); var box = el('div', { 'class': 'box' }); sheet.appendChild(box); document.body.appendChild(sheet);
    sheet.addEventListener('click', function(e){ if(e.target === sheet) sheet.classList.remove('open'); });
    function openSheet(title, node){ box.innerHTML = ''; box.appendChild(el('h3', {}, title)); box.appendChild(node); sheet.classList.add('open'); }

    if(MODE === 'pages'){
      var m = location.pathname.match(/page(\d+)(\.html)?$/); var cur = m ? parseInt(m[1], 10) : FIRST;
      var last = TOTAL || cur;
      var slug = (me.getAttribute('data-slug') || 'guide');
      function url(n){ return 'page' + n + '.html'; }
      var TOC = {}; (me.getAttribute('data-toc') || '').split(';').forEach(function(x){ var i = x.indexOf('|'); if(i > 0) TOC[parseInt(x.slice(0, i), 10)] = x.slice(i + 1); });
      function title(n){ return TOC[n] || ('Page ' + n); }
      var FK = 'tm-fav-' + slug;
      function favs(){ try{ return JSON.parse(localStorage.getItem(FK) || '[]'); }catch(e){ return []; } }
      function saveFavs(a){ try{ localStorage.setItem(FK, JSON.stringify(a)); }catch(e){} }
      function row(n, extra){ var b = el('button', { type: 'button', 'class': n === cur ? 'cur' : '' }, '<span class="num">' + (n === 0 ? '★' : n) + '</span>' + title(n) + (extra || '')); b.addEventListener('click', function(){ location.href = url(n); }); return b; }
      var cover = btn('📕', 'Couverture', function(){ location.href = url(FIRST); });
      var toc = btn('☷', 'Sommaire', function(){
        var l = el('div', { 'class': 'list toc' }); for(var n = FIRST; n <= last; n++) l.appendChild(row(n));
        openSheet('Sommaire', l);
        var c = l.querySelector('.cur'); if(c) setTimeout(function(){ c.scrollIntoView({ block: 'center' }); }, 30);
      });
      var fav = btn('♡', 'Favoris', function(){
        var l = el('div', { 'class': 'list toc' }); var f = favs(); var on = f.indexOf(cur) >= 0;
        var add = el('button', { type: 'button', 'class': 'addfav' }, on ? '♥ Retirer cette page des favoris' : '♡ Ajouter cette page aux favoris');
        add.addEventListener('click', function(){ var g = favs(); var i = g.indexOf(cur); if(i >= 0) g.splice(i, 1); else g.push(cur); g.sort(function(x, y){ return x - y; }); saveFavs(g); refreshFav(); sheet.classList.remove('open'); });
        l.appendChild(add);
        if(!f.length) l.appendChild(el('p', { style: 'margin:6px 2px;opacity:.7;font-size:14px' }, 'Aucun favori pour le moment.')); else f.forEach(function(n){ l.appendChild(row(n)); });
        openSheet('Mes favoris', l);
      });
      function refreshFav(){ var on = favs().indexOf(cur) >= 0; var i = fav.querySelector('b'); i.textContent = on ? '♥' : '♡'; fav.classList.toggle('on', on); }
      refreshFav();
      var items = [cover, toc, fav];
      var WX = me.getAttribute('data-weather');                  /* "Ville:lat,lon;Ville:lat,lon" */
      if(WX){
        var wx = btn('🌤️', 'Météo', function(){
          var l = el('div', { 'class': 'wx' }, '<p style="margin:0;opacity:.7">Chargement…</p>'); openSheet('Météo en direct', l);
          var places = WX.split(';').map(function(x){ var a = x.split(':'); var c = a[1].split(','); return { n: a[0], la: c[0], lo: c[1] }; });
          var ico = function(c){ return c === 0 ? '☀️' : c < 3 ? '⛅' : c < 4 ? '☁️' : c < 50 ? '🌫️' : c < 70 ? '🌧️' : c < 80 ? '🌨️' : c < 85 ? '🌦️' : c < 95 ? '🌧️' : '⛈️'; };
          Promise.all(places.map(function(p){
            return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + p.la + '&longitude=' + p.lo + '&current=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3')
              .then(function(r){ return r.json(); }).then(function(d){ p.d = d; return p; });
          })).then(function(r){
            l.innerHTML = r.map(function(p){ var d = p.d, c = d.current, dl = d.daily;
              var days = [0,1,2].map(function(i){ return '<span style="flex:1;text-align:center;font-size:12px;opacity:.85">' + ['Auj.','Demain','Après'][i] + '<br>' + Math.round(dl.temperature_2m_min[i]) + '–' + Math.round(dl.temperature_2m_max[i]) + '°<br>💧' + (dl.precipitation_probability_max[i] || 0) + '%</span>'; }).join('');
              return '<div style="border:1px solid #ffffff2a;background:#ffffff0d;border-radius:14px;padding:12px 14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:16px">' + p.n + '</b><span style="font-size:22px">' + ico(c.weather_code) + ' ' + Math.round(c.temperature_2m) + '°C</span></div><div style="font-size:12px;opacity:.7;margin:2px 0 8px">Humidité ' + c.relative_humidity_2m + '%</div><div style="display:flex;gap:6px">' + days + '</div></div>'; }).join('');
          }).catch(function(){ l.innerHTML = '<p style="margin:0">La météo a besoin d\'une connexion Internet. Réessaie quand tu es en ligne.</p>'; });
        });
        items.push(wx);
      }
      var BK = me.getAttribute('data-booking');                  /* code pays Booking : vn, la, kh, th */
      if(BK){
        var BP = parseInt(me.getAttribute('data-booking-page') || '0', 10);   /* page « Centre de réservation » du guide, si elle existe */
        var bk = btn('🧳', 'Réserver', function(){
          if(BP){ location.href = url(BP); return; }
          var rows = [
            ['✈️ Vols', 'Comparer et réserver sur Trip.com', 'https://fr.trip.com/?Allianceid=9852508&SID=327644129&trip_sub3=D19106369&locale=fr-fr'],
            ['🏨 Hôtels', 'Hébergements sur Booking.com', 'https://www.dpbolvw.net/click-101855269-12677526?url=' + encodeURIComponent('https://www.booking.com/country/' + BK + '.fr.html')],
            ['🎟️ Activités', 'Excursions et visites sur Klook', 'https://www.klook.com/fr/?aid=129660'],
            ['📶 eSIM', 'Internet dès l’arrivée (Airalo)', 'https://airalo.pxf.io/PzWeQQ'],
            ['📶 eSIM illimitée', 'Holafly, code promo THAIMALIN', 'https://holafly.sjv.io/OYdRjN'],
            ['🛡️ Assurance voyage', 'SafetyWing', 'https://safetywing.com/nomad-insurance?referenceID=26576610&campaign=thai-malin&utm_campaign=thai-malin&utm_source=26576610&utm_medium=Ambassador']];
          var l = el('div', { 'class': 'list book' });
          rows.forEach(function(r){ l.appendChild(el('a', { href: r[2], target: '_blank', rel: 'noopener sponsored' }, '<b>' + r[0] + '</b><small>' + r[1] + '</small>')); });
          openSheet('Réserver mon voyage', l);
        });
        items.push(bk);
      }
      var pdf = btn('🖨️', 'PDF', function(){ printAll(); });
      items.push(pdf);
      items.forEach(function(b){ bar.appendChild(b); });
    } else {                                                      /* guide en une seule page (fonctions déjà présentes dans index.html) */
      function call(f){ try{ f(); }catch(e){} }
      bar.appendChild(btn('📕', 'Couverture', function(){ call(function(){ tmCoverShow(); }); }));
      bar.appendChild(btn('◀', 'Précédent', function(){ call(function(){ go(page - 1); }); }));
      bar.appendChild(btn('☷', 'Sommaire', function(){ call(function(){ show('summary'); }); }));
      bar.appendChild(btn('▶', 'Suivant', function(){ call(function(){ go(page + 1); }); }));
      bar.appendChild(btn('⋯', 'Outils', function(){
        var l = el('div', { 'class': 'list' });
        [['🔗 Liens utiles', 'links'], ['☑️ Ma checklist', 'checklist'], ['💱 Euro ↔ Baht', 'convert'], ['⏱️ Compte à rebours', 'countdown'], ['❤️ Mes favoris', 'favorites']].forEach(function(x){
          var b = el('button', { type: 'button' }, x[0]); b.addEventListener('click', function(){ sheet.classList.remove('open'); call(function(){ show(x[1]); }); }); l.appendChild(b); });
        var fav = el('button', { type: 'button' }, '♡ Ajouter cette page aux favoris'); fav.addEventListener('click', function(){ sheet.classList.remove('open'); call(function(){ toggleFavorite(); }); }); l.appendChild(fav);
        openSheet('Outils', l);
      }));
    }
    document.body.appendChild(bar); document.body.classList.add('tmHasTab');
  }

  /* Agrandissement : un appui sur une case de la page l'ouvre seule, en grand (zones dans zones.json).
     En dehors d'une case : agrandissement centré sur l'endroit touché. */
  var ZONES = null;
  function loadZones(){
    try{ fetch('zones.json', { cache: 'no-cache' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ ZONES = j; }).catch(function(){}); }catch(e){}
  }
  function zoneAt(n, x, y){
    var zs = (ZONES && ZONES[n]) || []; var best = null, ba = 1e12;
    zs.forEach(function(z){ if(x >= z[0] && x <= z[2] && y >= z[1] && y <= z[3]){ var a = (z[2] - z[0]) * (z[3] - z[1]); if(a < ba){ ba = a; best = z; } } });
    return best;
  }
  function zoomSetup(){
    var img = document.querySelector('.page img'); var mm = location.pathname.match(/page(\d+)(\.html)?$/); if(!img || (mm && parseInt(mm[1], 10) === FIRST)) return;
    var n = mm ? parseInt(mm[1], 10) : 0;
    loadZones();
    var z = el('div', { id: 'tmZoom' }); var zi = el('img', { alt: '' }); var zx = el('button', { type: 'button', 'aria-label': 'Fermer' }, '✕'); z.appendChild(zi); z.appendChild(zx); document.body.appendChild(z);
    var zc = document.createElement('style'); zc.textContent = '#tmZoom{position:fixed;inset:0;z-index:1700;background:#000f;overflow:auto;display:none;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y pinch-zoom}#tmZoom.open{display:block}#tmZoom img{display:block;width:170%;max-width:none;height:auto}#tmZoom button{position:fixed;top:max(12px,env(safe-area-inset-top));right:12px;width:44px;height:44px;border-radius:50%;border:0;background:#000b;color:#fff;font-size:22px;z-index:1}.page img{cursor:zoom-in}'; document.head.appendChild(zc);
    function close(){ z.classList.remove('open'); document.documentElement.style.overflow = ''; }
    zx.addEventListener('click', close); z.addEventListener('click', function(e){ if(e.target === z) close(); });
    img.addEventListener('click', function(e){
      var r = img.getBoundingClientRect(); var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      var zone = zoneAt(n, fx * 1024, fy * 1536);
      zi.style.width = ''; zi.src = img.currentSrc || img.src; z.classList.add('open'); document.documentElement.style.overflow = 'hidden';
      function place(){
        var VW = z.clientWidth || innerWidth, VH = z.clientHeight || innerHeight;
        if(zone){
          var zw = zone[2] - zone[0], zh = zone[3] - zone[1]; var IW = Math.min(VW * 0.94 / (zw / 1024), VW * 4.5); zi.style.width = IW + 'px';
          var IH = zi.offsetHeight || IW * 1.5;
          z.scrollLeft = Math.max(0, zone[0] / 1024 * IW - VW * 0.03);
          z.scrollTop = Math.max(0, zone[1] / 1536 * IH - Math.max(40, (VH - zh / 1536 * IH) / 2));
        } else {
          z.scrollLeft = Math.max(0, fx * zi.offsetWidth - VW / 2); z.scrollTop = Math.max(0, fy * zi.offsetHeight - VH / 2);
        }
      }
      place(); if(zi.complete) requestAnimationFrame(place); else zi.addEventListener('load', place, { once: true });
    });
    /* petit conseil au premier affichage */
    try{ if(!localStorage.getItem('tm-zone-hint')){ var h = el('div', { id: 'tmHint' }, '💡 Touche une case pour l’agrandir'); var hc = document.createElement('style'); hc.textContent = '#tmHint{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translate(-50%,20px);background:#1a1d24;color:#fff;border:1px solid #d35400;border-radius:999px;padding:10px 16px;font:700 14px "Segoe UI",Arial,sans-serif;z-index:1650;opacity:0;pointer-events:none;transition:.4s;white-space:nowrap}#tmHint.on{opacity:1;transform:translate(-50%,0)}'; document.head.appendChild(hc); document.body.appendChild(h); setTimeout(function(){ h.classList.add('on'); }, 1500); setTimeout(function(){ h.classList.remove('on'); localStorage.setItem('tm-zone-hint', '1'); }, 6500); } }catch(e){}
  }

  /* Impression / PDF : toutes les pages du guide, une par feuille A4 */
  function printAll(){
    var old = document.getElementById('tmPrint'); if(old) old.remove();
    var box = el('div', { id: 'tmPrint' }); var imgs = [];
    var cur = document.querySelector('.page img'); var src = cur ? (cur.getAttribute('src') || '') : '';
    var mm = src.match(/^(.*?)page(\d+)(\.\w+)$/); var base = mm ? mm[1] : 'images/'; var ext = mm ? mm[3] : '.webp';
    for(var n = FIRST; n <= (TOTAL || 0); n++){
      var im = new Image(); im.alt = ''; im.src = (n === 0 ? base + 'cover' + ext : base + 'page' + n + ext); box.appendChild(im); imgs.push(im);
    }
    document.body.appendChild(box);
    var st = document.getElementById('tmPrintCss');
    if(!st){ st = document.createElement('style'); st.id = 'tmPrintCss'; st.textContent = '#tmPrint{display:none}@page{size:A4;margin:0}@media print{body>*:not(#tmPrint){display:none!important}#tmPrint{display:block!important}#tmPrint img{display:block;width:198mm;height:297mm;margin:0 auto;object-fit:contain;break-after:page;page-break-after:always}html,body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}'; document.head.appendChild(st); }
    Promise.all(imgs.map(function(i){ return i.complete ? 1 : new Promise(function(r){ i.onload = i.onerror = r; }); })).then(function(){ setTimeout(function(){ window.print(); }, 150); });
  }
  function sync(){ var bar = document.getElementById('tmTab'); if(bar) bar.classList.toggle('lock', locked()); }
  ready(function(){
    build(); sync(); if(MODE === 'pages') zoomSetup();
    new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
})();
