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
    '.tmpwa-banner{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:2500;max-width:520px;margin:0 auto;background:#1a1d24;border:1px solid #d35400;border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.55);color:#fff;font-family:"Segoe UI",Arial,sans-serif}',
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
