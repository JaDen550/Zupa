# ZUPA Mobile (Android + iOS)

One React Native (Expo) codebase for both stores. It talks to the same Express API as the website, so products, orders, payments, coupons and settings stay in sync everywhere.

**Customer app:** home, search/filter shop, product pages with reviews, cart, wishlist, checkout (card, mobile money, bank transfer, cash on delivery), order tracking with payment retry, accounts, NLe/$ switch.
**Admin (sign in as an admin → Account → Admin portal):** dashboard, orders pipeline, payments (verify/reject, record manual payments), products CRUD, customers, coupons, store settings.

## 1. Run it on your phone (5 minutes)

```bash
# terminal 1 – the server
cd zupa
npm install
node seed.js && node server.js        # http://localhost:3000  (port busy? PORT=3001 node server.js)

# terminal 2 – the app
cd zupa/mobile
npm install
npx expo install --fix                # aligns every package to your Expo SDK
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iPhone).

### Pointing the app at the server
| Where you run the app | Server address |
|---|---|
| Android emulator | `http://10.0.2.2:3000` (default) |
| iOS simulator | `http://localhost:3000` (default) |
| **Real phone** | `http://<your-computer-LAN-IP>:3000`, with phone and computer on the same Wi-Fi |

Change it without rebuilding: **Account → Server address**, or start with `EXPO_PUBLIC_API_URL=http://192.168.0.10:3000 npx expo start`.

Demo logins: `demo@zupa.sl / demo123` (customer), `admin@zupa.sl / admin123` (admin). Test card `4242 4242 4242 4242` succeeds; numbers ending in `0` are declined.

## 2. Ship it to the stores

```bash
npm i -g eas-cli && eas login
eas build:configure
# set your real server URL in eas.json (preview/production → EXPO_PUBLIC_API_URL)
eas build -p android --profile preview      # installable .apk for testing
eas build -p all --profile production       # store builds (.aab + .ipa)
eas submit -p android      # Google Play
eas submit -p ios          # App Store
```

You will need a **Google Play developer account** (one-time $25) and an **Apple Developer account** ($99/year; iOS builds cannot be made without it). Change `sl.zupa.app` in `app.json` to your own bundle ID first.

## 3. Before real customers pay: required work

The app is feature-complete, but these parts of the backend are demo-grade and must change before launch:

1. **Host the server on HTTPS** (Render, Railway, a VPS behind Caddy/nginx). Stores and phones reject plain `http://` in production.
2. **Real payment gateway.** `/api/payments/:id/process` currently *simulates* approval, and the app sends the raw card number to your server. Replace it with a real provider's hosted/SDK flow (Monime is your intended provider: get its official API docs and credentials first, and never guess endpoints; cards via a hosted provider such as Stripe; Orange Money / Africell Money merchant APIs for mobile money) so card data never touches your server.
3. **Real database.** `data/db.json` is rewritten on every request and will corrupt or lose data under concurrent use. Move to PostgreSQL/SQLite/MongoDB.
4. **Auth hardening.** Tokens never expire and passwords have no rate limiting; add expiry, rate limits and password reset.
5. **Store requirements.** Apple and Google need a privacy policy URL, and Apple requires in-app account deletion; add a "Delete my account" endpoint and button.

## Project layout
```
mobile/
  app/            screens (file-based routing)
    (tabs)/       Home, Shop, Cart, Orders, Account
    admin/        admin portal
    product/[id]  order/[id]  checkout  login  register  wishlist
  components/     shared UI, product cards, payment sheets
  context/        app state: auth, cart, wishlist, currency, settings
  lib/            api client, theme, formatting, storage
```
