# Cafe Fresco (Storefront)

The customer-facing shop for Cafe Fresco, built with React 18 and Vite. Customers browse products, save a wishlist, build a cart, check out with a card (Stripe) or cash on delivery, and track their orders.

It is one of three projects that work together:

| Project | Purpose | Local URL |
|---|---|---|
| `cafeFresco-backend` | Express + MongoDB API | http://localhost:3000 |
| `cafeFresco-main` (this) | Storefront | http://localhost:3001 |
| `cafeFresco-dashboard` | Admin dashboard | http://localhost:5173 |

## Getting started

1. Start MongoDB and the backend first (see `cafeFresco-backend/README.md`).
2. Install and configure the storefront:

   ```bash
   npm install
   cp .env.example .env   # then fill in the values below
   npm run dev
   ```

3. Open http://localhost:3001.

The backend's `CORS_ORIGINS` must include the storefront URL (`http://localhost:3001` locally, your Vercel domain in production). Login uses an httpOnly cookie, so requests are sent with credentials.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_BASE_URL` | yes | Backend API URL, e.g. `http://localhost:3000` |
| `VITE_STRIPE_KEY` | yes for card payments | Stripe **publishable** key (`pk_test_…` / `pk_live_…`). Never put a secret key here. |
| `VITE_CURRENCY` | no | ISO currency used to format prices (default `USD`). Must match the backend currency. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3001 |
| `npm run build` | Checks import letter case (`check:case`, catches Linux/Vercel-only failures), then builds to `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | ESLint |

## How checkout works

The server is the source of truth for prices, stock and discounts. The browser never sends an amount.

1. **Cart:** every cart change goes through the API, and the page shows the cart the server returns. Quantities are capped at the available stock. Items that have been deactivated or are out of stock are shown greyed and block checkout until they're removed.
2. **Discount code:** the cart keeps only the code. `/discount/apply` is a preview computed from the server cart, re-run whenever the cart changes. Nothing is redeemed until the order is placed.
3. **Address:** delivery details are validated and kept in session storage until the order is placed.
4. **Order first:** `POST /order/create {shippingAddress, discountCode, paymentMethod}`. The server builds the order from the saved cart, reserves stock, redeems the code and empties the cart. Each attempt carries an `Idempotency-Key`, so a double click can't create two orders.
5. **Cash on delivery:** the order is complete after that one request (the payment stays unpaid until an admin marks it paid).
6. **Card:** `POST /stripe/payment-intent {orderId}` returns the order's single PaymentIntent, the card is confirmed with Stripe, and `POST /stripe/confirm` makes the server verify it and mark the order paid. A declined card keeps the order, so the customer can retry with another card or cancel.
7. **Track page (`/track`):** order history with status badges. Unpaid orders can be paid ("Pay now", card orders) or cancelled. Cancelling returns the stock and frees the discount code.

## Project structure

```
src/
  api.js                 apiFetch(): credentials, safe JSON, {ok, status, data}
  config/site.js         social links, sound toggle
  Context/ProductState   session user, cart, wishlist, derived totals, discount preview
  Components/            pages and UI (RouteGuards.jsx protects private routes)
  hooks/                 useDocumentTitle
  utils/price.js         unitPrice / formatMoney (same formula as the backend)
  utils/safeNext.js      safe ?next= redirects after login
```

## Deployment (Vercel)

- `vercel.json` rewrites every path to `/`, so deep links such as `/product/<id>` work after a refresh.
- Set `VITE_BASE_URL`, `VITE_STRIPE_KEY` and `VITE_CURRENCY` in the Vercel project settings.
- Add the storefront domain to the backend's `CORS_ORIGINS`. In production the backend sets the cookie as `Secure; SameSite=None`, so the API must be served over HTTPS.
