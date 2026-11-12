/* Bixi Chef platform adapter (bixichef.com): many restaurants, each with its own login and data.
   The POS was written against claude.ai's artifact runtime (window.claude.use('db') and 'downloads').
   This file provides the same interfaces on a normal website:
     - Before the POS opens, the restaurant signs in (email + password) or creates a new restaurant.
     - 'db' is Firebase Firestore, rooted at shops/{restaurant id}/ so each restaurant only sees its own data.
     - The 👤 button in the top bar (bixiAccount) shows the account: staff invites, switch restaurant, sign out.
   Firestore layout: shops/{id} holds name, memberIds, roles {uid: owner|staff}, emails, invites [email], sample.
   Everything the POS stores lives under shops/{id}/... and firestore.rules lets only members read or write it. */
(function () {
  if (window.claude && window.claude.use) return; // running inside claude.ai — keep the native runtime

  var SHOPKEY = 'bixi-shop', PICKKEY = 'bixi-pick';
  var app = null, auth = null, fs = null, user = null, shop = null, dbPromise = null;

  /* ---------------- small UI kit (the sign-in screens and the account panel) ---------------- */
  var CSS = '#bxGate{position:fixed;inset:0;z-index:2147483000;background:#18203A;color:#EEF1F8;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:32px 16px;font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}'
    + '#bxGate.panel{background:rgba(10,14,28,.72)}'
    + '#bxGate .card{background:#222C4A;border:1px solid #34406A;border-radius:18px;padding:22px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.35)}'
    + '#bxGate h1{margin:0 0 4px;font-size:26px}#bxGate h2{margin:0 0 10px;font-size:19px}#bxGate h3{margin:16px 0 6px;font-size:15px}'
    + '#bxGate .sub{color:#AEB7D0;font-size:14px;margin:0 0 14px}#bxGate label{display:block;font-size:13px;color:#AEB7D0;margin:10px 0 4px}'
    + '#bxGate input[type=text],#bxGate input[type=email],#bxGate input[type=password]{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #3B4877;background:#151C33;color:#EEF1F8;font-size:16px}'
    + '#bxGate .chk{display:flex;gap:8px;align-items:center;margin:12px 0 0;font-size:14px;color:#D6DCEC}'
    + '#bxGate button{font:inherit;cursor:pointer;border-radius:12px;border:0;padding:12px 16px;font-weight:700}'
    + '#bxGate .pri{background:#E8613C;color:#fff;width:100%;margin-top:16px}#bxGate .sec{background:#2E3A63;color:#EEF1F8}'
    + '#bxGate .lnk{background:none;color:#FFB48F;padding:6px 0;font-weight:600}#bxGate .tabs{display:flex;gap:6px;margin:14px 0 4px}'
    + '#bxGate .tabs button{flex:1;background:#2E3A63;color:#AEB7D0}#bxGate .tabs button.on{background:#EEF1F8;color:#18203A}'
    + '#bxGate .err{color:#FF9C8A;font-size:14px;min-height:20px;margin-top:10px}#bxGate .ok{color:#8FE3A8}'
    + '#bxGate .row{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #34406A}'
    + '#bxGate .row:last-child{border-bottom:0}#bxGate .pill{font-size:12px;background:#34406A;border-radius:999px;padding:2px 8px;margin-left:6px}'
    + '#bxGate .x{background:none;color:#AEB7D0;padding:4px 8px}#bxGate .brand{display:flex;align-items:center;gap:10px;margin-bottom:6px}'
    + '#bxGate .brand img{width:40px;height:40px;border-radius:10px}';
  function ensureCss() {
    if (document.getElementById('bxCss')) return;
    var st = document.createElement('style'); st.id = 'bxCss'; st.textContent = CSS; document.head.appendChild(st);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function show(html, panel) {
    ensureCss();
    var g = $('bxGate');
    if (!g) { g = document.createElement('div'); g.id = 'bxGate'; (document.body || document.documentElement).appendChild(g); }
    g.className = panel ? 'panel' : '';
    g.innerHTML = '<div class="card">' + html + '</div>';
    var f = g.querySelector('[autofocus]'); if (f) setTimeout(function () { f.focus(); }, 30);
    return g;
  }
  function hide() { var g = $('bxGate'); if (g) g.remove(); }
  function setErr(m, ok) { var e = $('bxErr'); if (e) { e.textContent = m || ''; e.className = 'err' + (ok ? ' ok' : ''); } }
  function busy(id, on) { var b = $(id); if (b) { b.disabled = on; b.style.opacity = on ? .6 : 1; } }
  var BRAND = '<div class="brand"><img src="icons/icon-192.png" alt=""><h1>Bixi Chef</h1></div>';

  function msg(e) {
    var c = (e && e.code) || '';
    return ({
      'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.',
      'auth/invalid-login-credentials': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email. Tap "New restaurant" to create one.',
      'auth/email-already-in-use': 'That email already has an account. Use "Sign in".', 'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'That email address is not valid.', 'auth/missing-password': 'Enter your password.',
      'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.', 'auth/network-request-failed': 'No internet connection.',
      'auth/operation-not-allowed': 'Email sign-in is not turned on in Firebase yet (Authentication → Sign-in method → Email/Password).',
      'permission-denied': 'Not allowed. Check that the latest Firestore rules are published.',
      'unavailable': 'No internet connection.'
    })[c] || (e && e.message) || String(e);
  }

  /* ---------------- Firebase ---------------- */
  async function ready() {
    if (fs) return true;
    var cfg = window.MRCHEF_FIREBASE;
    if (!cfg || !window.firebase || !firebase.firestore || !firebase.auth) return false;
    app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    auth = app.auth(); fs = app.firestore();
    try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* private mode or unsupported: fine */ }
    user = await new Promise(function (r) { var off = auth.onAuthStateChanged(function (u) { off(); r(u); }); });
    auth.onAuthStateChanged(function (u) { user = u; });
    if (user && user.isAnonymous) { await auth.signOut(); user = null; }
    return true;
  }
  var FV = function () { return firebase.firestore.FieldValue; };
  var SHOPS = function () { return fs.collection('shops'); };
  function cached() { try { var c = JSON.parse(localStorage.getItem(SHOPKEY) || 'null'); return c && user && c.uid === user.uid ? c : null; } catch (e) { return null; } }
  function remember(s) { try { localStorage.setItem(SHOPKEY, JSON.stringify({ uid: user.uid, id: s.id, name: s.name, role: s.role, sample: !!s.sample })); } catch (e) {} }
  function forget() { try { localStorage.removeItem(SHOPKEY); } catch (e) {} }
  async function freshToken() { try { await user.reload(); user = auth.currentUser; await user.getIdToken(true); } catch (e) {} }

  async function myShops() {
    var snap = await SHOPS().where('memberIds', 'array-contains', user.uid).get();
    return snap.docs.map(function (d) { var x = d.data(); return { id: d.id, name: x.name, role: (x.roles || {})[user.uid] || 'staff', sample: !!x.sample }; });
  }
  async function myInvites() {
    if (!user.email || !user.emailVerified) return [];
    var snap = await SHOPS().where('invites', 'array-contains', user.email.toLowerCase()).get();
    return snap.docs.filter(function (d) { return (d.data().memberIds || []).indexOf(user.uid) < 0; })
      .map(function (d) { return { id: d.id, name: d.data().name }; });
  }
  async function createShop(name, sample, id) {
    var ref = id ? SHOPS().doc(id) : SHOPS().doc(), em = (user.email || '').toLowerCase(), roles = {}, emails = {};
    roles[user.uid] = 'owner'; emails[user.uid] = em;
    await ref.set({ name: name, memberIds: [user.uid], roles: roles, emails: emails, invites: [], sample: !!sample, createdAt: FV().serverTimestamp() });
    return { id: ref.id, name: name, role: 'owner', sample: !!sample };
  }
  async function joinShop(s) {
    var em = user.email.toLowerCase(), upd = { memberIds: FV().arrayUnion(user.uid), invites: FV().arrayRemove(em) };
    upd['roles.' + user.uid] = 'staff'; upd['emails.' + user.uid] = em;
    await SHOPS().doc(s.id).update(upd);
    return { id: s.id, name: s.name, role: 'staff', sample: false };
  }

  /* ---------------- screens before the POS opens ---------------- */
  function signInScreen(tab) {
    return new Promise(function (done) {
      var mode = tab || 'in';
      function draw() {
        var neu = mode === 'new', staff = mode === 'staff';
        show(BRAND + '<p class="sub">Point of sale for restaurants. Each restaurant signs in to its own menu, orders and sales.</p>'
          + '<div class="tabs"><button id="bxTIn" class="' + (neu ? '' : 'on') + '">Sign in</button><button id="bxTNew" class="' + (neu ? 'on' : '') + '">New restaurant</button></div>'
          + (staff ? '<p class="sub" style="margin-top:10px">Staff account: use the email the restaurant invited.</p>' : '')
          + (neu ? '<label>Restaurant name</label><input id="bxName" type="text" autocomplete="organization" autofocus>' : '')
          + '<label>Email</label><input id="bxEm" type="email" autocomplete="username"' + (neu ? '' : ' autofocus') + '>'
          + '<label>Password' + (neu || staff ? ' (6+ characters)' : '') + '</label><input id="bxPw" type="password" autocomplete="' + (neu || staff ? 'new-password' : 'current-password') + '">'
          + (neu ? '<label class="chk"><input id="bxSample" type="checkbox"> Start with a sample menu (you can edit or delete it)</label>' : '')
          + '<div id="bxErr" class="err"></div>'
          + '<button id="bxGo" class="pri">' + (neu ? 'Create restaurant' : staff ? 'Create staff account' : 'Sign in') + '</button>'
          + (neu || staff ? '' : '<div style="display:flex;justify-content:space-between"><button id="bxForgot" class="lnk">Forgot password?</button>'
            + '<button id="bxStaff" class="lnk">Invited as staff? Create account</button></div>'));
        $('bxTIn').onclick = function () { mode = 'in'; draw(); };
        $('bxTNew').onclick = function () { mode = 'new'; draw(); };
        $('bxPw').onkeydown = function (e) { if (e.key === 'Enter') $('bxGo').click(); };
        if ($('bxStaff')) $('bxStaff').onclick = function () { mode = 'staff'; draw(); };
        if ($('bxForgot')) $('bxForgot').onclick = async function () {
          var em = $('bxEm').value.trim(); if (!em) return setErr('Type your email first.');
          try { await auth.sendPasswordResetEmail(em); setErr('Password reset email sent. Check your inbox.', true); } catch (e) { setErr(msg(e)); }
        };
        $('bxGo').onclick = async function () {
          var em = $('bxEm').value.trim(), pw = $('bxPw').value;
          var name = neu ? $('bxName').value.trim() : '', sample = neu && $('bxSample').checked;
          if (neu && !name) return setErr('Enter the restaurant name.');
          if (!em || !pw) return setErr('Enter your email and password.');
          busy('bxGo', true); setErr('');
          try {
            if (neu) {
              var r = await auth.createUserWithEmailAndPassword(em, pw); user = r.user;
              try { await user.sendEmailVerification(); } catch (e) {}
              var s = await createShop(name, sample);
              done({ shop: s });
            } else if (staff) {
              var r3 = await auth.createUserWithEmailAndPassword(em, pw); user = r3.user;
              try { await user.sendEmailVerification(); } catch (e) {}
              done({});
            } else {
              var r2 = await auth.signInWithEmailAndPassword(em, pw); user = r2.user; done({});
            }
          } catch (e) { busy('bxGo', false); setErr(msg(e)); }
        };
      }
      draw();
    });
  }

  function chooseScreen(list, invites) {
    return new Promise(function (done) {
      function draw() {
        var html = BRAND + '<p class="sub">Signed in as <b>' + esc(user.email) + '</b></p>';
        if (list.length) html += '<h2>Your restaurants</h2>' + list.map(function (s, i) {
          return '<div class="row"><div><b>' + esc(s.name) + '</b><span class="pill">' + esc(s.role) + '</span></div><button class="sec" data-open="' + i + '">Open</button></div>';
        }).join('');
        if (invites.length) html += '<h2 style="margin-top:16px">Invitations</h2>' + invites.map(function (s, i) {
          return '<div class="row"><div>Join <b>' + esc(s.name) + '</b></div><button class="sec" data-join="' + i + '">Join</button></div>';
        }).join('');
        if (!user.emailVerified) html += '<p class="sub" style="margin-top:12px">Invited by a restaurant? Confirm your email first (check your inbox), then '
          + '<button id="bxRefresh" class="lnk">refresh</button> · <button id="bxResend" class="lnk">resend email</button></p>';
        html += '<h2 style="margin-top:16px">' + (list.length ? 'Add another restaurant' : 'Set up your restaurant') + '</h2>'
          + '<label>Restaurant name</label><input id="bxName" type="text"' + (list.length ? '' : ' autofocus') + '>'
          + '<label class="chk"><input id="bxSample" type="checkbox"> Start with a sample menu</label>'
          + '<div id="bxErr" class="err"></div><button id="bxCreate" class="pri">Create restaurant</button>'
          + '<div style="display:flex;justify-content:space-between;margin-top:10px"><button id="bxLink" class="lnk">Link an existing restaurant</button><button id="bxOut" class="lnk">Sign out</button></div>';
        var g = show(html);
        g.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { done(list[+b.dataset.open]); }; });
        g.querySelectorAll('[data-join]').forEach(function (b) {
          b.onclick = async function () { try { done(await joinShop(invites[+b.dataset.join])); } catch (e) { setErr(msg(e)); } };
        });
        if ($('bxRefresh')) $('bxRefresh').onclick = async function () {
          await freshToken(); try { invites = await myInvites(); list = await myShops(); } catch (e) {} draw();
          if (!user.emailVerified) setErr('Email not confirmed yet. Click the link in the email, then refresh.');
        };
        if ($('bxResend')) $('bxResend').onclick = async function () { try { await user.sendEmailVerification(); setErr('Confirmation email sent.', true); } catch (e) { setErr(msg(e)); } };
        $('bxCreate').onclick = async function () {
          var name = $('bxName').value.trim(); if (!name) return setErr('Enter the restaurant name.');
          busy('bxCreate', true);
          try { done(await createShop(name, $('bxSample').checked)); } catch (e) { busy('bxCreate', false); setErr(msg(e)); }
        };
        $('bxLink').onclick = async function () {
          var code = (prompt('Restaurant code (from Bixi Chef support):') || '').trim();
          if (!code) return;
          try { await freshToken(); done(await createShop(code === 'mrchef' ? 'Bismillah Restaurant' : code, false, code)); }
          catch (e) { setErr(e && e.code === 'permission-denied' ? 'This account cannot link that restaurant.' : msg(e)); }
        };
        $('bxOut').onclick = signOut;
      }
      draw();
    });
  }

  function offlineScreen() {
    return new Promise(function (done) {
      show(BRAND + '<h2>No internet connection</h2><p class="sub">Connect this device to the internet once to open your restaurant. After that it also works offline.</p>'
        + '<button id="bxRetry" class="pri">Try again</button>');
      $('bxRetry').onclick = function () { done(); };
    });
  }

  async function pickShop() {
    var c = cached(), wantPick = false;
    try { wantPick = sessionStorage.getItem(PICKKEY) === '1'; sessionStorage.removeItem(PICKKEY); } catch (e) {}
    if (c && !wantPick) return c; // opens straight away, also offline
    while (true) {
      var list, invites;
      try { list = await myShops(); invites = await myInvites(); }
      catch (e) { await offlineScreen(); continue; }
      if (list.length === 1 && !invites.length && !wantPick) return list[0];
      return await chooseScreen(list, invites);
    }
  }

  async function signOut() {
    forget();
    try { await auth.signOut(); } catch (e) {}
    try { await fs.terminate(); await fs.clearPersistence(); } catch (e) {} // don't leave this restaurant's data on a shared device
    location.reload();
  }

  /* ---------------- the account panel (👤 button in the top bar) ---------------- */
  window.bixiAccount = async function () {
    if (!user || !shop) return;
    var team = null;
    async function load() {
      if (shop.role !== 'owner') return;
      try { var d = (await SHOPS().doc(shop.id).get()).data() || {}; team = { roles: d.roles || {}, emails: d.emails || {}, invites: d.invites || [] }; }
      catch (e) { team = { roles: {}, emails: {}, invites: [], err: msg(e) }; }
    }
    function draw() {
      var name = ($('bname') && $('bname').textContent) || shop.name;
      var html = '<div style="display:flex;justify-content:space-between;align-items:flex-start"><h2>' + esc(name) + '<span class="pill">' + esc(shop.role) + '</span></h2><button id="bxClose" class="x">✕</button></div>'
        + '<p class="sub">Signed in as <b>' + esc(user.email) + '</b>' + (user.emailVerified ? '' : ' · <span style="color:#FFB48F">email not confirmed</span>') + '</p>';
      if (shop.role === 'owner') {
        html += '<h3>Staff accounts</h3><p class="sub" style="margin:0 0 6px">Each device signs in once. Invite the email of anyone who should sign in to this restaurant on their own device.</p>';
        if (!team) html += '<p class="sub">Loading…</p>';
        else if (team.err) html += '<p class="err">' + esc(team.err) + '</p>';
        else {
          html += Object.keys(team.roles).map(function (id) {
            return '<div class="row"><div>' + esc(team.emails[id] || id) + '<span class="pill">' + esc(team.roles[id]) + '</span>' + (id === user.uid ? ' <span class="sub">(you)</span>' : '') + '</div>'
              + (id === user.uid ? '' : '<button class="x" data-rm="' + esc(id) + '">Remove</button>') + '</div>';
          }).join('') + team.invites.map(function (em) {
            return '<div class="row"><div>' + esc(em) + ' <span class="sub">invited</span></div><button class="x" data-un="' + esc(em) + '">✕</button></div>';
          }).join('');
          html += '<label>Invite by email</label><div style="display:flex;gap:8px"><input id="bxInv" type="email" placeholder="staff@email.com"><button id="bxInvGo" class="sec">Invite</button></div>'
            + '<p class="sub" style="margin-top:6px">On their device: open bixichef.com → <b>Invited as staff? Create account</b> with that email → click the link in the confirmation email → <b>Refresh</b> → <b>Join</b>.</p>';
        }
      }
      html += '<div id="bxErr" class="err"></div><div style="display:flex;gap:8px;margin-top:8px"><button id="bxSwitch" class="sec" style="flex:1">Switch / add restaurant</button><button id="bxOut" class="sec" style="flex:1">Sign out</button></div>';
      var g = show(html, true);
      g.onclick = function (e) { if (e.target === g) hide(); };
      $('bxClose').onclick = hide;
      $('bxOut').onclick = signOut;
      $('bxSwitch').onclick = function () { try { sessionStorage.setItem(PICKKEY, '1'); } catch (e) {} forget(); location.reload(); };
      if ($('bxInvGo')) $('bxInvGo').onclick = async function () {
        var em = $('bxInv').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(em)) return setErr('Enter their email.');
        try { await SHOPS().doc(shop.id).update({ invites: FV().arrayUnion(em) }); await load(); draw(); setErr(em + ' invited.', true); } catch (e) { setErr(msg(e)); }
      };
      g.querySelectorAll('[data-un]').forEach(function (b) {
        b.onclick = async function () { try { await SHOPS().doc(shop.id).update({ invites: FV().arrayRemove(b.dataset.un) }); await load(); draw(); } catch (e) { setErr(msg(e)); } };
      });
      g.querySelectorAll('[data-rm]').forEach(function (b) {
        b.onclick = async function () {
          var id = b.dataset.rm; if (!confirm('Remove ' + (team.emails[id] || 'this person') + '? They can no longer open this restaurant.')) return;
          var upd = { memberIds: FV().arrayRemove(id) }; upd['roles.' + id] = FV().delete(); upd['emails.' + id] = FV().delete();
          try { await SHOPS().doc(shop.id).update(upd); await load(); draw(); } catch (e) { setErr(msg(e)); }
        };
      });
    }
    draw(); await load(); if ($('bxGate')) draw();
  };

  /* ---------------- the 'db' interface the POS uses ---------------- */
  function firestore() {
    if (dbPromise) return dbPromise;
    dbPromise = (async function () {
      if (!(await ready())) return null; // Firebase not loaded → the POS runs on this device only
      var fresh = null;
      while (!user) { var r = await signInScreen(); fresh = r.shop || null; user = auth.currentUser || user; }
      shop = fresh || await pickShop();
      remember(shop); hide();
      window.BIXI_SHOP = { id: shop.id, name: shop.name, sample: !!shop.sample };
      var root = 'shops/' + shop.id + '/';
      var mapErr = function (e) {
        var c = e && e.code;
        var code = c === 'permission-denied' ? 'invalid_argument'
          : c === 'resource-exhausted' ? 'quota_exceeded'
          : c === 'unauthenticated' ? 'revoked' : 'unavailable';
        return { code: code, message: e && e.message };
      };
      var wrapSnap = function (onNext, onError) {
        return [onNext, function (e) {
          if (e && e.code === 'permission-denied') { forget(); } // removed from this restaurant: choose again next time
          if (onError) onError(mapErr(e));
        }];
      };
      var query = function (q) {
        return {
          where: function (f, op, v) { return query(q.where(f, op, v)); },
          onSnapshot: function (n, e) { var h = wrapSnap(n, e); return q.onSnapshot({ includeMetadataChanges: true }, h[0], h[1]); }
        };
      };
      return {
        doc: function (path) {
          var ref = fs.doc(root + path);
          return {
            set: function (d) { return ref.set(d).catch(function (e) { throw mapErr(e); }); },
            delete: function () { return ref.delete().catch(function (e) { throw mapErr(e); }); },
            onSnapshot: function (n, e) { var h = wrapSnap(n, e); return ref.onSnapshot({ includeMetadataChanges: true }, h[0], h[1]); }
          };
        },
        collection: function (path) { return query(fs.collection(root + path)); }
      };
    })().catch(function (e) { console.warn('Bixi Chef: running on this device only:', e); hide(); return null; });
    return dbPromise;
  }

  var downloads = {
    save: async function (opts) {
      var data = opts.data, name = opts.filename || 'file';
      var type = /\.pdf$/i.test(name) ? 'application/pdf' : /\.png$/i.test(name) ? 'image/png' : /\.csv$/i.test(name) ? 'text/csv' : 'application/octet-stream';
      var blob = data instanceof Blob ? data : new Blob([data], { type: type });
      // Phones and tablets: the share sheet offers Print, AirDrop, WhatsApp, Files…
      try {
        var file = new File([blob], name, { type: blob.type || type });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) {
          await navigator.share({ files: [file], title: name });
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') throw { code: 'declined' }; }
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
  };

  window.claude = {
    use: async function (cap) {
      if (cap === 'db') return firestore();
      if (cap === 'downloads') return downloads;
      if (cap === 'user') return null; // owner-password login is off on the website
      return null;
    }
  };

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
