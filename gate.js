// Protection par mot de passe du mini-guide Vietnam.
// Mot de passe calcule automatiquement chaque mois, aucune action manuelle necessaire.
// Format : VIETNAM-MM-AAAA (ex. VIETNAM-10-2026 pour octobre 2026, VIETNAM-11-2026 pour novembre...).
// A donner par email a chaque acheteur du mois.
(function () {
  function getExpectedPassword() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    return 'VIETNAM-' + mm + '-' + d.getFullYear();
  }
  function normalizePw(s) {
    return String(s).toLowerCase().replace(/[\s-]/g, '');
  }

  var saved = localStorage.getItem('tm-mg-vn-unlocked');
  if (saved && normalizePw(saved) === normalizePw(getExpectedPassword())) {
    return; // deja deverrouille ce mois-ci, rien a faire
  }

  function buildGate() {
    var style = document.createElement('style');
    style.textContent =
      '.tmVnGate{position:fixed;inset:0;background:#0f1115;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Segoe UI",Arial,sans-serif;}' +
      '.tmVnGate .box{background:#1a1d24;border:1px solid rgba(211,84,0,0.35);border-radius:18px;padding:32px 28px;max-width:360px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.5);}' +
      '.tmVnGate h2{color:#fff;font-size:1.3rem;margin:0 0 10px 0;}' +
      '.tmVnGate p{color:#b9b9b9;font-size:0.92rem;line-height:1.5;margin:0 0 20px 0;}' +
      '.tmVnGate input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:#242424;color:#fff;font-size:1rem;margin-bottom:12px;text-align:center;}' +
      '.tmVnGate button{width:100%;padding:13px;border:none;border-radius:10px;background:linear-gradient(135deg,#d35400,#f0955a);color:#fff;font-weight:700;font-size:1rem;cursor:pointer;}' +
      '.tmVnGate .err{color:#ff8a8a;font-size:0.85rem;margin-top:10px;display:none;}';
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.className = 'tmVnGate';

    var box = document.createElement('div');
    box.className = 'box';

    var h2 = document.createElement('h2');
    h2.textContent = 'Acces protege';

    var p = document.createElement('p');
    p.textContent = 'Entrez le mot de passe recu par email apres votre achat.';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Mot de passe';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Valider';

    var err = document.createElement('div');
    err.className = 'err';
    err.textContent = 'Mot de passe incorrect.';

    box.appendChild(h2);
    box.appendChild(p);
    box.appendChild(input);
    box.appendChild(btn);
    box.appendChild(err);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function tryUnlock() {
      if (normalizePw(input.value) === normalizePw(getExpectedPassword())) {
        localStorage.setItem('tm-mg-vn-unlocked', getExpectedPassword());
        overlay.remove();
      } else {
        err.style.display = 'block';
      }
    }

    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { tryUnlock(); }
    });
  }

  if (document.body) {
    buildGate();
  } else {
    document.addEventListener('DOMContentLoaded', buildGate);
  }
})();
