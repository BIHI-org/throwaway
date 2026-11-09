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

## Updating the app

Save the new export from claude.ai over `src/Mr_Chef_POS.html`, then run:

```bash
python3 scripts/build.py
```

That regenerates `web/index.html`. Push to `main` and the site updates.

## Owner login

On claude.ai only the artifact's owner sees the Owner button. A website can't tell who the owner is,
so every device shows it and the **owner password** alone protects it. It needs Firebase
(it is hidden in "This device only" mode). Set the owner password as soon as Firebase is connected:
until then, whoever opens the POS first could set it.

## Notes

- Orders made in the old claude.ai version do not carry over; that data lives in claude.ai.
- Receipts: on tablets, Print opens the share sheet (choose Print); on computers it downloads a PDF.
- To run several restaurants from one Firebase project, give each site its own `MRCHEF_SHOP` in `firebase-config.js`.
