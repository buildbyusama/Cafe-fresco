# Cafe Fresco: Shared Decisions for Both Audits

**Applies to:** [dashboard/DASHBOARD_AUDIT.md](dashboard/DASHBOARD_AUDIT.md) and [main/MAIN_SITE_AUDIT.md](main/MAIN_SITE_AUDIT.md).
**Rule:** if a step in either audit contradicts this file, **this file wins**. Both audits were cross-checked against it on 2026-10-27, and the conflicting step texts were corrected. The file exists so the backend is built **once**, in a way both frontends agree on.

Ports (local): backend `:3000`, dashboard `:5173`, main shop `:3001`. The backend deploys to **Vercel serverless** (`@vercel/node`), so **no `setInterval` or background jobs**. Anything periodic runs lazily inside a request (see D9).

---

## 🤖 Paste this in front of EVERY fix prompt from either audit

```
Before changing anything, read docs/SHARED_DECISIONS.md. If the step text contradicts it,
follow SHARED_DECISIONS.md and tell me which line of the step you overrode. Use the shared
backend modules listed in its "Shared code locations" table — create them if missing, never
duplicate their logic. Grep cafeFresco-main/src AND cafeFresco-dashboard/src for callers of
every endpoint you change and update them in the same step so both frontends keep working.
```

---

## Shared code locations (create once, import everywhere)

| Module | Exports | Used by |
|---|---|---|
| `B/utils/cookies.js` | `userCookieOptions()`, `adminCookieOptions()` | users.js, admin.js |
| `B/utils/validation.js` | `validatePassword`, `normalizeEmail`, `PHONE_REGEX`, `escapeRegex`, `isObjectId` | users.js, admin.js, order.js, products.js |
| `B/utils/price.js` | `round2`, `unitPrice(product)`, `computeLines(items)` | cart.js, order.js, discountService |
| `B/config/mailer.js` | one nodemailer `transporter` from `EMAIL` / `EMAIL_PASSWORD` | users.js, admin.js, sendMail.js |
| `B/config/sendMail.js` | `sendOrderMail(order, user)` (imports mailer.js) | order.js, payment.js |
| `B/middleware/loginLimiter.js` | `createLimiter({max, windowMs})` factory | **separate instances**: user login, admin login, forgot/reset, contact |
| `B/middleware/optionalAdmin.js` | sets `req.admin` if a valid `adminToken` exists, never rejects | public product routes (for `includeInactive`) |
| `B/services/inventoryService.js` | `setStock`, `adjustStock` (atomic, never < 0) | products.js, orderService |
| `B/services/discountService.js` | `validateDiscount`, `redeemDiscount`, `releaseDiscount` | discountCode.js, order.js, orderService |
| `B/services/orderService.js` | `createOrderFromCart`, `cancelOrder`, `markOrderPaid`, `cancelStaleUnpaidCardOrders` | order.js, payment.js |
| `M/src/utils/price.js`, `D/src/utils/format.js` | `unitPrice`, `formatMoney` (same formula and currency) | both frontends |

---

## Decisions

