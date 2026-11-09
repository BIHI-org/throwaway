/* Mr Chef POS platform adapter.
   The POS was written against claude.ai's artifact runtime (window.claude.use('db') and
   window.claude.use('downloads')). This file provides the same two interfaces on a normal
   website: 'db' is backed by Firebase Firestore, 'downloads' saves or shares files. */
(function () {
  if (window.claude && window.claude.use) return; // running inside claude.ai — keep the native runtime

  var dbPromise = null;

  function firestore() {
    if (dbPromise) return dbPromise;
    dbPromise = (async function () {
      var cfg = window.MRCHEF_FIREBASE;
      if (!cfg || !window.firebase || !firebase.firestore) return null; // no backend → app runs local-only
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      var fs = app.firestore();
      try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* private mode or unsupported: fine */ }
      if (firebase.auth) {
        var auth = app.auth();
        if (!auth.currentUser) await auth.signInAnonymously();
      }
      var root = 'shops/' + (window.MRCHEF_SHOP || 'mrchef') + '/';
      var mapErr = function (e) {
        var c = e && e.code;
        var code = c === 'permission-denied' ? 'invalid_argument'
          : c === 'resource-exhausted' ? 'quota_exceeded'
          : c === 'unauthenticated' ? 'revoked' : 'unavailable';
        return { code: code, message: e && e.message };
      };
      var wrapSnap = function (onNext, onError) {
        return [onNext, function (e) { if (onError) onError(mapErr(e)); }];
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
    })().catch(function (e) { console.warn('Shared orders unavailable, running on this device only:', e); return null; });
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
      // Owner-password login is turned off on the website (no Owner button, no owner password).
      // To turn it back on, return { isOwner: async () => true, id: async () => 'owner' } here.
      if (cap === 'user') return null;
      return null;
    }
  };

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
