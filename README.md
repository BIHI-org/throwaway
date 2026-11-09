# Bismillah POS

Point of sale for Bismillah Restaurant (Edmonton): tables, takeout, kitchen screen, menu editor and daily sales.
It runs as a website, and phones, tablets and computers can install it as an app.

```
src/Mr_Chef_POS.html   the POS as exported from claude.ai (edit or replace this)
scripts/build.py      turns it into web/index.html
web/                  the site (deploy this folder as-is, no build step)
  index.html          the POS
  platform.js         connects the POS to Firebase (shared orders) and handles file saving
  firebase-config.js  paste your Firebase keys here
  sw.js, manifest.webmanifest, icons/   make it installable and able to open offline
firestore.rules       database security rules
.github/workflows/pages.yml   publishes web/ to GitHub Pages on every push
```

## 1. Put it online (GitHub Pages)

1. In the GitHub repo: **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` (or run the *Deploy website* workflow). The site goes up at
   `https://<owner>.github.io/<repo>/`.

Without step 2 below the POS works, but each device keeps its own orders.

## 2. Share orders across every device (Firebase, free tier)

1. Go to https://console.firebase.google.com → **Add project**.
2. **Build → Firestore Database → Create database** (production mode, pick a nearby region).
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
4. **Firestore → Rules**: paste the contents of `firestore.rules` → **Publish**.
5. **Project settings → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` object
   into `web/firebase-config.js` as `window.MRCHEF_FIREBASE = { ... }`.
6. **Authentication → Settings → Authorized domains**: add `<owner>.github.io` (or your own domain).
7. Push. The badge in the top bar changes from "This device only" to **Live**.

The first device to connect loads the starter menu. Change it in the **Menu** tab.
The Firebase web keys are not secret; the rules and the sign-in protect the data.

## 3. Install it as an app

- **iPad / iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu → **Install app**.
- **Windows / Mac (Chrome or Edge):** install icon in the address bar.

It opens full screen, without the browser bar, and still opens with no internet.
With Firebase on, orders taken offline sync when the connection comes back.

## Bismillah Restaurant setup

`data/bismillah-menu.json` holds the restaurant name, tax (5% Alberta GST) and menu, taken from
https://bismillahrest.netlify.app/menu. `scripts/build.py` uses it for the built-in starter menu and
renames the app from "Mr Chef" to Bismillah. The live menu is in the database: edit it in the Menu tab.

Market-price dishes: give a dish a price of 0 and the POS asks the waiter for the price when it is added
(Federation Mix works this way).

Test sales: open the sale from **Sales → All bills**, tap **Delete sale (admin PIN)** twice, then enter an
admin's PIN. It asks for the PIN every time, even when an admin is signed in, and refuses if no admin has
a PIN. Unlike Refund, which keeps the bill on record, this removes the bill and its refund record from
every total.

## Updating the app

Save the new export from claude.ai over `src/Mr_Chef_POS.html`, then run:

```bash
python3 scripts/build.py
```

That regenerates `web/index.html`. Push to `main` and the site updates.

## Owner login

Turned off on the website: there is no Owner button and no owner password. Protect settings with an
admin PIN instead (Settings). To turn the owner login back on, see the comment in `web/platform.js`.

## Notes

- Orders made in the old claude.ai version do not carry over; that data lives in claude.ai.
- Receipts: on tablets, Print opens the share sheet (choose Print); on computers it downloads a PDF.
- To run several restaurants from one Firebase project, give each site its own `MRCHEF_SHOP` in `firebase-config.js`.

## NS Cellphone Store POS

A second app in the same site, at `https://<owner>.github.io/<repo>/ns/`. It has its own icon, install
name ("NS Store") and offline cache, and does not share data with the Bismillah POS.

```
src/NS_Cellphone_Store.html   the POS as exported from claude.ai
scripts/build_ns.py           turns it into web/ns/index.html
web/ns/                       the NS site (manifest, sw.js, icons)
```

To update it: save the new export over `src/NS_Cellphone_Store.html`, run `python3 scripts/build_ns.py`, push.

Data is saved in each browser. To share it across devices, set up **Menu → BiixiPay Cloud** (Supabase):

1. https://supabase.com → **New project** (free plan is fine).
2. **SQL Editor → New query** → paste all of `supabase/ns-store-setup.sql` → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key into the app
   (Menu → BiixiPay Cloud → Connection → Save). Never use the `service_role` key in the app.
4. In the app: **Create account**, sign in, then **Create & upload this device's data**.
   On every other device: sign in with the same account (or add staff by email) and pick the store.

New accounts get a confirmation email by default. To skip it: Supabase → **Authentication → Sign In / Providers → Email**,
turn off **Confirm email**.
Moving from an old copy: in the old copy use **Menu → Backup → Download backup**, then on the website
use **Restore from backup**.
