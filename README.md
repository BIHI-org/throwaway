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
firestore.rules       database security rules (Bismillah and NS Cellphone Store)
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

## Bixi Chef (bixichef.com): many restaurants

`bixichef/` is the same POS for any number of restaurants. Each restaurant signs in with its own email and
password and only ever sees its own menu, orders and sales. `scripts/build.py` builds it next to the Bismillah site.

```
bixichef/index.html     the POS (built; do not edit)
bixichef/platform.js    sign-in, create or choose a restaurant, staff invites, the 👤 account panel
bixichef/…              offline support, install icon, Firebase keys
```

- **New restaurant:** bixichef.com → **New restaurant** → name, email, password (optionally a sample menu).
- **Staff on their own device:** the owner taps **👤 → Invite by email**. The staff member opens bixichef.com →
  **Invited as staff? Create account** with that email → clicks the link in the confirmation email → **Refresh** → **Join**.
  A tablet everyone shares just signs in once with the owner's account; staff then use their PINs inside the POS as before.
- **Bismillah:** its data stays where it is (`shops/mrchef`). Its current site keeps working until the owner links it:
  put the owner's email in `bismillahOwner()` in `firestore.rules` and publish, then on bixichef.com sign in with that
  email (confirmed) → **Link an existing restaurant** → code `mrchef`. From then on its old tablets must sign in on bixichef.com.

One-time setup: publish `firestore.rules` (Firestore → Rules), keep **Email/Password** sign-in on, and add `bixichef.com`
under Authentication → Settings → Authorized domains. Hosting: Cloudflare Pages connected to this repository,
production branch `main`, no build command, output directory `bixichef`, custom domain `bixichef.com`.

## Updating the app

Save the new export from claude.ai over `src/Mr_Chef_POS.html`, then run:

```bash
python3 scripts/build.py
```

That regenerates `web/index.html` and `bixichef/index.html`. Push to `main` and the site updates.

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
src/ns_cloud_firebase.js      BiixiPay Cloud sync on Firebase (replaces the export's Supabase sync)
scripts/build_ns.py           turns it into web/ns/index.html
web/ns/                       the NS site (manifest, sw.js, icons)
```

It now has its own repository and address: **nscellphone01/nsphonerepair**, live at https://nsphonerepair.ca.
Make NS changes there; this copy at `/ns/` is no longer updated.

To update it: save the new export over `src/NS_Cellphone_Store.html`, run `python3 scripts/build_ns.py`, push.

Data is saved in each browser. **BiixiPay Cloud** shares it across devices through the same Firebase project
as the Bismillah POS (`mrchef-b8507`), in its own `nsStores` collection. People sign in with email and password,
and only members of a store can read or change its data. One-time setup in the Firebase console:

1. **Authentication → Sign-in method → Add new provider → Email/Password → Enable** (leave Anonymous on for Bismillah).
2. **Firestore Database → Rules**: replace everything with the contents of `firestore.rules` → **Publish**.
   The file keeps the Bismillah rule and adds the NS one.

Then in the app, **Menu → BiixiPay Cloud**: **Create account**, then **Create & upload this device's data**.
For staff: invite their email there; on their device they tap **Create account** with that email, click the
confirmation link in the email they get, then **Join**. Owners can remove staff from the same screen.

The sync code is `src/ns_cloud_firebase.js`; `scripts/build_ns.py` puts it in place of the export's Supabase sync.
Moving from an old copy: in the old copy use **Menu → Backup → Download backup**, then on the website
use **Restore from backup**.