> AI assistant, recommendations and smart search follow the binding **AI decisions A1–A12** in [AI_MASTER_PLAN.md](AI_MASTER_PLAN.md#ai-decisions-binding-for-every-step) (grounding, identity, confirm-to-act, untrusted text, cost limits, fallback, mock mode, privacy).

### D1. Money formula (both frontends display it, only the backend stores it)
```
unitPrice    = round2(price × (1 − discount/100))
lineTotal    = round2(unitPrice × quantity)
subtotal     = round2(Σ lineTotal)
discountAmt  = round2(subtotal × codePercentage / 100)     (minPurchase compared to subtotal)
totalAmount  = round2(subtotal − discountAmt)
```
- Currency is `CURRENCY` in the backend (Stripe) and `VITE_CURRENCY` in both frontends, default `USD`. All amounts are formatted with `formatMoney`.
- The dashboard product table shows three columns: **Price / Discount / Final price**.

### D2. `POST /order/create`: the one contract
- **Request:** `{ shippingAddress:{fullName,phone,city,zip,line1}, discountCode?, paymentMethod:'card'|'cod' }`
- The server builds the lines from **the user's server cart**.
- `products`, `totalAmount` and `payment` in the body are **ignored**, not rejected, during the compatibility window. After B.6 they are rejected.
- The order stores:
  - `paymentMethod` with enum `['card','cod']`, all lowercase on the order. The `Payment` model keeps its own enum and maps `cod → 'COD'`, `card → 'Debit Card'`.
  - line snapshots `{productId,title,unitPrice,quantity,lineTotal}`, plus `subtotal`, `discountCode`, `discountAmount`, `totalAmount` and `shippingAddress`;
  - `paymentStatus:'unpaid'` and `orderStatus:'pending'`;
  - `stripePaymentIntentId:null` and `stockRestored:false`;
  - `statusHistory: []`.
- **Steps, all on the server:** validate → reserve stock (atomic) → redeem the code (atomic) → save the order → clear the cart. If any step fails, undo the earlier ones in reverse order.
- **COD only:** create the `Payment` (`COD`, `Pending`), link `order.paymentId`, and send the order email. All of it happens **in the same request**.
- **Responses:** `201 {order}`; `409 {message, productId}` for stock or an unavailable product; `409 {message}` for a code that's used up; `400 {message, fields}` for validation errors.
- **Idempotency:** an `Idempotency-Key` header, stored on the order (unique per user). A repeated key returns the existing order.

### D3. Card payment
1. `POST /stripe/payment-intent {orderId}` checks ownership, `pending` and `unpaid`.
   - **One intent per order:** if `order.stripePaymentIntentId` exists and isn't `succeeded` or `canceled`, retrieve it and return its `clientSecret`. Otherwise create one (`amount = round(totalAmount×100)`, `metadata.orderId`) and store its id.
   - Response: `{clientSecret, amount}`.
2. The client calls `stripe.confirmCardPayment(clientSecret)`.
3. `POST /stripe/confirm {paymentIntentId}`: retrieve the intent from Stripe, and check `succeeded`, the amount, `metadata.orderId` and ownership. Then call `markOrderPaid()`.
4. `markOrderPaid(orderId, intent)` is **idempotent**. It does one of each: Payment (unique `transactionId`), `paymentStatus:'paid'`, `paymentId`, and the email. The optional webhook `POST /stripe/webhook` (raw body, signature checked with `STRIPE_WEBHOOK_SECRET`, mounted before `express.json()`) calls the same function.
5. "Retry" reuses the **same order and the same intent**. A second order is never created for a failed card.

### D4. Removed and deprecated endpoints
| Endpoint | Fate | When |
|---|---|---|
| `POST /order/set-transaction/:id` | removed | B.6 |
| `POST /order/send-order-email` | removed (the server sends the emails, D2/D3) | B.6 |
| `POST /stripe/payment/create` | removed (COD Payment is created in `/order/create`) | B.6 |
| `/stripe/payment-intent {amount}` form | removed | B.6 |
| `POST /discount/apply {cartTotal}` field | ignored now, rejected after B.6 | B.6 |
| `POST /user/upload-image` | **deleted** (unused, unauthenticated) | Main 14.1 = Dashboard 5.1 |
| `GET /admin/logout` alias | removed | B.6 |

Until B.6, deprecated endpoints keep working **but the shop must no longer call them** once its step is done.

### D5. Discount codes
- **Preview:** `POST /discount/apply {code}` returns `{code, subtotal, discountAmount, total}` computed from the **server cart**. It writes **nothing**.
- **Codes:** stored uppercase and trimmed, with fields `usedCount`, `maxUses`, `isActive` and `usedBy[]`.
- **Redeem:** happens only inside `/order/create`, atomically, guarded by `usedCount < maxUses` and `usedBy ≠ user`.
- **Release:** happens on **any** cancel (admin, customer or stale). `cancelOrder` calls `releaseDiscount`: `$inc usedCount -1` and `$pull usedBy`.
- **Shop behaviour:** one code per order. **Keep the code when the cart changes and re-run the preview.** If the preview fails (for example the minimum purchase is no longer met), clear the code and show the reason. (This replaces the dashboard audit's earlier "reset the code on any cart change".)
- **Migration:** `B/scripts/migrateDiscountCodes.js` uppercases codes, sets `usedCount = usedBy.length`, and removes `null` entries.

### D6. Order lifecycle and cancel
- **Transitions:** only `pending → completed` and `pending → cancelled`. Payment moves only `unpaid → paid`: card orders via D3 only; COD orders by an admin or manager, and only when the order is `completed`.
- **`cancelOrder(order, actor)` is the only cancel path.** It sets `cancelled` atomically from `pending`, restores stock once (`stockRestored` guard, via `inventoryService.adjustStock`), releases the discount, cancels any open Stripe intent, writes `statusHistory`, and creates an admin notification.
- **Who may cancel:**
  - an admin or manager: any `pending` order;
  - the customer: only their own order that is `pending` **and** `unpaid`.
- **`statusHistory` entry:** `{from, to, paymentFrom, paymentTo, byType:'admin'|'customer'|'system', byId, at}`.
- **A `cancelled` + `paid` order means a refund is owed:**
  - it's excluded from revenue;
  - the dashboard shows "Refund due";
  - refunds are made by hand in Stripe, which is out of scope.

### D7. Product availability
- `isActive` (default true) comes from Dashboard 5.6.
- **Public routes** (`/product/all`, `/featured`, `/new-releases`, `/fetch`, `/:id`) return only active products. They include `inventory.quantityInStock`, `discount`, `averageRating` (Number) and `reviewCount`.
- **Admin pages** use `?includeInactive=true`. It's honoured only when `optionalAdmin` finds a valid admin. Dashboard `allProduct.jsx`, `inventory.jsx` and `editProduct.jsx` must send it.
- **Invalid ObjectId → 400; valid but missing (or inactive for the shop) → 404.** Both frontends show "Product not found" for either.
- **Cart:** `formatCart` silently drops **deleted** products (it saves the cart and returns a `removedCount` notice). **Inactive or out-of-stock** items stay, marked `available:false` with a `reason`. They're excluded from the subtotal, and checkout is blocked until they're removed.
- **Wishlist:** inactive or deleted products are dropped from the response.

### D8. Errors and responses
- Every error is `{message}`, with an optional `fields` / `productId` / `code`. Never `error.message` or stack traces outside development.
- One central error handler (Dashboard 17.2) does this. Main 14.3 is the same work: do it once.
- **Empty lists return 200 with an empty array**, never 404. This covers orders, cart, wishlist, user search and history.
- `/user/search` keeps the `/user/all` shape: `{success, data, totalUsers, currentPage, totalPages}`.

### D9. Stale unpaid card orders (no background jobs on Vercel)
`cancelStaleUnpaidCardOrders()` runs **lazily** at the start of `/order/create`, `/order/fetch`, `/order/user/history` and `/stripe/payment-intent`. It is limited to one run per 60 s per instance and handles card orders that are `pending` + `unpaid` and older than `STALE_CARD_ORDER_MIN` (default 30). For each one:
1. If `stripePaymentIntentId` exists, **retrieve the intent first**:
   - `succeeded` → `markOrderPaid()` (the customer paid but the confirm call was lost). **Never cancel a paid order.**
   - `processing` / `requires_action` → skip this time.
   - anything else → cancel the intent, then `cancelOrder(order, {byType:'system'})`.
2. With no intent → `cancelOrder(order, {byType:'system'})`.

### D10. Auth and session
- **Customer cookie** `userToken` and **admin cookie** `adminToken` are both httpOnly, with `sameSite: production ? 'none' : 'lax'`, `secure` in production, and a 15-day `maxAge`. Neither token is ever in a JSON body. The session comes from `GET /user/me` and `GET /admin/me`.
- **Password rule (customers and admins):** at least 8 characters, with at least one letter and one digit (`validatePassword`). Emails are trimmed and lowercased everywhere (`normalizeEmail`).
- **Rate limits are separate instances,** so customer and admin traffic never share a counter:
  - user login 5/15 min/IP;
  - admin login 5/15 min/IP;
  - forgot/reset (user and admin) 5/15 min/IP;
  - contact 5/hour/IP;
  - the login limiters use `skipSuccessfulRequests`.
- **Forgot-password** (user and admin) always returns 200 `"If an account exists for this email, a reset link has been sent."`
- **CORS** origins come from the `CORS_ORIGINS` env (Dashboard 17.1). It must include the shop and dashboard production URLs and `http://localhost:3001` and `http://localhost:5173`.

### D11. Uploads on Vercel
Files written to `public/images` **don't persist** on Vercel serverless. They vanish on cold starts and redeploys. Uploads must go to persistent storage before going live (Cloudinary or S3, behind the existing `multer` middleware). That's a storage-backend change inside the existing upload middleware, not a new module. It's tracked as **Dashboard 17.2 addendum**. Until then, product images work only locally.

---

## Master sequence (identical in both audits)

| Phase | Do these together | Why |
|---|---|---|
| 0 Baseline | Main 0.1–0.2 · Dashboard 17.1 | build works; secrets out of code; env validated |
| 1 Auth | Dashboard 1.1–1.4 · Main 1.1–1.5 | shared cookies / mailer / validation / limiters |
| 2 Routing & state | Dashboard 2.1–3.2 · Main 2.1–3.1 | guards and API clients on both sides |
| 3 Catalog | Dashboard 5.1–5.6, 6.1, 7.1–7.2 · Main 4.1–5.3, 10.1 · B.5 | isActive, stock, prices, reviews before money |
| 4 Money | Dashboard 4.1 + B.1 → Main 6.1–6.2 → Dashboard 4.2 + 9.1 + B.2 + Main 6.3 + 7.1 → Dashboard 4.3 + 4.4 + B.3 + Main 8.1–8.2 → Dashboard 4.5 + B.4 + Main 9.1–9.2 → Dashboard 4.6, 9.2 | one checkout contract (D2–D6, D9) |
| 5 Rest | Dashboard 8.x, 10.x (+ Main 14.1), 11–16 · Main 11–13 | |
| 6 Hardening | Dashboard 17.2 (+ Main 14.3, + D11 storage) · Main 14.2 · Dashboard 17.3 · **B.6** | close compatibility window last |
| 7 Final | Dashboard Final System Gate · Main Module 14 Gate · S1–S6 | |

After every phase, run **S1–S6** (dashboard audit) and **D-SMOKE** (main audit).
