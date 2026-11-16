# Cafe Fresco Dashboard: Deep Audit & Fix Plan

**Scope:** `cafeFresco-dashboard` (admin panel, every page) plus each `cafeFresco-backend` route the dashboard calls, because most business gaps sit between the two.
**Goal:** a working, production-level system. **No new modules.** Only fix what exists.
**Method:** static review of the frontend and backend code. Every finding has a file and line reference so it can be checked.
**Date:** 2026-10-27

---

## How to use this document

Work **one module at a time, in the order below**. Within a module, work **one step at a time**:

```
Step N
 ├─ 1. Read the Problem
 ├─ 2. Run the  🛠 Fix Prompt   → Claude applies the fix
 ├─ 3. Run the  🔍 Test Prompt  → Claude hunts for bugs in the fix (and fixes what it finds)
 ├─ 4. Check the ✅ Done-when list by hand in the browser
 └─ 5. Only then move to Step N+1
After the last step of a module → run the module's 🧪 Module Gate prompt → move to next module

Step marked B+D+M (backend + dashboard + main shop)?
 ├─ 0. Baseline check first          (see "Three-project step protocol")
 ├─ 2. Fix Prompt wrapped in the three-project wrapper
 ├─ 3. Test Prompt + 🔗 integration test + smoke test S1–S6
 └─ 4. All four layers (API, Admin UI, Shop UI, Data) must pass
Every Module Gate → also run the smoke test S1–S6, so the shop is checked even when only the dashboard changed
```

Severity tags: **🔴 Critical** (security hole, data loss, broken core flow) · **🟠 High** (wrong business result) · **🟡 Medium** (broken UX, inconsistent logic) · **⚪ Low** (cleanup).

Paths are relative to the `FYP/` root. `D/` = `cafeFresco-dashboard/src/`, `B/` = `cafeFresco-backend/`.

> ⚖️ **Single source of truth:** [docs/SHARED_DECISIONS.md](../SHARED_DECISIONS.md) holds the backend contract shared with [the main-site audit](../main/MAIN_SITE_AUDIT.md): order/checkout API, money formula, discounts, cancel, availability, errors, auth, rate limits and the **master sequence across both audits**. **If any step here contradicts it, SHARED_DECISIONS wins.** Paste its 🤖 instruction in front of every fix prompt. Steps below that were changed to match it are marked **⚖️ aligned**.

---

## Steps that also change the main site (cafeFresco-main)

Some backend fixes change an API that the customer website (`cafeFresco-main`, port 3001) uses. Those steps carry a **🔗 Main-site impact** block. Rules for those steps:

1. **Change backend and main site together in the same step.** Never leave a step with only one side changed, or checkout breaks.
2. **Keep the old API working until the main site has switched** (see "compatibility window" in [Appendix B](#appendix-b--main-site-integration-cafefresco-main)). Then remove it in the cleanup step B.6.
3. After the step, run **that step's test prompt plus the 🔗 integration test prompt**, which tests the real checkout on `http://localhost:3001`.
4. Appendix B has the complete contract (old vs new request/response), the new checkout flow and a single prompt per integration change.

| Step | Main-site file affected | What changes for the shop |
|---|---|---|
| 1.2 | none (admin only) | No change — confirm user login (`userToken`) still works |
| 4.1 | `Components/StripePayment.jsx` | Out-of-stock now returns 409 → show message, keep cart |
| 4.2 | `Components/StripePayment.jsx`, `Components/CartPage.jsx`, `Components/Address.jsx` | Stop sending `products`/`totalAmount`/`payment` (server reads the cart); send `shippingAddress` + `paymentMethod`; show the server total; the cart uses the discounted price (SHARED D1, D2) |
| 4.4 | `Components/StripePayment.jsx` | **New card flow:** create order → intent for that order (one intent per order) → confirm card → `/stripe/confirm`. COD is a single `/order/create` call (SHARED D2, D3) |
| 4.5 | `Components/Track.jsx` (verify) | Main site must use `/order/user/history`, never `/order/history/:id` |
| 5.6 | `ProductPage.jsx`, `MoreProduct.jsx`, `flavorProduct.jsx` | Inactive products disappear (automatic, no code change); a product in the cart can become unavailable |
| 9.1 | `Components/CartPage.jsx`, `Components/StripePayment.jsx`, `Context` | `/discount/apply` is preview only; checkout must send `discountCode` to `/order/create`; the code is kept and re-previewed when the cart changes (SHARED D5) |
| 10.1 | none found | grep confirmed main site does not call `/user/search` |
| 5.1 | none | `/user/upload-image` is **deleted**, not protected (SHARED D4); the shop never called it |
| 17.1 / 17.2 | `.env` of main site | CORS origin list from env must include `http://localhost:3001`; error responses are now always `{message}` |

---

## Which projects each step touches

**B** = backend (`cafeFresco-backend`, :3000) · **D** = dashboard (`cafeFresco-dashboard`, :5173) · **M** = main shop (`cafeFresco-main`, :3001). A step marked **B+D+M** is a **three-project step**: follow the protocol below the table.

| Step | Projects | | Step | Projects | | Step | Projects |
|---|---|---|---|---|---|---|---|
| 1.1 | B+D | | 5.1 | B | | 10.1 | B+D |
| 1.2 | B+D (+M check) | | 5.2 | B+D | | 10.2 | D |
| 1.3 | D | | 5.3 | B+D | | 11.1 | B |
| 1.4 | B+D | | 5.4 | D | | 11.2 | D |
| 2.1–2.4 | D | | 5.5 | B+D | | 12.1 | D |
| 3.1 | D | | **5.6** | **B+D+M** | | 12.2 | B+D |
| 3.2 | B+D (+M check) | | 6.1 | B+D | | 12.3 | B+D |
| **4.1** | **B+D+M** | | 7.1 | B+D | | 13.1 | B+D |
| **4.2** | **B+D+M** | | 7.2 | B+D | | 14.1 | D |
| **4.3** | **B+D+M** | | 8.1–8.3 | B+D | | 14.2 | B+D |
| **4.4** | **B+D+M** | | **9.1** | **B+D+M** | | 15.1 | B+D |
| **4.5** | **B+D+M** | | 9.2 | B+D | | **16.1** | **B+D+M** |
| 4.6 | B+D | | | | | **17.1** | **B+D+M** |
| | | | | | | **17.2** | **B+D+M** |
| | | | | | | 17.3 | B+D |

"(+M check)" means the shop's code doesn't change, but the shop must be smoke-tested afterwards, because shared backend code (cookies, error format) changed.

---

## Three-project step protocol (B+D+M)

Use this for every step marked **B+D+M**. The aim is that all three apps keep working **at every moment**, not just at the end of the step.

### 1. Before you start: baseline check
Run this prompt **before** the Fix Prompt, so you know everything works before the change:
```
Baseline check before step <N>. Confirm all three apps are running: backend
http://localhost:3000 (GET / → "Server is running", log shows "MongoDB connected"), dashboard
http://localhost:5173 (HTTP 200), main shop http://localhost:3001 (HTTP 200). If any is not
running, start it in the background (backend: `npx nodemon app.js` in cafeFresco-backend;
dashboard: `npm start`; main: `npm run dev`). Then run the smoke test S1–S6 from the
"Three-project smoke test" section of docs/dashboard/DASHBOARD_AUDIT.md and report PASS/FAIL.
Do not change any code. If anything FAILs, stop and tell me — we fix the baseline first.
```

### 2. Change order inside the step (always the same)
1. **Backend first, backwards compatible.** New behaviour is added and the old requests still work. Example: the server ignores `totalAmount` instead of rejecting it.
2. **Dashboard second.** Admin-side changes are made against the new backend.
3. **Main shop third.** Customer-side changes are made against the new backend.
4. **Remove the old behaviour later.** This happens in step B.6, only after every three-project step has passed.

Never finish a session with step 1 done and steps 2–3 not done. If you have to stop midway, the backend must still accept the old requests.

### 3. The Fix Prompt wrapper
Paste this **in front of** the step's own 🛠 Fix Prompt (and its Appendix B prompt, if it has one):
```
This is a THREE-PROJECT step (backend + dashboard + main shop). Rules:
1. Before editing, list every file in cafeFresco-backend, cafeFresco-dashboard and cafeFresco-main
   that calls or implements the endpoints this step changes (grep the endpoint paths). Show me
   the list.
2. Change backend first and keep old request shapes working; then dashboard; then main shop.
3. Do not restart servers manually unless needed — nodemon and Vite reload automatically; if a
   server crashed, restart it in the background and tell me.
4. After the change, run the step's 🔍 Test Prompt, the 🔗 integration test prompt (if any),
   and the Three-project smoke test S1–S6. Report one combined PASS/FAIL table.
Now the step:
<paste step Fix Prompt here>
```

### 4. Verification: three layers, all required
| Layer | What | How |
|---|---|---|
| API | Backend rules hold even when the UI is bypassed | `curl` / scratch script calls from the step's 🔍 Test Prompt (tampering, wrong role, no cookie) |
| Admin UI | The dashboard shows and changes the right data | Click through in the browser at :5173 as admin, manager and editor |
| Shop UI | The customer flow still works and shows server values | Click through at :3001 as a customer |
| Data | The database matches what both UIs show | Check in Compass (`mongodb://localhost:27017/cafefresco`): orders, inventory, payments, discountcodes |

A step is **done only when all four layers pass**. A step that passes the API checks but breaks the shop is **not done**.

### 5. If something breaks
- **Shop broken, dashboard fine:** the backend change probably isn't backwards compatible. Restore the old request handling, then continue.
- **One app won't start:** read its terminal output first. Don't fix the error by reverting another project.
- **Data looks wrong:** check it in Compass before changing any code. The cause may be leftover test data from an earlier run. Use the reset prompt below.

**Reset test data prompt** (local DB only):
```
Write scratch script (in the scratchpad, not the repo) that connects to the LOCAL DB_URI only
(abort if DB_URI is not mongodb://127.0.0.1 or localhost), deletes orders, payments,
notifications, carts and test products/categories created by tests, resets inventory to known
values, and keeps admin accounts. Show me what it will delete and ask before running.
```

---

## Three-project smoke test (S1–S6)

Run this after **every** three-project step, at every Module Gate, and before you stop for the day. It takes about 5 minutes.

| # | App | Check | Expected |
|---|---|---|---|
| S1 | All | Backend `GET /`, dashboard `/`, shop `/` | 200 / 200 / 200; backend log "MongoDB connected" |
| S2 | D | Log in as admin → dashboard → products list → orders list | Pages render with data; no console errors; no 401 loop |
| S3 | M | Shop home → product page → add to cart → cart page | Products and images load; cart total shown |
| S4 | M→B→D | Customer places a **COD** order | Order appears in dashboard Orders with the same total; stock drops by the ordered quantity; notification bell shows it |
| S5 | M→B→D | Customer places a **card** order (4242…) | Order is `paid` in the dashboard; one charge in Stripe test mode; stock drops |
| S6 | D→B→M | Admin changes a product (price or deactivate) and cancels the S4 order | Shop shows the new price / hides the product after reload; cancelled order's stock is restored; customer's tracking page shows "cancelled" |

**Smoke test prompt**
```
Run the Three-project smoke test S1–S6 from docs/dashboard/DASHBOARD_AUDIT.md on the local stack
(backend :3000, dashboard :5173, main :3001, local MongoDB). For each check use real HTTP calls
(scratch script with a cookie jar for customer and admin) and, where a UI is involved, describe
what I must click to confirm visually. Verify database values directly (orders, inventory,
payments). Report a PASS/FAIL table with evidence (status codes, DB values). Do not change code;
if something fails, explain the likely cause and which step introduced it.
```

---

## Business rules this plan enforces (decide once, apply everywhere)

The code currently has **no single definition** of who can do what, what counts as revenue, or how an order moves between states. Each page invents its own rule. The rules below are the target. If you want different rules, change this table first and keep the prompts consistent with it.

### R1. Role matrix (RBAC)

| Area | admin | manager | editor |
|---|---|---|---|
| Dashboard stats | ✅ | ✅ (view) | ❌ |
| Products: add / edit | ✅ | ✅ | ✅ |
| Products: delete | ✅ | ✅ | ❌ |
| Categories: add / edit | ✅ | ✅ | ✅ |
| Categories: delete | ✅ | ✅ | ❌ |
| Inventory: view / update stock | ✅ | ✅ | ✅ |
| Orders: view / update status | ✅ | ✅ | ❌ |
| Customers (users): view + order history | ✅ | ✅ | ❌ |
| Permissions (admin accounts) | ✅ | ❌ | ❌ |
| Discount codes | ✅ | ❌ | ❌ |
| Employees: add / edit | ✅ | ✅ | ❌ |
| Employees: delete | ✅ | ❌ | ❌ |
| Departments / Suppliers / Distributors: add / edit | ✅ | ✅ | ❌ |
| Departments / Suppliers / Distributors: delete | ✅ | ✅ | ❌ |

The **backend is the source of truth**. The frontend only hides or disables what the backend would reject anyway.

### R2. Order lifecycle
`pending → completed` or `pending → cancelled`. **`completed` and `cancelled` are final.** Cancelling an order **returns its stock**. Placing an order **takes stock** (atomically) and **fails** if stock is short.

### R3. Payment
- **Card:** `paid` only after the server confirms the Stripe PaymentIntent succeeded.
- **COD:** starts `unpaid`. An admin or manager may mark it `paid`, and only when the order is `completed`.
- A `cancelled` + `paid` order means a refund is owed. Revenue numbers must exclude it.

### R4. Revenue
**Revenue = sum of `totalAmount` where `orderStatus = completed` AND `paymentStatus = paid`.** Every dashboard card and chart uses this one definition.

### R5. Prices are computed by the server
The server computes the order total from product prices, product discounts and the discount code. It **never trusts `totalAmount` sent by the browser**. The order stores a **price snapshot** per line item, so history doesn't change when a product's price changes later.

### R6. Referential integrity
Nothing is deleted while it is still referenced. Blocked deletes return a clear `409` message: a category with products, a department with employees, a distributor with suppliers, a product that appears in orders. For products, use **deactivate** instead of delete.

---

## Module order

| # | Module | Why this position |
|---|---|---|
| 1 | Authentication & Session | Everything else depends on login working in production |
| 2 | RBAC, Routing & Redirects | Every page's access check depends on it |
| 3 | Global data loading & API errors | Shared context feeds every form |
| 4 | Orders & Payments | Core money flow; most critical business gaps |
| 5 | Products | Feeds orders and inventory |
| 6 | Inventory | Stock correctness |
| 7 | Categories | Product integrity |
| 8 | Dashboard (home stats) | Depends on correct orders and revenue rules |
| 9 | Discount Codes | Money rules |
| 10 | Customers (Users) | PII exposure |
| 11 | Permissions (Admin accounts) | Account security |
| 12 | Employees | Wrong-endpoint delete bug |
| 13 | Departments | Integrity |
| 14 | Suppliers | Wrong-endpoint delete bug |
| 15 | Distributors | Integrity |
| 16 | Notifications & Header | Unauthenticated endpoints |
| 17 | Production hardening | Secrets, uploads, CORS, template leftovers |

---

# Module 1 — Authentication & Session

### Step 1.1 🔴 Public admin self-registration creates full admins
**Problem:** `POST /admin/register` ([B/routes/admin.js:16](../../cafeFresco-backend/routes/admin.js#L16)) has no auth. The schema default role is `"admin"` ([B/models/admin.js:19](../../cafeFresco-backend/models/admin.js#L19)). **Anyone on the internet can create an admin account** and take over the system.
**Solution:** Remove the public register route. Admin accounts are created only through `/admin/create-permission` (already admin-only). Add a one-time **seed script** (`npm run seed:admin`) that creates the first root admin (`isRoot: true`) from env vars when no admin exists. Remove the `pages/register` route and the template `AuthRegister` page from the dashboard ([D/routes/AuthenticationRoutes.jsx:32](../../cafeFresco-dashboard/src/routes/AuthenticationRoutes.jsx#L32)).

**🛠 Fix Prompt**
```
In cafeFresco-backend/routes/admin.js, delete the public POST /admin/register route.
Create cafeFresco-backend/scripts/seedAdmin.js that connects with DB_URI, and if no admin
with isRoot:true exists, creates one from env ADMIN_SEED_NAME, ADMIN_SEED_EMAIL,
ADMIN_SEED_PASSWORD (bcrypt hash, role "admin", isRoot true), then exits. Refuse to run if
the password is shorter than 8 chars. Add "seed:admin": "node scripts/seedAdmin.js" to
package.json scripts, and add the three env keys (empty) to .env with a comment.
In cafeFresco-dashboard remove the 'pages/register' route from routes/AuthenticationRoutes.jsx
and delete views/pages/authentication/Register.jsx and views/pages/auth-forms/AuthRegister.jsx
if nothing else imports them. Do not change any other route.
```
**🔍 Test Prompt**
```
Audit the change you just made for bugs. Verify: (1) POST /admin/register now returns 404;
(2) grep both projects for any remaining reference to "/admin/register", "AuthRegister",
"pages/register"; (3) run `npm run seed:admin` twice against the local DB: first run creates
exactly one root admin, second run creates nothing; (4) the seeded admin can log in via
POST /admin/login. Report each check as PASS/FAIL with evidence and fix any FAIL.
```
**✅ Done when:** register returns 404 · seed creates one root admin · that admin can log in.

---

### Step 1.2 🔴 Login token handling breaks in production and leaks the JWT to JavaScript
**Problem:**
- The login `fetch` has no `credentials: 'include'` ([D/views/pages/auth-forms/AuthLogin.jsx:47](../../cafeFresco-dashboard/src/views/pages/auth-forms/AuthLogin.jsx#L47)), so the browser **drops the server's httpOnly cookie**.
- The page then re-saves the token returned in the JSON body as a **JS-readable cookie** on the dashboard's own domain (`Cookies.set('adminToken', …)`, line 65). Locally this works by accident: cookies ignore ports, so `localhost` is shared.
- In production the dashboard (`cafe-fresco-dashboard.vercel.app`) and the API are on different domains. The cookie is **never sent to the API**, so every request returns 401.
- The token is also readable by any XSS. The server cookie lacks `sameSite: 'none'` for cross-site use ([B/routes/admin.js:100](../../cafeFresco-backend/routes/admin.js#L100)).

**Solution:**
- The server sets an httpOnly cookie with `sameSite: production ? 'none' : 'lax'`, `secure: production`, and `maxAge` equal to the JWT lifetime. It stops returning `token` in the body.
- The frontend sends `credentials: 'include'` and never stores the token.
- Add `GET /admin/me` (isAdmin), which returns `{ name, email, role }` from the **database**. Session state comes from `/admin/me`, not from decoding a cookie.

**🛠 Fix Prompt**
```
Backend (cafeFresco-backend/routes/admin.js):
- ⚖️ aligned (SHARED D10): create/use cafeFresco-backend/utils/cookies.js exporting
  adminCookieOptions() and userCookieOptions(), both { httpOnly:true, secure: NODE_ENV==='production',
  sameSite: NODE_ENV==='production' ? 'none' : 'lax', maxAge: 15*24*60*60*1000, path:'/' }.
  Use adminCookieOptions() in login. Use the same options (minus maxAge) in logout's clearCookie.
  (Main-site Step 1.1 uses userCookieOptions() from the same file.)
- Give admin login its OWN limiter instance (createLimiter factory in middleware/loginLimiter.js,
  skipSuccessfulRequests:true) — today the same instance is shared with customer login, so
  customer failures lock admins out (main-site Step 1.3).
- Remove `token` from the login JSON response.
- Add GET /admin/me (isAdmin) that loads the admin by req.admin.userId, returns 401 if not
  found, else { name, email, role, isRoot }.
- Change logout to POST (keep GET temporarily returning the same result for compatibility).
Frontend (cafeFresco-dashboard):
- AuthLogin.jsx: add credentials:'include' to the login fetch, remove js-cookie usage,
  after success call the context's refreshSession() (see below) then navigate.
  Show the server's message on failure (data.message), not a generic "Login failed".
  Wrap inputs in a <form onSubmit> so Enter submits; disable the button while submitting.
  Remove the non-functional "Keep me logged in" checkbox.
- views/context/index.jsx: replace getUserRoleFromToken() cookie decoding with
  refreshSession() that calls GET /admin/me with credentials:'include' and sets
  adminName/adminRole (and a new `sessionStatus`: 'loading' | 'authenticated' | 'anonymous').
  Call it on mount. Expose refreshSession and a logout() that POSTs /admin/logout,
  clears state, and sets sessionStatus 'anonymous'.
- ProfileSection: use context logout(), then navigate('/admin/login', { replace:true }).
Do not touch other pages yet.
```
**🔍 Test Prompt**
```
Bug-hunt the auth change. Check: (1) after login, document.cookie in the dashboard does NOT
contain adminToken (httpOnly) yet API calls succeed; (2) /admin/me returns the role from the
DB — change a role in Mongo and confirm /admin/me reflects it without re-login;
(3) wrong password shows the server message; 6th attempt shows the rate-limit message;
(4) logout clears the cookie (subsequent /admin/me = 401) and Back button does not show
protected data; (5) grep the dashboard for remaining "js-cookie", "Cookies.", "adminToken",
"atob(" usages and list them. Fix anything failing and report PASS/FAIL per check.
```
**✅ Done when:** no JS-visible token · role comes from the DB · login, logout and errors work.

---

### Step 1.3 🟠 The route guard only checks that a cookie exists
**Problem:** `AdminRoute` ([D/routes/AdminRoutes.jsx:5](../../cafeFresco-dashboard/src/routes/AdminRoutes.jsx#L5)) lets the user in if any `adminToken` cookie exists. An expired token, or a deleted admin's token, still renders every page, and each page then fails with 401. Only the Dashboard page handles 401 ([D/views/dashboard/Default/index.jsx:50](../../cafeFresco-dashboard/src/views/dashboard/Default/index.jsx#L50)). A logged-in admin who opens `/admin/login` sees the login form again.
**Solution:** The guard uses `sessionStatus` from Step 1.2. `loading` shows a spinner, `anonymous` redirects to `/admin/login?next=<path>`, and `authenticated` renders the page. After login, return to `next`. If an authenticated user visits `/admin/login`, redirect them to their home page (Step 2.2).

**🛠 Fix Prompt**
```
Rewrite cafeFresco-dashboard/src/routes/AdminRoutes.jsx to use MainContext.sessionStatus:
'loading' → centered <Loader/>; 'anonymous' → <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname+location.search)}`} replace/>;
'authenticated' → <Outlet/>. In AuthLogin, after successful login navigate to the `next`
query param if it starts with "/admin/" (prevent open redirect), else to the role home page.
Wrap the Login page so an already-authenticated user is redirected away from /admin/login.
```
**🔍 Test Prompt**
```
Bug-hunt: (1) delete the admin in Mongo while logged in → next navigation lands on login;
(2) open /admin/all-order logged out → login → returns to /admin/all-order;
(3) next=https://evil.com and next=//evil.com are ignored; (4) logged-in user visiting
/admin/login is redirected; (5) hard refresh on any /admin/* page shows a spinner then the page,
never a flash of the login page. Report PASS/FAIL and fix failures.
```
**✅ Done when:** expired or deleted sessions are redirected to login · deep links survive login · no open redirect.

---

### Step 1.4 🟠 Forgot/reset password: user enumeration, no password rules, hardcoded mail credentials
**Problem:**
- `forgot-password` returns 404 "Admin not found" ([B/routes/admin.js:268](../../cafeFresco-backend/routes/admin.js#L268)), which tells an attacker which emails are admins.
- `reset-password` accepts any password, even an empty one (line 299).
- The nodemailer transporter has a **Gmail app password hardcoded in source** (lines 251–261). It is committed to the repo and must be treated as leaked.
- The reset page logs the token to the console ([D/views/pages/auth-forms/AuthReset.jsx:21](../../cafeFresco-dashboard/src/views/pages/auth-forms/AuthReset.jsx#L21)).
- The reset page has no minimum-length check.
- Neither form is rate-limited.

**Solution:**
- Forgot-password always returns 200 with the same generic message.
- Enforce a minimum of 8 characters on both the server and the client.
- Move the mail credentials to `.env` (`EMAIL`, `EMAIL_PASSWORD`) and **revoke the leaked Gmail app password**.
- Reuse `B/config/sendMail.js`.
- Rate-limit both endpoints.
- Remove the `console.log(token)`.

**🛠 Fix Prompt**
```
⚖️ aligned (SHARED D10 + shared code table):
Backend admin.js: remove the inline nodemailer transporter with hardcoded credentials; reuse
the single transporter from config/mailer.js (built from process.env.EMAIL / EMAIL_PASSWORD).
There are THREE hardcoded copies — admin.js, users.js and config/sendMail.js — replace all
three (sendMail.js keeps sendOrderMail but imports mailer.js).
forgot-password: always respond 200 {message:"If an account exists for this email, a reset
link has been sent."}; normalizeEmail() from utils/validation.js; only send mail when the admin
exists. Apply a forgot/reset limiter instance (createLimiter, 5 per 15 min per IP).
reset-password: validatePassword() from utils/validation.js (>= 8 chars, at least one letter
and one digit — same rule as customers) → 400 with the rule message.
Frontend AuthReset.jsx: remove console.log(token); validate the same rule and match before submit.
AuthForget.jsx: wrap in <form> so Enter works; show the generic message.
List every file where a hardcoded email password existed so I can rotate it.
```
**🔍 Test Prompt**
```
Bug-hunt: grep the whole backend for "pass:" and "@gmail.com" and confirm no secret remains in
source; forgot-password with unknown vs known email returns identical status+body; reset with
"abc" is rejected by server even if called via curl; reset link works once and fails the
second time; expired token (set resetPasswordExpires in the past) fails. Report PASS/FAIL.
```
**✅ Done when:** no secrets in code · no enumeration · password rules enforced · **Gmail app password rotated**.

### 🧪 Module 1 Gate
```
Run a full auth regression on the local stack (backend :3000, dashboard :5173): seed admin,
login, refresh page, open deep link logged out, wrong password, rate limit, forgot + reset,
logout, back button. Also simulate production cookie flags by temporarily setting
NODE_ENV=production and explain what must be true in deployment (HTTPS, CORS origin,
credentials) for cross-domain cookies to work. Report a PASS/FAIL table.
```

---

# Module 2 — RBAC, Routing & Redirects

### Step 2.1 🔴 Every page breaks the Rules of Hooks with a role check, so hard refresh crashes
**Problem:** Almost every page returns `<AccessDenied/>` **before** calling `useEffect` and other hooks. Affected files:
- [D/views/pages/order/allOrder.jsx:43](../../cafeFresco-dashboard/src/views/pages/order/allOrder.jsx#L43)
- [D/views/dashboard/Default/index.jsx:32](../../cafeFresco-dashboard/src/views/dashboard/Default/index.jsx#L32)
- [D/views/pages/category/EditCategory.jsx:25](../../cafeFresco-dashboard/src/views/pages/category/EditCategory.jsx#L25)
- `inventory.jsx:26`, `allUser.jsx:34`, `allPermission.jsx:31`, `department.jsx:33`, `distributor.jsx:44`, `discount.jsx:32`, `allSupplier.jsx:30`, `addSupplier.jsx:38`, `allEmployee.jsx:24`, `addEmployee.jsx:16`

On first render the role is `""` (it loads asynchronously), so the page renders fewer hooks. On the next render it renders more, and React throws *"Rendered more hooks than during the previous render"*. Separately, some pages (`editEmployee`, `editSupplier`, `editProduct`) have **no role check at all**.
**Solution:** Remove the per-page role checks. Add a `<RequireRole roles={[...]}>` wrapper **in the route table** ([D/routes/MainRoutes.jsx](../../cafeFresco-dashboard/src/routes/MainRoutes.jsx)) based on matrix R1. While `sessionStatus === 'loading'` it renders a loader, never AccessDenied.

**🛠 Fix Prompt**
```
Create cafeFresco-dashboard/src/routes/RequireRole.jsx: reads adminRole + sessionStatus from
MainContext; loading → <Loader/>; role not in `roles` → <AccessDenied/>; else children.
Create src/config/permissions.js exporting the role matrix from docs/dashboard/DASHBOARD_AUDIT.md
section R1 as { routeKey: [roles] } plus helper can(role, action).
In routes/MainRoutes.jsx wrap each admin child element with <RequireRole roles={...}> per the
matrix (dashboard, products, categories, inventory, orders, users, permissions, discount,
employees, departments, suppliers, distributors, and all edit/add pages).
Then remove every inline `if (...adminRole...) return <AccessDenied/>` from the page components
(list them first with grep "AccessDenied"), keeping the pages' other logic unchanged.
Ensure no hook is called after a conditional return in any page.
```
**🔍 Test Prompt**
```
Bug-hunt: for each role (admin, manager, editor — create test accounts), hard-refresh every
/admin/* URL and record: renders / AccessDenied / crash. Compare against matrix R1 and list
mismatches. Run `npx eslint src --rule 'react-hooks/rules-of-hooks: error'` (add the plugin if
missing) and fix all violations. Report the role × page table.
```
**✅ Done when:** no crash on hard refresh · the access table matches R1 for all three roles.

---

### Step 2.2 🟠 Every role is sent to the admin-only dashboard after login
**Problem:** Login always calls `navigate('/admin/dashboard')` ([AuthLogin.jsx:66](../../cafeFresco-dashboard/src/views/pages/auth-forms/AuthLogin.jsx#L66)), and `/admin` redirects there too. Under the current rules that page is admin-only, so **managers and editors land on "Access Denied" every time they log in**. `AccessDenied` navigates to `/` ([D/views/Error/AccessDenied.jsx:11](../../cafeFresco-dashboard/src/views/Error/AccessDenied.jsx#L11)), which bounces back to the dashboard: a dead end. Every "Cancel" and "Discard" button also hardcodes `/admin/dashboard`.
**Solution:** Add `homeFor(role)`: admin and manager go to `/admin/dashboard`, editor goes to `/admin/all-product`. Use it for the post-login redirect, the `/admin` index route, AccessDenied's button, and every Cancel/Discard button. Better still, Cancel and Discard should go back to that module's **list page**.

**🛠 Fix Prompt**
```
Add homeFor(role) to src/config/permissions.js. Use it in: AuthLogin post-login fallback,
MainRoutes '/admin' index redirect (via a small component reading context), AccessDenied
button ("Go to my home"). Replace every navigate('/admin/dashboard') used by Cancel/Discard/
Back buttons with navigation to that module's list page (e.g. product pages → /admin/all-product,
employee pages → /admin/employees/list). grep "navigate('/admin/dashboard')" and handle each.
```
**🔍 Test Prompt**
```
Bug-hunt: log in as editor → lands on products, not AccessDenied; click AccessDenied button
on a forbidden page → lands on own home; every Cancel/Discard button goes to its list page.
Check no infinite redirect occurs for any role on '/', '/admin', '/admin/'. Report results.
```
**✅ Done when:** each role lands on a page it can use · there are no dead-end redirects.

---

### Step 2.3 🟡 The sidebar shows modules the user cannot open
**Problem:** The sidebar ([D/menu-items/index.js](../../cafeFresco-dashboard/src/menu-items/index.js)) shows every group to every role, and the menu items carry no role info. Editors see Orders, Permissions and Discount, then hit AccessDenied.
**Solution:** Give each menu item a `roles` array taken from the same permissions config, and filter the menu in `MenuList` by the current role.

**🛠 Fix Prompt**
```
Add a `roles` field to every item in src/menu-items/*.js sourced from src/config/permissions.js
(no duplicated role lists). In layout/MainLayout/MenuList/index.jsx filter groups/collapses/items
recursively by adminRole; hide empty groups. Remove the Utilities group (template pages) from
the menu if it is not imported in menu-items/index.js already.
```
**🔍 Test Prompt**
```
Bug-hunt: for each role, list visible menu items and click every one; none may show
AccessDenied. Verify the sidebar updates immediately after login/logout without a reload.
```
**✅ Done when:** every visible menu item opens for that role.

---

### Step 2.4 ⚪ Route-table leftovers
**Problem:** [MainRoutes.jsx](../../cafeFresco-dashboard/src/routes/MainRoutes.jsx) has the following leftovers:
- Two `index: true` routes on `/` (lines 41–48). The second is unreachable.
- Duplicate `edit-supplier/:id` entries (lines 153–160).
- Inconsistent paths (`suppliers/` with a trailing slash, `employees/list` next to `employee/add`).
- Public template pages (`/typography`, `/color`, `/shadow`, `/sample-page`) with no auth.
- No 404 route.

**Solution:** Remove the duplicates and template routes, add a catch-all `*` page that shows "Page not found" with a link to the user's home, and normalise the paths. If you rename paths, keep redirects from the old ones.

**🛠 Fix Prompt**
```
Clean routes/MainRoutes.jsx: remove the second index route and Sample import, the duplicated
edit-supplier route, and the typography/color/shadow/sample-page routes (+ their lazy imports
if unused elsewhere). Add a catch-all '*' route rendering a NotFound page with a "Go to my home"
button (homeFor). Do not rename existing working paths.
```
**🔍 Test Prompt**
```
Bug-hunt: visit /typography, /random, /admin/random → NotFound; all menu links still work;
build passes (`npm run build`). Report.
```
**✅ Done when:** no duplicate or template routes remain · unknown URLs show a 404 page.

### 🧪 Module 2 Gate
```
Produce a role × route matrix by actually visiting every route as admin, manager and editor
(hard refresh each). Compare to R1 in docs/dashboard/DASHBOARD_AUDIT.md. Any mismatch = FAIL.
Also run `npm run build` and `npm run lint` and report errors.
```

---

# Module 3 — Global data loading & API errors

### Step 3.1 🟠 Shared lists are loaded once, before login, and never reloaded
**Problem:** `MainProvider` ([D/views/context/index.jsx:103](../../cafeFresco-dashboard/src/views/context/index.jsx#L103)) fetches categories, departments and distributors **once, when the app first loads**. On a fresh visit the user is logged out at that point, so `/department/fetch` and `/distributer/` return 401 and stay empty. After login (an SPA navigation) they **are never re-fetched**, so the department dropdowns on Add/Edit Employee and the distributor filters stay empty until a manual reload. Categories added on Add Category don't appear in Add Product until a reload either.
**Solution:** Load the shared lists when `sessionStatus` becomes `authenticated`, clear them on logout, and re-fetch after every create, update or delete in their module.

**🛠 Fix Prompt**
```
In views/context/index.jsx: trigger fetchCategories/fetchDepartments/fetchDistributor in a
useEffect keyed on sessionStatus === 'authenticated'; clear arrays on logout. Ensure
addCategory/EditCategory/allCategory, department.jsx, distributor.jsx call the matching
context refetch after successful mutations (department.jsx and distributor.jsx currently keep
their own local copy — make them use the context list instead of a duplicate fetch).
```
**🔍 Test Prompt**
```
Bug-hunt: clear cookies, open /admin/login, log in, go straight to Add Employee → department
dropdown populated without reload. Add a category → appears in Add Product dropdown
immediately. Logout → login as different role → lists correct. Report.
```
**✅ Done when:** dropdowns are filled right after login and stay current after every change.

---

### Step 3.2 🟡 No shared API client: errors are swallowed, 401s are ignored, fake 2-second spinners
**Problem:** About 30 files call `fetch` by hand. The patterns vary:
- Some ignore `response.ok`. Some show a generic `alert('Failed…')` and hide the server's message (Add Product, Add Category, Add Employee, Add Supplier).
- Several pages show a **fake 2-second spinner** with `setTimeout(() => setLoading(false), 2000)` instead of waiting for the request (`allCategory.jsx:20`, `allOrder.jsx:89`, `allPermission.jsx:50`, `allSupplier.jsx:42`, and others).
- Only the Dashboard handles 401.
- The backend error format is inconsistent: some routes return `{message}`, supplier and distributor routes return `{error}`. The UI reads `data.message`, so it shows `undefined`.
- `alert()` and `window.confirm()` are used for everything.

**Solution:**
- **Frontend:** add one `src/api/client.js` (`apiFetch(path, {method, body, formData})`). It always sends credentials, parses JSON safely, throws `ApiError(status, message)`, and on **401** calls `logout()` and redirects to login with `next`.
- **Backend:** standardise errors to `{ message }`.
- Replace the fake timers with real loading state.
- Use a single Snackbar/toast and a confirm dialog component instead of `alert` and `confirm`.

**🛠 Fix Prompt**
```
Create cafeFresco-dashboard/src/api/client.js with apiFetch() as described (credentials
'include', JSON or FormData body, safe JSON parse, ApiError with server `message`, global 401
handler that calls context logout and redirects to /admin/login?next=current path).
Create a NotificationProvider (MUI Snackbar) exposing notify.success/error and a ConfirmDialog
hook useConfirm(). Migrate ONE page first (allProduct.jsx) to apiFetch + notify + useConfirm and
show me the diff. Then migrate the remaining pages one by one. Remove every
setTimeout(...setLoading(false)...) pattern and use real loading state (finally block).
Backend: in routes/supplier.js and routes/distributer.js change `{ error: ... }` responses to
`{ message: ... }`.
```
**🔍 Test Prompt**
```
Bug-hunt: grep the dashboard for "fetch(`${BASE_URL}" outside api/client.js, "alert(",
"window.confirm(", "setTimeout(() => {\n *setLoading" and list leftovers. Stop the backend
and click through each page: every page must show an error state, not spin forever or
show "No data". Expire the cookie mid-session: next action redirects to login. Report.
```
**✅ Done when:** one client handles every call · server messages are shown · a 401 always leads to login.

### 🧪 Module 3 Gate
```
With the backend running, exercise every list page and every form once as admin; with the
backend stopped, confirm each page shows a clear error. Report a page-by-page table.
```

---

# Module 4 — Orders & Payments (highest business risk)

### Step 4.1 🔴 Stock is never checked or deducted when an order is placed
**Problem:** `POST /order/create` ([B/routes/order.js:25-35](../../cafeFresco-backend/routes/order.js#L25-L35)) reads and writes `product.stock`, but **products have no `stock` field**. Stock lives in the `inventory` collection (`quantityInStock`). `undefined < qty` is false, so the check always passes and nothing is deducted. **The shop can sell unlimited quantities of out-of-stock items.** The error message uses `product.name`, which also doesn't exist (the field is `title`).
**Solution:** For each line, run an atomic `Inventory.findOneAndUpdate({ productId, quantityInStock: { $gte: qty } }, { $inc: { quantityInStock: -qty } })`. If any line fails, roll back the lines already deducted, or use a MongoDB transaction when a replica set is available. Return 409 with the product title.

**🛠 Fix Prompt**
```
In cafeFresco-backend/routes/order.js POST /create: validate `products` is a non-empty array of
{productId (valid ObjectId), quantity (integer >= 1)}; merge duplicate productIds.
Deduct stock atomically from the Inventory model with findOneAndUpdate + $gte guard + $inc.
If any item fails, re-increment the items already deducted, and return
409 {message:`Not enough stock for ${product.title}`, productId}. Never read product.stock.
Keep the rest of the handler behaviour unchanged for now (pricing is fixed in the next step).
```
**🔍 Test Prompt**
```
Bug-hunt with a script (scratch file, not in repo): product with stock 2 — order qty 3 → 409 and
stock still 2; two orders of qty 2 fired in parallel → exactly one succeeds, stock 0, never
negative; order with 2 lines where line 2 fails → line 1 stock restored. Report PASS/FAIL.
```
**✅ Done when:** stock never goes negative · overselling is impossible even with parallel orders.

**🔗 Main-site impact:** `StripePayment.jsx` `createOrder()` already shows `data.message` when the request fails. Check that a 409 keeps the cart unchanged. There's also an existing bug: the catch block calls `toast.success(error.message)` ([cafeFresco-main/src/Components/StripePayment.jsx:162](../../cafeFresco-main/src/Components/StripePayment.jsx#L162)), so errors are shown as green success toasts. Change it to `toast.error`. Integration prompt: **B.1**.

---

### Step 4.2 🔴 The browser decides the order total and payment status
**Problem:**
- `totalAmount` and `payment` come straight from `req.body` ([order.js:15](../../cafeFresco-backend/routes/order.js#L15)). A customer can post `totalAmount: 1` and `payment: "paid"`.
- `` `${payment}` || 'unpaid' `` is always a non-empty string, so a missing value becomes `"undefined"`, which fails the enum and returns 500.
- The order stores no unit price, so the admin's order view shows the **current** product price ([allOrder.jsx:456](../../cafeFresco-dashboard/src/views/pages/order/allOrder.jsx#L456)), not the price paid.
- If the product is later deleted, the line shows "Untitled Product".

**Solution:**
- The server computes each line as `unitPrice = price × (1 − discount/100)`, stores `{productId, title, unitPrice, quantity, lineTotal}` as a snapshot, and sets `subtotal`, `discountAmount` and `totalAmount` itself. The discount code is checked server-side (Module 9).
- New orders always start with `paymentStatus: 'unpaid'`. Payment is confirmed only by Step 4.4.
- The admin order view shows the snapshot.

**🛠 Fix Prompt**
```
⚖️ aligned (SHARED D1, D2): Extend models/order.js products[] with title (String), unitPrice
(Number), lineTotal (Number); add subtotal, discountCode (String), discountAmount (Number),
paymentMethod (enum 'card'|'cod'), shippingAddress {fullName,phone,city,zip,line1},
stripePaymentIntentId, stockRestored (Boolean false), statusHistory [] , idempotencyKey —
all optional/defaulted so old orders load.
Move the logic into services/orderService.js createOrderFromCart(user, body). POST /order/create
builds the lines from the USER'S SERVER CART and IGNORES client products/totalAmount/payment
(compat window — rejected after B.6). Compute with utils/price.js (unitPrice → lineTotal →
subtotal → discountAmount → totalAmount, each round2); discount hook: accept body.discountCode
and call validateDiscount() (stub returning 0 until Step 9.1); paymentStatus 'unpaid'.
Validate shippingAddress (main-site Step 7.1 rules, utils/validation.js) — during the compat
window a missing address is allowed only if the request has no paymentMethod (old shop build).
Return the order. In the dashboard allOrder.jsx View modal show line title/unitPrice/quantity/
lineTotal from the snapshot, falling back to populated product for legacy orders, plus
subtotal/discount/total. Also check cafeFresco-main checkout code that calls /order/create and
list what it sends so we can align it (do not change the main site in this step, just report).
```
**🔍 Test Prompt**
```
Bug-hunt: POST /order/create with totalAmount:1 and payment:"paid" → stored total equals
computed total and paymentStatus unpaid. Change product price after ordering → order view still
shows old price. Delete a product (after Module 5 it should be blocked; for now use a legacy
order) → view does not crash. Report and fix.
```
**✅ Done when:** only the server sets totals · order history keeps the price paid at the time.

**🔗 Main-site impact:**
- Today the shop sends `totalAmount` and `payment` ([StripePayment.jsx:24-28](../../cafeFresco-main/src/Components/StripePayment.jsx#L24-L28)).
- The cart total uses `item.price` ([CartPage.jsx:41](../../cafeFresco-main/src/Components/CartPage.jsx#L41)). If that is the base price and not the discounted price, the shop shows a **different total** from the one the server will charge.
- Fix: the shop stops sending total and payment, displays the order's server `totalAmount` after creation, and uses the same discounted price (`discountedPrice`) in the cart.
- **Compatibility window:** the server ignores the extra fields instead of rejecting them, so an old shop build keeps working.

Integration prompt: **B.2**.

---

### Step 4.3 🟠 Order status changes have no rules; cancelling doesn't return stock
**Problem:** `POST /order/update-status` ([order.js:70](../../cafeFresco-backend/routes/order.js#L70)) accepts any change in either direction: `completed → pending`, `cancelled → completed`, `cancelled + paid`, `pending + paid` for card orders. Cancelling **does not return stock**. It calls `validateSync()` and ignores the result, then saves with validation turned off. The notification text doesn't say which order changed or what it changed to. The edit dialog ([allOrder.jsx:337](../../cafeFresco-dashboard/src/views/pages/order/allOrder.jsx#L337)) offers every option no matter the current state.
**Solution:** Enforce R2 and R3 on the server: `pending→completed`, `pending→cancelled`, and other states final. COD `unpaid→paid` is allowed only when `completed`. Cancelling restores stock exactly once. Record `statusHistory[{from,to,by,at}]`. The dialog offers only the moves that are allowed.

**🛠 Fix Prompt**
```
Backend order.js update-status: validate orderId ObjectId; define ALLOWED = {pending:['completed',
'cancelled']}; reject other transitions with 409 and clear message. Payment change: only
unpaid→paid, only when (resulting) orderStatus is 'completed'; never paid→unpaid (refund is
out of scope — return 409 explaining). ⚖️ aligned (SHARED D6): cancelling goes ONLY through
services/orderService.js cancelOrder(order, {byType:'admin', byId}) — atomic pending→cancelled,
restores stock once via inventoryService.adjustStock (stockRestored guard), releases the
discount redemption (discountService.releaseDiscount), cancels an open Stripe intent. The
customer cancel (main-site Step 9.2) and stale cleanup (SHARED D9) reuse the same function.
statusHistory entry {from,to,paymentFrom,paymentTo,byType:'admin',byId:req.admin.userId,at}.
Card orders can never be marked paid by hand (only D3). Save WITH validation. Notification
message: `${name} set order #${last6} to ${status}/${payment}`.
Frontend allOrder.jsx edit dialog: only show allowed next states for the selected order;
disable the dialog for final orders.
```
**🔍 Test Prompt**
```
Bug-hunt: try every from→to combination via curl and list results vs the rule table; cancel an
order twice (two parallel requests) → stock restored exactly once; completed order cannot go
back to pending; COD paid only after completed. Report a transition matrix.
```
**✅ Done when:** the transition matrix matches R2 and R3 · stock is restored exactly once.

---

### Step 4.4 🔴 Payment records can be forged; nothing verifies with Stripe
**Problem:**
- `POST /stripe/payment/create` ([B/routes/payment.js:31](../../cafeFresco-backend/routes/payment.js#L31)) marks a payment `Completed` whenever the client says the method isn't COD. It never checks Stripe.
- `payment-intent` takes `amount` from the client.
- `POST /order/set-transaction/:orderId` ([order.js:299](../../cafeFresco-backend/routes/order.js#L299)) lets **any logged-in customer attach any paymentId to any order**, including other people's.
- The order's `paymentStatus` is never linked to an actual payment.

**Solution:**
- Create the PaymentIntent server-side from the **order's server total**, using `orderId` with `metadata.orderId`.
- On confirmation, either through `POST /stripe/confirm` (server retrieves the PaymentIntent and checks `status === 'succeeded'`, the amount and the metadata) or through a Stripe **webhook**, create the Payment record and set `order.paymentStatus = 'paid'`.
- Remove or lock `set-transaction` with an ownership check.

**🛠 Fix Prompt**
```
⚖️ aligned (SHARED D3, D4, D9):
Backend payment.js: change POST /payment-intent to accept {orderId}; load order, check
order.userId === req.user.userId, orderStatus 'pending', paymentStatus 'unpaid'.
ONE INTENT PER ORDER: if order.stripePaymentIntentId exists and the intent is not
succeeded/canceled, retrieve it and return its clientSecret; else create intent with
amount=Math.round(order.totalAmount*100), currency from env CURRENCY (default 'usd'),
metadata:{orderId}, and store its id on the order. Return {clientSecret, amount}.
Add POST /stripe/confirm {paymentIntentId}: retrieve from Stripe, verify status 'succeeded',
metadata.orderId belongs to req.user, amount matches, then orderService.markOrderPaid() —
idempotent: Payment (unique transactionId), paymentStatus 'paid', paymentId, order email
(server-side). Optional webhook POST /stripe/webhook (express.raw, mounted before
express.json, signature via STRIPE_WEBHOOK_SECRET) calls the same markOrderPaid.
COD Payment is created inside /order/create (SHARED D2), so /payment/create and
/order/set-transaction are DEPRECATED: keep them working (with ownership checks) until B.6.
Implement cancelStaleUnpaidCardOrders() exactly as SHARED D9 (check Stripe BEFORE cancelling,
never cancel a succeeded intent; lazy, no setInterval — backend runs on Vercel serverless).
Then list every call in cafeFresco-main that must change (do not change it unless I confirm).
```
**🔍 Test Prompt**
```
Bug-hunt: as user A try to pay/attach payment to user B's order → 403/404; call /stripe/confirm
with a fake or unpaid intent → rejected; confirm the same intent twice → one Payment record;
amount tampering impossible. Use Stripe test card 4242… end-to-end. Report.
```
**✅ Done when:** only Stripe-verified payments mark an order paid · no cross-user access.

**🔗 Main-site impact (biggest change):** the current card flow is in the wrong order ([StripePayment.jsx:114-157](../../cafeFresco-main/src/Components/StripePayment.jsx#L114-L157)):
1. It creates a PaymentIntent for an amount the browser calculated.
2. It **charges the card**.
3. Only then does it create the order.

So if step 3 fails (out of stock, server error or network), **the customer has paid and no order exists**. The new flow (see B.3) is:
1. Create the order (unpaid; reserves stock).
2. Create a PaymentIntent for **that order**.
3. Confirm the card.
4. Call `/stripe/confirm`.
5. If the card fails, the order stays unpaid and can be retried or cancelled.

`createPayment()`, `setTransactionId()` and `sendOrderEmail()` are removed from **both** paths. ⚖️ aligned (SHARED D2): COD is one `/order/create` call, and the server creates the COD Payment and sends the email.

**Compatibility window:** keep the old `payment-intent {amount}` behaviour working for one step, and remove it in B.6.

Integration prompt: **B.3**.

---

### Step 4.5 🔴 Order history and stats are open to the public (IDOR)
**Problem:** `GET /order/history/:userId` ([order.js:193](../../cafeFresco-backend/routes/order.js#L193)) has **no auth**: anyone can read any customer's orders, names and emails by ID. `GET /order/stats` (line 233) exposes revenue publicly. `if (!orders)` never fires for an empty array.
**Solution:** `history/:userId` requires `isAdmin` + `authorizeRoles('admin','manager')`. `stats` requires the admin role, or remove it if nothing uses it (grep first).

**🛠 Fix Prompt**
```
Protect GET /order/history/:userId with isAdmin + authorizeRoles('admin','manager'), validate
the ObjectId, populate only needed fields (products.productId title, userId name email), sort
newest first. GET /order/stats: grep both frontends for usage; if unused delete it, else
protect with isAdmin + authorizeRoles('admin','manager'). Report usage found.
```
**🔍 Test Prompt**
```
Bug-hunt: curl both endpoints without cookie → 401; as customer cookie → 401; as editor → 403;
as manager → 200. The dashboard customer history modal still works. Report.
```
**✅ Done when:** no order data is reachable without the right admin role.

**🔗 Main-site impact:** grep shows the shop's order tracking ([Track.jsx](../../cafeFresco-main/src/Components/Track.jsx)) should use `/order/user/history`, which uses the customer's own cookie. Confirm it doesn't call `/order/history/:userId`. If it does, switch it before protecting the route. Integration prompt: **B.4**.

---

### Step 4.6 🟡 The order list's pagination, sorting and search are broken
**Problem:**
- `totalOrders` is the **page's** length, not the real total ([order.js:183](../../cafeFresco-backend/routes/order.js#L183)), so the UI always shows 1 page and older orders are unreachable.
- There is no sort order, so the oldest orders come first.
- An empty result returns **404**, which the UI treats as an error.
- Searching by a partial or invalid ID causes a CastError and a 500.
- The search box fires a request on **every keystroke** ([allOrder.jsx:55](../../cafeFresco-dashboard/src/views/pages/order/allOrder.jsx#L55)).
- Changing a filter doesn't reset to page 1.
- Amounts are shown with a hardcoded `$`.

**Solution:** Use `countDocuments(query)` for the total, sort by `createdAt: -1`, return 200 with an empty array, validate the ID (or support the last-6-characters search the UI displays), debounce search by 400 ms, reset to page 1 when filters change, and use one shared currency formatter.

**🛠 Fix Prompt**
```
Backend GET /order/fetch: compute total = countDocuments(query); totalPages; sort createdAt -1;
empty → 200 {orders:[], total:0}; if search is a valid ObjectId match _id, else return empty
(or match by customer email via a user lookup — choose email lookup). Clamp limit 1..100.
Frontend allOrder.jsx: use totalPages from server; debounce search 400ms; reset page to 1 on any
filter change; add src/utils/format.js formatMoney(amount) using one VITE_CURRENCY env
(default USD) and use it for all amounts in the dashboard (grep "\${" + "$" price renders).
```
**🔍 Test Prompt**
```
Bug-hunt: seed 25 orders → 3 pages, newest first; search by full ID, by email, by garbage →
no 500; filter while on page 3 → returns to page 1; typing fires 1 request. Report.
```
**✅ Done when:** every order can be reached · search never returns a 500.

### 🧪 Module 4 Gate
```
End-to-end on local stack: customer (cafeFresco-main) places COD order and card order (Stripe test),
stock decreases, admin sees both with correct totals, completes COD and marks paid, cancels
the other → stock restored; tampering attempts from Steps 4.1–4.5 all rejected. Report a
step-by-step PASS/FAIL log.
```

---

# Module 5 — Products

### Step 5.1 🔴 Files are uploaded before the auth check
**Problem:** On `/product/add`, `/product/update/:id`, `/category/add` and `/category/update/:id`, the `upload(...)` middleware runs **before** `isAdmin` ([B/routes/products.js:15](../../cafeFresco-backend/routes/products.js#L15), [B/routes/category.js:11](../../cafeFresco-backend/routes/category.js#L11)). **Anonymous users can write files to the server's disk.** Rejected requests (validation failure, 404, 403) leave orphaned files. The `/user/upload-image` route has no auth either ([B/routes/users.js:181](../../cafeFresco-backend/routes/users.js#L181)).
**Solution:** Put `isAdmin, authorizeRoles(...)` **before** `upload(...)`, and delete the uploaded file on any error response.

**🛠 Fix Prompt**
```
Reorder middleware so isAdmin + authorizeRoles run before upload() on product add/update and
category add/update. Add a small helper removeUploaded(req) and call it on every non-2xx exit
in those handlers. ⚖️ aligned (SHARED D4): DELETE routes/users.js POST /upload-image entirely
(unused by both frontends, broken: references undefined `User`) — same as main-site Step 14.1;
grep both frontends first to confirm no caller.
```
**🔍 Test Prompt**
```
Bug-hunt: count files in public/images/*; send anonymous multipart to each upload route → 401
and file count unchanged; send invalid data as admin → 400 and file count unchanged. Report.
```
**✅ Done when:** anonymous uploads are rejected · no orphaned files remain after errors.

---

### Step 5.2 🟠 Product update accepts any field, skips validation and leaks old images
**Problem:** `PUT /product/update/:id` ([products.js:71-113](../../cafeFresco-backend/routes/products.js#L71-L113)) has four problems:
- **Mass assignment.** It passes the whole `req.body` to `findByIdAndUpdate`, so an editor can overwrite `averageRating`, `reviews` and `inventory`.
- **No validation.** It runs without `runValidators`, so `discount: 150` and negative prices are saved.
- **Old images are never deleted.** The delete path is built wrongly as `public/images/product` + `/images/product/x.png`, so the file is never found.
- **Removing an image is broken.** Clearing it sends the string `"null"`, which becomes the image URL.

**Solution:** Allow-list the editable fields (title, description, price, discount, category, featured, newRelease, stock, image), validate them (price ≥ 0, discount 0–100, category exists), run validators, fix the image path, and support an explicit `removeImage=true`.

**🛠 Fix Prompt**
```
Rewrite PUT /product/update/:id: validate id; pick only allowed fields; coerce types
(Number, 'true'/'false' → Boolean); validate price>=0, 0<=discount<=100, category exists if
provided; stock if provided must be integer >= 0 and updates Inventory (create if missing),
not the product document. Image: new file → delete old file using
path.join(__dirname,'..','public', existing.image) ; body.removeImage==='true' → delete file
and set image ''. findByIdAndUpdate with runValidators:true. Apply the same validation to
POST /product/add (stock required integer >= 0, category required).
```
**🔍 Test Prompt**
```
Bug-hunt via curl: averageRating/reviews in body ignored; discount 150 → 400; price -1 → 400;
upload new image → old file removed from disk; removeImage → image '' and file removed;
stock "0" sets inventory to 0 (not ignored). Report.
```
**✅ Done when:** only allowed fields change · numbers are validated · no image files leak.

---

### Step 5.3 🟠 Adding a product can half-succeed and create duplicates
**Problem:** In `POST /product/add` ([products.js:50-60](../../cafeFresco-backend/routes/products.js#L50-L60)) the product is saved **first**, then the inventory. If stock is blank (`""` → `null`, while the field is required) the inventory save throws. The API returns 500, but **the product already exists without inventory**. The admin sees "Failed" and resubmits, which creates duplicates. Product titles have no uniqueness check, and the form sends `discount: ""` when left blank.
**Solution:** Validate everything before writing anything. Create the inventory in the same flow and delete the product if the inventory save fails. Add a case-insensitive unique-title check. The frontend sends numbers and shows the server's error.

**🛠 Fix Prompt**
```
POST /product/add: validate all fields first (Step 5.2 rules); reject duplicate title
(case-insensitive, trimmed) with 409; create product, then inventory; if inventory fails delete
the product and uploaded file, return 500 with message. Frontend addProduct.jsx: client-side
required checks (title, description, price, category, stock), numeric min attributes, default
discount 0, show server message, disable submit while saving, after success navigate to
/admin/all-product (or offer "Add another").
```
**🔍 Test Prompt**
```
Bug-hunt: submit with empty stock → clear error, no product created; double-click submit →
one product; duplicate title → 409 message shown; success → appears in list with stock. Report.
```
**✅ Done when:** no products exist without inventory · no duplicates.

---

### Step 5.4 🟡 The Edit Product page loses stock and zero values and redirects wrongly
**Problem:** In [D/views/pages/product/editProduct.jsx](../../cafeFresco-dashboard/src/views/pages/product/editProduct.jsx):
- `stock: data.stock` (line 56) is always empty because stock lives at `data.inventory.quantityInStock`.
- `discount || ""` turns `0` into `""`, which saves as `null` and makes the discounted price `NaN`.
- A deleted category leaves `category: ""`, which causes a CastError and a 500.
- After saving, the form is **cleared and stays on the same page**.
- Discard goes to the dashboard.
- There is no loading or not-found state for a bad ID.

**Solution:** Pre-fill from `inventory.quantityInStock`, use `??` instead of `||` for numbers, send only changed fields, go back to the list after saving, and show a "Product not found" state.

**🛠 Fix Prompt**
```
Fix editProduct.jsx: prefill stock from data.inventory?.quantityInStock; use ?? for numeric
fields; send image only if a new File was chosen, send removeImage when user deleted the
preview; send only changed fields; on success navigate('/admin/all-product'); loading state
while fetching; 404 → "Product not found" with back button; require category selection.
```
**🔍 Test Prompt**
```
Bug-hunt: edit product with discount 0 and stock 0 → values shown and preserved; change only
title → stock/discount/image unchanged in DB; open /admin/edit-product/123 → not-found state.
```
**✅ Done when:** editing never corrupts fields that weren't touched.

---

### Step 5.5 🟡 Product list: double requests, crash on a deleted category, misleading price column
**Problem:** In [D/views/pages/product/allProduct.jsx:42-54](../../cafeFresco-dashboard/src/views/pages/product/allProduct.jsx#L42-L54):
- Two effects both fetch, so every filter change makes **two requests**, and they can race.
- The page doesn't reset when a filter changes, so an empty page can show.
- `product.category.title` (line 160) **crashes the page** if the category was deleted.
- The "Price" column shows the discounted price.
- The row number hardcodes a page size of 10.
- Inventory uses a copy of this list with the same bugs ([inventory.jsx:52-64](../../cafeFresco-dashboard/src/views/pages/inventory/inventory.jsx#L52-L64)).
- Backend `/product/:id` returns 500 for a malformed ID.

**Solution:** Use one debounced effect, reset to page 1 on filter change, use `category?.title ?? 'Uncategorised'`, show Price, Discount and Final price separately, and validate the ObjectId in the backend `GET /:id`.

**🛠 Fix Prompt**
```
allProduct.jsx and inventory.jsx: single useEffect with 400ms debounce on [search, category,
sort, page]; ignore stale responses (AbortController); reset page to 1 when search/category/
sort change; null-safe category; columns Price / Discount / Final Price using formatMoney.
Backend products.js GET /:id and category.js GET /:id: return 400 for invalid ObjectId.
```
**🔍 Test Prompt**
```
Bug-hunt: network tab shows 1 request per change; delete a category used by a product (before
Module 7 blocks it) → list still renders; page 3 + new filter → page 1. Report.
```
**✅ Done when:** one request per change · deleting a category never crashes the list.

---

### Step 5.6 🟠 Deleting a product breaks orders, carts and reviews
**Problem:** `DELETE /product/delete/:id` ([products.js:124](../../cafeFresco-backend/routes/products.js#L124)) hard-deletes the product. Past orders, carts, wishlists and reviews still point at it. Before Step 4.2's snapshot, those orders show "Untitled Product" at a price of 0.
**Solution (R6):** If the product appears in any order, **block** the delete with 409 and offer a "Deactivate" toggle instead (`isActive: false` hides it from the shop). If it has no orders, delete it and also remove it from carts and wishlists and delete its reviews.

**🛠 Fix Prompt**
```
Add isActive (default true) to models/product.js. Public product endpoints (/fetch, /all,
/featured, /new-releases, /:id for shop) must filter isActive:true unless an admin query flag
?includeInactive=true is passed by an authenticated admin. ⚖️ aligned (SHARED D7): add
middleware/optionalAdmin.js (sets req.admin from a valid adminToken, never rejects) on those
routes; the flag is honoured only when req.admin is set. The dashboard MUST send
includeInactive=true (and credentials:'include') from allProduct.jsx, inventory.jsx and
editProduct.jsx, otherwise deactivated products vanish from admin pages. Cart: inactive items
stay with available:false (main-site Step 6.1 formatCart). DELETE: if orderModel.exists({
'products.productId': id}) → 409 "Product has orders — deactivate it instead". Otherwise delete
product, inventory, image, reviews, and pull from carts and wishlists (inspect models/cart.js and
models/wishlist.js for the field names). Dashboard allProduct.jsx: add Active toggle column
(PUT update isActive) and show the 409 message.
```
**🔍 Test Prompt**
```
Bug-hunt: delete product with orders → 409, still in DB; deactivate → hidden on cafeFresco-main
(:3001) but visible in dashboard; delete product without orders → gone from carts/wishlists.
```
**✅ Done when:** order history never loses a product · inactive products are hidden from the shop.

**🔗 Main-site impact:** listing pages need no change (`/product/all`, `/featured`, `/new-releases` filter automatically). But a product that is already in a customer's cart can become inactive. `/order/create` must reject it with 409 "Product no longer available", and the cart page must mark it unavailable instead of crashing. Integration prompt: **B.5**.

### 🧪 Module 5 Gate
```
Full product CRUD as admin, manager and editor (editor cannot delete — UI disabled AND API 403).
Verify images on disk match DB references (no orphans) by listing public/images/product vs
product.image values. Report.
```

---

# Module 6 — Inventory

### Step 6.1 🟠 Stock updates overwrite the value, allow negatives and keep no history
**Problem:**
- `POST /product/inventory/update/:id` ([products.js:279](../../cafeFresco-backend/routes/products.js#L279)) **sets** the absolute quantity. If two staff restock at the same time, one update silently overwrites the other.
- Negative and decimal values are accepted.
- `restockDate` is set even when stock is *reduced*.
- Stock is changed in two places (Edit Product and Inventory) with different rules.
- Inventory can't be filtered by low or out-of-stock items.
- The UI rejects `0` (`!formData.stock`), so **you can't mark an item out of stock** ([inventory.jsx:80](../../cafeFresco-dashboard/src/views/pages/inventory/inventory.jsx#L80)).

**Solution:** Support two modes, `set` (an integer ≥ 0) and `adjust` (± delta, using an atomic `$inc` with a ≥ 0 guard). Set `restockDate` only when stock goes up. Allow `0` in the UI. Show a low-stock badge (threshold from env or 5) and a "Low / Out of stock" filter. Edit Product calls the same inventory logic through a shared function.

**🛠 Fix Prompt**
```
Backend: move stock logic into services/inventoryService.js with setStock(productId, qty) and
adjustStock(productId, delta) (atomic, never < 0, integer only, restockDate when increasing).
Use it from inventory update route (accept {mode:'set'|'adjust', quantity}) and from product
add/update. Add ?stock=low|out filter to GET /product/fetch (lookup inventory).
Frontend inventory.jsx: modal with Set / Add / Remove options, allows 0, shows current stock,
low-stock chip (<= VITE_LOW_STOCK || 5), red chip for 0, filter dropdown All/Low/Out.
```
**🔍 Test Prompt**
```
Bug-hunt: set 0 → works; remove more than available → 409; two parallel +5 adjusts → +10;
decimals rejected; low filter returns correct products. Report.
```
**✅ Done when:** stock math is safe under concurrent updates · zero is allowed · low stock is visible.

### 🧪 Module 6 Gate
```
Place orders (Module 4) and adjust stock concurrently; confirm final quantities equal
expected arithmetic. Report.
```

---

# Module 7 — Categories

### Step 7.1 🟠 Deleting a category orphans its products
**Problem:** `DELETE /category/delete/:id` ([category.js:130](../../cafeFresco-backend/routes/category.js#L130)) deletes the category even when products still use it. Those products then have `category: null`, which crashes the list page (Step 5.5) and makes them unfilterable in the shop.
**Solution (R6):** Block the delete with 409 and include the number of products that use the category.

**🛠 Fix Prompt**
```
category.js DELETE: if Product.countDocuments({category:id}) > 0 → 409 {message:`${n} products
use this category. Move them first.`}. Dashboard allCategory.jsx shows that message.
```
**🔍 Test Prompt**
```
Bug-hunt: delete used category → 409 + message, still exists; unused → deleted with image file.
```
**✅ Done when:** a category that still has products can't be deleted.

---

### Step 7.2 🟡 The UI's role rules contradict the API, and form bugs
**Problem:**
- Add and Edit Category pages show **AccessDenied to managers and editors** ([addCategory.jsx:24](../../cafeFresco-dashboard/src/views/pages/category/addCategory.jsx#L24)), while the API allows them. Step 2.1 fixes this through the route guard.
- The category update error path calls `fs.unlink(path).catch()` on the **callback** API ([category.js:75,121](../../cafeFresco-backend/routes/category.js#L75)). That throws a TypeError, which turns a 404 into a 500.
- An update can rename a category to an existing name (no uniqueness check).
- Uniqueness is case-sensitive, so "Drinks" and "drinks" both exist.
- The description can't be cleared.
- Add stays on the same page and the list doesn't refresh (Step 3.1).
- The list has a fake 2-second loader and shows no image or description.
- The pagination component renders even when there are no categories.

**Solution:** Use `fs.promises.unlink`, add a case-insensitive unique check on add and update, allow an empty description, navigate to the list after adding, and show image and description thumbnails.

**🛠 Fix Prompt**
```
category.js: use require('fs').promises for unlink in update/error paths; case-insensitive
duplicate check (collation or regex ^title$ with escaping) on add AND update (exclude self);
allow description '' (check !== undefined instead of truthy). addCategory.jsx: navigate to
/admin/all-category after success. allCategory.jsx: real loading state, thumbnail + description
columns, hide Pagination when totalPages <= 1.
```
**🔍 Test Prompt**
```
Bug-hunt: update non-existent id with image → 404 not 500; create "drinks" when "Drinks" exists
→ 409; rename to existing → 409; clear description → saved empty. Report.
```
**✅ Done when:** category names are unique regardless of case · all error paths return correct codes.

### 🧪 Module 7 Gate
```
Category CRUD as all three roles + product linkage checks. Report.
```

---

# Module 8 — Dashboard (home stats)

### Step 8.1 🔴 The dashboard shows random fake numbers
**Problem:** `GET /api/daily-report` builds its graph from `Math.random()` ([B/routes/dashboard.js:177](../../cafeFresco-backend/routes/dashboard.js#L177)), so the "today" chart is fake and changes on every refresh. `TotalGrowthBarChart` has a Today/Month/Year dropdown that changes nothing. `TotalOrderLineChartCard` has a Month/Year toggle that only switches **static template chart data** (`chart-data/total-order-*.jsx`).
**Solution:** Use real data: hourly order totals for today, daily totals for the month, monthly totals for the year. The dropdowns and toggles must change the query, or be removed.

**🛠 Fix Prompt**
```
Backend dashboard.js: replace random graphData with real aggregation — today's revenue per hour
(24 buckets) using R4 revenue definition. Add GET /api/order-trend?range=month|year returning
counts per day (month) or per month (year). Frontend: BajajAreaChartCard uses real series;
TotalOrderLineChartCard toggle fetches /api/order-trend; TotalGrowthBarChart dropdown either
drives a range param on /api/yearly-report or is removed. Delete unused static chart-data files.
```
**🔍 Test Prompt**
```
Bug-hunt: refresh dashboard 3 times → identical numbers; create an order now → today chart and
counts update; toggles change the chart; numbers match a manual Mongo aggregation. Report.
```
**✅ Done when:** no random or template data appears anywhere on the dashboard.

---

### Step 8.2 🟠 Three different definitions of "revenue"
**Problem:**
- `/api/dashboard` and `/api/earning` count `paymentStatus: paid`, which **includes cancelled (refund-owed) orders**.
- `/api/yearly-report` counts `orderStatus: completed`, which **includes unpaid COD orders**.
- `/order/stats` uses completed only.
- So the same month shows different revenue on different cards.
- "Total Income" cards actually show **order counts** (`TotalIncomeDarkCard total={totalCompletedOrders}`, [index.jsx:96](../../cafeFresco-dashboard/src/views/dashboard/Default/index.jsx#L96)).
- `endOfMonth` uses `$lt 23:59:59`, which drops the last second.
- Week/month boundaries use the **server's** timezone.

**Solution:** One `revenueMatch` helper based on R4, used by every stats endpoint. Use half-open ranges (`$gte start`, `$lt nextStart`). Use one configurable timezone (`APP_TZ`, for example `Asia/Karachi`). Label the cards correctly ("Completed orders", "Pending orders").

**🛠 Fix Prompt**
```
Create B/services/stats.js exporting revenueMatch = {orderStatus:'completed', paymentStatus:'paid'}
and range helpers using moment-timezone (add dependency) with process.env.APP_TZ default
'Asia/Karachi', half-open ranges. Refactor /api/earning, /api/dashboard, /api/yearly-report,
/api/daily-report (and /order/stats if kept) to use them. Dashboard UI: fix card labels to
match the numbers shown; use formatMoney.
```
**🔍 Test Prompt**
```
Bug-hunt: create orders: completed+paid, completed+unpaid, cancelled+paid, pending+paid. Revenue
on every card = only the first. Order created at 23:59:59 last day of month counts in that
month. Report numbers per card vs expected.
```
**✅ Done when:** every card agrees with R4.

---

### Step 8.3 🟡 Dashboard page bugs
**Problem:** In [D/views/dashboard/Default/index.jsx](../../cafeFresco-dashboard/src/views/dashboard/Default/index.jsx):
- `setErrorMessage` is **undefined** (line 73), so any API error throws a ReferenceError.
- `setLoading(false)` runs before the fetch finishes (line 79), so skeletons never show.
- A 404 is treated as "Please login again".
- Managers can't see stats at all under the current rules (R1 gives them view access).
- Stats routes are `authorizeRoles("admin")` only.

**Solution:** Add a real loading and error state using `apiFetch`, and let stats routes accept `admin` and `manager`.

**🛠 Fix Prompt**
```
Dashboard index.jsx: use apiFetch; proper isLoading until all requests settle (Promise.all);
error state with Retry button; remove alert/setTimeout redirects (apiFetch handles 401).
Backend dashboard.js: authorizeRoles('admin','manager') on all stats routes.
PopularCard / TotalGrowthBarChart: same loading/error pattern.
```
**🔍 Test Prompt**
```
Bug-hunt: throttle network → skeletons visible; stop backend → error + retry works;
manager sees dashboard; editor gets AccessDenied via route guard (not crash).
```
**✅ Done when:** loading, error and role behaviour are all correct.

### 🧪 Module 8 Gate
```
Seed a known dataset (script in scratch dir) and assert every dashboard number equals the
expected value. Report a card-by-card table.
```

---

# Module 9 — Discount Codes

### Step 9.1 🔴 Discount codes can be abused, and the per-user check is broken
**Problem:** In `POST /discount/apply` ([B/routes/discountCode.js:57](../../cafeFresco-backend/routes/discountCode.js#L57)):
- `req.user.id` is **undefined**, because the token stores `userId`. The "already used" check therefore never matches, and `undefined` gets pushed into `usedBy`.
- `maxUses` is **never enforced**.
- The code is marked used **when it is applied, not when an order is placed**. A user who applies it and abandons the cart loses the code, and the order total never includes the discount on the server.
- `cartTotal` comes from the client.
- `code.trim()` crashes on a missing code.
- Matching is case-sensitive.

**Solution:**
- Add a shared `validateDiscount({ code, userId, subtotal })` that checks it exists, is active, isn't expired, meets `subtotal ≥ minPurchase`, has `usedCount < maxUses`, and hasn't been used by this user.
- `/apply` becomes a **preview only**: it calculates the discount from the server-side cart subtotal and records nothing.
- `/order/create` calls the same function and **atomically** records the use (`$inc usedCount`, `$addToSet usedBy`, with a guard).
- Store codes in uppercase.

**🛠 Fix Prompt**
```
models/discountCode.js: add usedCount (default 0), isActive (default true); code uppercase+trim.
Create services/discountService.js validateDiscount({code,userId,subtotal}) and
redeemDiscount({codeId,userId}) using findOneAndUpdate guarded by usedCount < maxUses and
usedBy $ne userId, plus releaseDiscount({codeId,userId}) ($inc usedCount -1, $pull usedBy)
which orderService.cancelOrder calls on EVERY cancel (SHARED D5/D6). /discount/apply: body
{code} (ignore cartTotal), compute subtotal from the user's server cart with utils/price.js,
return {code, subtotal, discountAmount, total} — preview only (no writes); use
req.user.userId. /order/create: call validate + redeem, set discountCode/discountAmount on the
order (replace the stub from Step 4.2). If order creation fails after redeem, roll back.
```
**🔍 Test Prompt**
```
Bug-hunt: maxUses 1 → second user rejected; same user twice → rejected; apply without ordering
→ code still usable; parallel redemptions at maxUses boundary → never exceeds; expired → rejected;
lower/upper case code works; missing code → 400 not 500. Report.
```
**✅ Done when:** usage limits hold under parallel requests · the discount is applied on the server only.

**🔗 Main-site impact:** `CartPage.jsx` `handleDiscount()` ([CartPage.jsx:62-90](../../cafeFresco-main/src/Components/CartPage.jsx#L62-L90)) sends `cartTotal` and stores `newTotal`, but the **code itself is never passed to checkout**. Once the server computes totals, the discount would be lost. Fix:
- Keep `discountCode` in the product context.
- Show the preview `discountAmount` and `newTotal`.
- Send `discountCode` in `/order/create`.
- If the server rejects the code at order time (used up meanwhile), show the message and the full price, and let the customer continue or cancel.
- ⚖️ aligned (SHARED D5): when cart items or quantities change, **keep the code and re-run the preview**. Clear it, and show the reason, only if the preview fails. The preview response is `{code, subtotal, discountAmount, total}`.
- Write `scripts/migrateDiscountCodes.js` (uppercase codes, `usedCount = usedBy.length`, remove `null` entries left by the `req.user.id` bug). Tell the user to run it.

Integration prompt: **B.2** (same prompt, discount part).

---

### Step 9.2 🟡 Discount admin form validation
**Problem:** The create/update API doesn't validate `discountPercentage` (it could be 0, 150 or negative), accepts an expiry date in the past, and doesn't check `maxUses ≥ 1`. The UI rejects `minPurchase: 0` because it checks `!minPurchase` ([discount.jsx:105](../../cafeFresco-dashboard/src/views/pages/discountCode/discount.jsx#L105)), so **a code with no minimum purchase can't be created**. A duplicate code returns 400 in one place and an unhandled E11000 500 in another. The `disabled={!adminRole?.toLowerCase() === "admin"}` checks are always `false` (operator precedence), here and in four other files.
**Solution:** Validate on the server (1 ≤ % ≤ 100, future expiry, maxUses ≥ 1, minPurchase ≥ 0), allow 0 in the UI, show used/remaining counts and an Active toggle, and fix the precedence bug everywhere.

**🛠 Fix Prompt**
```
discountCode.js create/update: validate fields as described, handle duplicate key → 409.
discount.jsx: allow minPurchase 0 (check === '' instead of falsy), date min = today, show
usedCount/maxUses and isActive toggle. grep the dashboard for "!adminRole?.toLowerCase() ==="
and replace with permission helper can(role, action) from src/config/permissions.js.
```
**🔍 Test Prompt**
```
Bug-hunt: create with 0 min purchase → ok; 150% → 400; past date → 400; duplicate → 409 message;
grep confirms no "!adminRole?.toLowerCase() ===" remains. Report.
```
**✅ Done when:** every rule is validated on the server · the UI accepts valid edge values.

### 🧪 Module 9 Gate
```
Create code → customer previews → places order with it → admin sees discount on order →
usage count increments once. Report.
```

---

# Module 10 — Customers (Users)

### Step 10.1 🔴 Public endpoint leaks all customer data
**Problem:** `GET /user/search` ([B/routes/users.js:303](../../cafeFresco-backend/routes/users.js#L303)) has **no auth**. Anyone can search `?query=a` and get every customer's name, email, phone, address, cart ID and **password hash**. `/user/all` also returns full documents, including password hashes and reset tokens. The regex is built from raw user input (ReDoS and regex injection).
**Solution:** Protect `/user/search` with admin and manager roles, `.select()` safe fields only on both routes, escape the regex, and paginate the search.

**🛠 Fix Prompt**
```
users.js: /search and /all → isAdmin + authorizeRoles('admin','manager'); .select('name email
phone address createdAt'); escape regex input (write escapeRegex helper); search returns 200
with [] when nothing found and supports page/limit with totalPages. Never return password,
resetPasswordToken, resetPasswordExpires anywhere — grep all user/admin responses for leaks.
```
**🔍 Test Prompt**
```
Bug-hunt: curl /user/search?query=a without cookie → 401; as manager → fields exclude password;
query ".*" or "(a+)+$" → safe; grep every res.json in routes for documents that may include
password and report them.
```
**✅ Done when:** no customer data is public · no password hashes appear in any response.

---

### Step 10.2 🟡 Users page logic
**Problem:** In [D/views/pages/user/allUser.jsx](../../cafeFresco-dashboard/src/views/pages/user/allUser.jsx):
- The page has **two** role checks that disagree: lines 34 and 148, manager vs admin-only.
- Search is debounced by **2 seconds**.
- Search and pagination effects both fire, so there are double fetches.
- "No users" from a search returns 404, which shows as an error.
- The search response shape (an array) differs from the list response (`data.data`).
- The history modal shows no total spent and no status.

**Solution:** Use the route guard, a 400 ms debounce, one effect, one response shape, and a history modal with order ID, date, status, payment and total plus lifetime spend.

**🛠 Fix Prompt**
```
allUser.jsx: remove both inline role checks; single effect on [debouncedQuery, page] (400ms);
use paginated /user/search response shape same as /user/all; history modal table with
date/status/payment/total and a "Lifetime spend (completed+paid)" summary using formatMoney.
```
**🔍 Test Prompt**
```
Bug-hunt: as manager page works; search updates after ~0.4s with one request; no-match shows
"No users found" not an error; history totals match DB. Report.
```
**✅ Done when:** the page behaves the same for every role it allows.

### 🧪 Module 10 Gate
```
Security sweep: for every /user/* route list auth requirement and response fields; anything
public that returns PII = FAIL.
```

---

# Module 11 — Permissions (Admin accounts)

### Step 11.1 🔴 Admin management has no guardrails
**Problem:** In [B/routes/admin.js](../../cafeFresco-backend/routes/admin.js):
- `create-permission` (line 114) doesn't validate email format, password length or role, and **returns the new admin including the password hash** (line 139).
- `update-permission` can **demote the root admin or the caller themselves**, which can leave nobody with admin rights.
- `delete-permission` doesn't lowercase the email, so mixed-case emails aren't found. It also lets an admin delete themselves.
- `DELETE /admin/delete/:id` compares `req.admin.id`, which is **undefined** because the token has `userId`, so self-delete is possible. It also doesn't protect root.
- A deleted or demoted admin's JWT stays valid for 15 days on routes that only check `isAdmin`.

**Solution:**
- Validate all inputs and return safe fields only.
- Forbid changing or deleting a root admin, forbid changing or deleting yourself, and forbid removing the last admin.
- Make `isAdmin` check that the admin still exists. This is cheap and adds one lookup.
- Remove the unused `/admin/delete/:id`, or fix it with the same rules.

**🛠 Fix Prompt**
```
admin.js: create-permission → validate email (validator.isEmail), password >= 8, role in enum;
lowercase email; respond {name,email,role}. update-permission/delete-permission → lowercase
email; 403 if target isRoot or target is req.admin.userId; 409 if change would leave zero
admins with role 'admin'. /admin/delete/:id → grep usage; delete route if unused, else apply
same rules using req.admin.userId. middleware/isAdmin.js: after jwt.verify, load admin
(select role) and 401 if missing; attach role to req.admin so authorizeRoles reuses it
(avoid the second DB query).
```
**🔍 Test Prompt**
```
Bug-hunt: admin demotes self → 403; demote root → 403; delete last admin → 409; delete admin B
then use B's old cookie → 401 on every route; create with "bad-email" → 400; response has no
password field. Report.
```
**✅ Done when:** the system can never be left without an admin · deleted accounts lose access immediately.

---

### Step 11.2 🟡 The permissions page dialog fires an update when closed
**Problem:** The Edit Role dialog's `onClose` calls `handleEditRole(false)` ([allPermission.jsx:396](../../cafeFresco-dashboard/src/views/pages/permission/allPermission.jsx#L396)). **Clicking outside the dialog or pressing Esc sends the update request.** There is also a hooks-order violation (fixed in Step 2.1), a fake 2-second loader, no indication of root or the current user, and no way to reset another admin's password.
**Solution:** `onClose` only closes the dialog. Show "Root" and "You" badges and disable actions on those rows. Fix the loader. A password reset for another admin goes through the existing forgot-password flow ("Send reset link" button calling `/admin/forgot-password`).

**🛠 Fix Prompt**
```
allPermission.jsx: Edit dialog onClose → setOpenEditModal(false) only; show Root/You chips
(use /admin/me email and admin.isRoot) and disable edit/delete on those rows; add "Send reset
link" action that POSTs /admin/forgot-password with that email; real loading state.
```
**🔍 Test Prompt**
```
Bug-hunt: open edit, press Esc → no network request; root/self rows disabled; reset link email
received (check Gmail or log transport). Report.
```
**✅ Done when:** closing a dialog never changes data.

### 🧪 Module 11 Gate
```
Role lifecycle test: create editor → login as editor (matrix R1) → promote to manager → access
updates without re-login → delete → access revoked immediately.
```

---

# Module 12 — Employees

### Step 12.1 🔴 "Delete employee" deletes a **product**
**Problem:** `handleDelete` calls `${BASE_URL}/product/delete/${id}` ([D/views/pages/employee/allEmployee.jsx:75](../../cafeFresco-dashboard/src/views/pages/employee/allEmployee.jsx#L75)), which is the product endpoint. Employee deletion never works, and the success alert says "Product deleted".
**Solution:** Call `/employee/delete/:id` and fix the messages. The delete button follows R1 (admin only).

**🛠 Fix Prompt**
```
allEmployee.jsx handleDelete: call DELETE /employee/delete/:id via apiFetch, messages refer to
Employee, button visible/enabled only when can(role,'employee.delete').
```
**🔍 Test Prompt**
```
Bug-hunt: delete employee → removed from employee list, product count unchanged; as manager
button hidden and API returns 403.
```
**✅ Done when:** delete removes the employee and nothing else.

---

### Step 12.2 🟠 Editing silently re-activates inactive employees, and refresh breaks the page
**Problem:** In [D/views/pages/employee/editEmployee.jsx](../../cafeFresco-dashboard/src/views/pages/employee/editEmployee.jsx):
- `isActive: PassedEmployee?.isActive || true` (line 27) is **always true**, so saving an inactive employee **re-activates them**.
- The form depends on `location.state`, so a refresh or a shared link gives an empty form, and submit crashes on `PassedEmployee._id`.
- `PassedEmployee?.department._id` crashes when the department is null.

**Solution:** Add `GET /employee/:id`, load by URL param, use `??` for booleans, and add null-safe department handling.

**🛠 Fix Prompt**
```
Backend employee.js: add GET /:id (isAdmin, admin/manager) populating department. editEmployee.jsx:
load via useParams id (ignore location.state), loading + not-found states, isActive ?? true,
department?._id ?? ''. Same pattern for editSupplier.jsx (add GET /supplier/:id) — it also
relies on location.state.
```
**🔍 Test Prompt**
```
Bug-hunt: edit inactive employee, change phone, save → still inactive; refresh edit page →
data loads; employee whose department was deleted → page loads with empty department.
```
**✅ Done when:** edit pages work from a direct URL · no hidden field changes on save.

---

### Step 12.3 🟡 Employee data rules
**Problem:**
- `cnic` is stored as a **Number**, so leading zeros and the `xxxxx-xxxxxxx-x` format are lost, and there's no length validation.
- A duplicate email causes an unhandled E11000 and a generic 500.
- Update accepts any field (mass assignment) without validators.
- Salary can be negative.
- `setTotalPages(data.page)` ([allEmployee.jsx:44](../../cafeFresco-dashboard/src/views/pages/employee/allEmployee.jsx#L44)) sets total pages to the *current page*, so pagination never shows more pages.
- The backend `limit` isn't parsed for `skip`.
- Search only covers CNIC, not name.

**Solution:** Store CNIC as a String matching `^\d{5}-\d{7}-\d$`, with a migration for existing numbers. Return 409 for a duplicate email. Allow-list fields and run validators. Require salary ≥ 0. Use `totalPages = ceil(total/limit)`. Search by name, CNIC or email.

**🛠 Fix Prompt**
```
models/employee.js: cnic String unique with regex validator, salary min 0, email lowercase.
Write scripts/migrateCnic.js converting numeric cnic to zero-padded 13-digit formatted string.
employee.js: allow-list fields on register/update, runValidators, E11000 → 409 with field name,
parseInt page/limit, totalPages in response, search param matches name/cnic/email (escaped).
allEmployee.jsx: use totalPages; search label "Search name, CNIC, email".
addEmployee/editEmployee: CNIC text input with mask 12345-1234567-1, salary min 0, show server errors.
```
**🔍 Test Prompt**
```
Bug-hunt: CNIC with leading zero preserved; invalid CNIC → 400; duplicate email → 409 message;
15 employees → 2 pages; search by name works; negative salary rejected. Report.
```
**✅ Done when:** IDs keep their exact format · pagination is correct · duplicates are reported clearly.

### 🧪 Module 12 Gate
```
Employee CRUD as admin and manager; editor gets AccessDenied via route guard and 403 from API.
```

---

# Module 13 — Departments

### Step 13.1 🟠 Deleting a department orphans its employees; RBAC mismatch
**Problem:** `DELETE /department/delete/:id` ([B/routes/department.js:56](../../cafeFresco-backend/routes/department.js#L56)) deletes the department even when employees still belong to it. The edit page then crashes (Step 12.2). The API allows editors to add departments while the UI blocks them. Updates accept any field. Name uniqueness is case-sensitive. The UI requires a description, but the model treats it as optional.
**Solution:** Block the delete with 409 and the employee count. Set roles from R1. Allow-list fields. Check uniqueness case-insensitively. Make the description optional in the UI. Show the employee count per department.

**🛠 Fix Prompt**
```
department.js: roles per R1; delete → 409 if employeeModel.countDocuments({department:id})>0;
pick {name, description, isActive}; case-insensitive unique check on add/update; validate id.
GET /fetch includes employeeCount (aggregate or countDocuments per dept).
department.jsx: description optional; show employeeCount; show 409 message; use context list
(Step 3.1) instead of its own duplicate fetch.
```
**🔍 Test Prompt**
```
Bug-hunt: delete department with employees → 409; "kitchen" vs "Kitchen" → 409; editor → 403
from API; counts correct. Report.
```
**✅ Done when:** departments that still have employees can't be deleted.

### 🧪 Module 13 Gate
```
Department + employee linkage regression. Report.
```

---

# Module 14 — Suppliers

### Step 14.1 🔴 "Delete supplier" deletes a **distributor**
**Problem:** In `allSupplier.jsx`, `handleDelete` calls `${BASE_URL}/distributer/delete/${id}` ([D/views/pages/supplier/allSupplier.jsx:60](../../cafeFresco-dashboard/src/views/pages/supplier/allSupplier.jsx#L60)). Suppliers can't be deleted, and the messages say "Distributor".
**Solution:** Call `/supplier/delete/:id` and fix the messages.

**🛠 Fix Prompt**
```
allSupplier.jsx: delete calls DELETE /supplier/delete/:id; all texts say Supplier; button per R1.
```
**🔍 Test Prompt**
```
Bug-hunt: delete supplier → removed; distributor count unchanged; editor → no button and 403.
```
**✅ Done when:** delete removes the supplier only.

---

### Step 14.2 🟡 The active toggle sends the whole document; fake loader; RBAC
**Problem:**
- The active toggle PUTs the **entire populated object** ([allSupplier.jsx:136](../../cafeFresco-dashboard/src/views/pages/supplier/allSupplier.jsx#L136)), including the populated `distributor` object, `_id` and timestamps. It fails or overwrites data, and the failure is silent.
- Pagination is client-side and doesn't reset when filters change.
- The page has a fake 2-second loader.
- The API lets editors **delete** suppliers, unlike every other module.
- There is no check that the chosen distributor exists or is active.
- A duplicate email returns 400 with Mongo's raw message.

**Solution:** The toggle sends `{ isActive }` only. The backend allow-lists fields, validates the distributor, returns 409 for a duplicate email, and uses roles from R1. The page uses a real loader and resets to page 1 when filters change.

**🛠 Fix Prompt**
```
supplier.js: roles per R1; pick {name, phone, email, address, supplies, distributor, isActive};
validate distributor exists if provided; E11000 → 409; validate id. allSupplier.jsx: toggle sends
{isActive} only and shows errors; reset page on filter change; real loading.
```
**🔍 Test Prompt**
```
Bug-hunt: toggle active → only isActive changes in DB (compare doc before/after); invalid
distributor id → 400; duplicate email → 409 message shown. Report.
```
**✅ Done when:** a toggle changes exactly one field.

### 🧪 Module 14 Gate
```
Supplier CRUD + filters (active, supplies, distributor) as admin and manager. Report.
```

---

# Module 15 — Distributors

### Step 15.1 🟠 Deleting a distributor orphans its suppliers; RBAC; validation
**Problem:** `DELETE /distributer/delete/:id` ([B/routes/distributer.js:33](../../cafeFresco-backend/routes/distributer.js#L33)) leaves suppliers pointing at a missing distributor. Editors can delete distributors. Update accepts any field. Errors use `{error}`, which the UI shows as `undefined` (fixed in Step 3.2). Name search builds a regex from raw input.
**Solution:** Block the delete with 409 and the supplier count (or offer deactivate). Set roles from R1. Allow-list fields. Escape the regex.

**🛠 Fix Prompt**
```
distributer.js: roles per R1; delete → 409 if Supplier.countDocuments({distributor:id})>0;
pick {name, contactPerson, phone, email, address, supplyCategories, isActive}; escape name
regex; E11000 → 409; validate id. distributor.jsx: show 409 message; supplier count column;
use context list.
```
**🔍 Test Prompt**
```
Bug-hunt: delete distributor with suppliers → 409; search "(" → no 500; editor delete → 403.
```
**✅ Done when:** distributors that still have suppliers can't be deleted.

### 🧪 Module 15 Gate
```
Distributor ↔ supplier linkage regression. Report.
```

---

# Module 16 — Notifications & Header

### Step 16.1 🟠 Notification endpoints are public and global
**Problem:** `GET /admin/notify` and `POST /admin/mark-seen` ([B/routes/admin.js:331,343](../../cafeFresco-backend/routes/admin.js#L331)) have **no auth**. Anyone can read admin activity and customer names, or mark every notification as seen. "Seen" is global, so when one admin reads a notification it disappears for everyone. Only today's notifications are ever shown. `/notify` has no try/catch, so a DB error becomes an unhandled rejection. The header search box ([D/layout/MainLayout/Header/SearchSection](../../cafeFresco-dashboard/src/layout/MainLayout/Header/SearchSection/index.jsx)) is template UI that does nothing.
**Solution:** Require `isAdmin`. Track seen per admin (a `seenBy: [adminId]` array). Show the latest 20 regardless of date, with an unread count. Wrap handlers in try/catch. Remove the dead search box, and remove the template "Upgrade plan / Need help" card and the "Good Morning" greeting if they aren't wanted.

**🛠 Fix Prompt**
```
models/notification.js: add seenBy [ObjectId ref admin]; keep `seen` for back-compat unused.
admin.js /notify (isAdmin): latest 20 with `unread` flag computed for req.admin.userId plus
unreadCount; /mark-seen (isAdmin): $addToSet seenBy for current admin only; try/catch both.
NotificationSection: show unread badge from unreadCount, list latest 20, "Mark all read".
Header: remove SearchSection if it has no real handler; ProfileSection: replace hardcoded
"Good Morning" with time-based greeting and remove UpgradePlanCard (external personal link).
```
**🔍 Test Prompt**
```
Bug-hunt: curl /admin/notify without cookie → 401; admin A marks read → admin B still sees unread;
yesterday's notifications still visible. Report.
```
**✅ Done when:** notifications are private and tracked per admin.

### 🧪 Module 16 Gate
```
Two admins logged in (two browsers): place an order on cafeFresco-main → both get the notification;
A marks read → only A's badge clears.
```

---

# Module 17 — Production hardening

### Step 17.1 🔴 Secrets and configuration
**Problem:**
- The Gmail app password is hardcoded ([B/routes/admin.js:257-258](../../cafeFresco-backend/routes/admin.js#L257-L258); also check `users.js` and `config/sendMail.js`).
- The JWT `SECRET_KEY` is a short dictionary word, so tokens can be forged by brute force.
- `.env` files sit in the project folders. Check they are in `.gitignore`.
- `NODE_ENV=localhost` isn't a standard value.
- CORS has hardcoded Vercel URLs.
- `GENERATE_SOURCEMAP` is a CRA variable that Vite ignores.

**Solution:**
- **Rotate** the Gmail app password and the JWT secret (64+ random bytes). All credentials come from env.
- Add a `.env.example` with no real values and gitignore the real `.env`.
- Set `NODE_ENV` to `development` or `production`.
- `CORS_ORIGINS` becomes a comma-separated env variable.
- Validate required env vars at startup (fail fast).

**🛠 Fix Prompt**
```
Backend: grep for hardcoded secrets/emails and move to env; create config/env.js that validates
required vars (DB_URI, SECRET_KEY length >= 32, EMAIL, EMAIL_PASSWORD, STRIPE_SECRET_KEY,
CLIENT/EMAIL URLs, CORS_ORIGINS) and exits with a clear message; app.js uses CORS_ORIGINS.
Create .env.example for backend and dashboard; ensure .gitignore contains .env in each project.
Set NODE_ENV=development locally. Remove GENERATE_SOURCEMAP from dashboard .env and set
build.sourcemap false in vite config if needed. Tell me exactly which secrets I must rotate.
```
**🔍 Test Prompt**
```
Bug-hunt: grep -ri "pass:\|sk_test_\|sk_live_\|@gmail.com" in source (exclude .env, node_modules)
→ none; start backend with SECRET_KEY missing → clear exit message; disallowed origin → CORS error.
```
**✅ Done when:** no secrets in code · leaked credentials rotated · the server fails fast on bad config.

---

### Step 17.2 🟠 Server robustness
**Problem:**
- The server starts listening before the DB is connected, so requests during startup hang ([B/app.js:83-92](../../cafeFresco-backend/app.js#L83-L92)).
- There is no global error handler. Multer errors and invalid JSON return HTML stack traces.
- Many handlers return `error: error.message` or the raw error object, which leaks internals.
- There is no security-header middleware (`helmet`) and no general rate limit.
- `trust proxy` is set and followed by a stray backtick literal.
- Uploads allow 1 MB while the comment says 5 MB, and webp isn't allowed.
- `mongoose.set('strictPopulate', false)` hides populate typos.
- Static images are served twice: globally and inside each router.

**Solution:**
- Connect to the DB first, then listen.
- Add a central error handler that logs details server-side and returns `{message}` (details only in development).
- Add helmet and a general rate limiter.
- Strip error internals from responses in production.
- Make the upload limit configurable (2 MB, jpeg/png/webp).
- Remove the duplicate static mounts.

**🛠 Fix Prompt**
```
app.js: await connectDB() then app.listen; add helmet(), express.json({limit:'1mb'}), global
rate limiter (300 req/15min/IP) excluding static; 404 JSON handler; central error middleware
(multer errors → 400, SyntaxError JSON → 400, CastError → 400, default 500) that hides
err.message unless NODE_ENV==='development'. Remove the stray `` after trust proxy.
multer.js: limit from env UPLOAD_MAX_MB default 2, allow webp, fix comment. Remove
router.use('/images/...') duplicates in products.js and users.js if app-level static covers them.
Replace `error: error.message` / `error` in responses with central handling (next(err)).
```
**🔍 Test Prompt**
```
Bug-hunt: send malformed JSON → 400 JSON; upload 3MB → 400 clear message; GET /product/abc →
400; production mode responses never include stack/message internals; images still load in
both frontends. Report.
```
**✅ Done when:** every error comes back as clean JSON · startup is ordered.

> ⚖️ **Shared with main-site Step 14.3** (same work, do it once). Before removing `error` from responses, grep both frontends for `data.error` / `errorData.error` reads and switch them to `data.message`. Empty lists return 200 `[]` (SHARED D8).
>
> ⚠️ **Addendum (SHARED D11): uploads don't persist on Vercel.** The backend deploys as a Vercel serverless function, so files written to `public/images/*` disappear on redeploy or cold start, and the product and category images break in production. Inside `middleware/multer.js`, switch storage to Cloudinary or S3 (env `CLOUDINARY_URL` or S3 keys) and store the full URL in `image`. Update both frontends so they render `image` as-is when it starts with `http` and otherwise prefix `BASE_URL`, for old local images. This is a storage change inside the existing upload middleware, not a new module.

---

### Step 17.3 ⚪ Template leftovers and code hygiene
**Problem:**
- Berry template remnants remain: Utilities pages, `sample-page`, `Customization` drawer, `serviceWorker`, `reportWebVitals`, unused `getImageUrl`, the `api/menu.js` naming, the `DASHBOARD_PATH='/sample-page'` config, and "Bajaj" chart names.
- Many unused imports.
- Component names are copy-pasted and wrong (`ProductDashboard` in inventory, `AdAddPage` in categories, a `categoriesPerPage` variable in the discount and supplier pages).
- `console.log` debug output in production paths (category routes, order history, the reset page).
- `bcrypt` and `bcryptjs` are both installed. `crypto` and `path` are installed from npm even though they're Node built-ins. `init` is an unused package.
- There are no automated tests.

**Solution:** Remove the dead code, rename components to match their files, remove debug logs, clean up dependencies, and add a minimal API test suite (Jest + Supertest + mongodb-memory-server) covering the business rules in this document.

**🛠 Fix Prompt**
```
Dashboard: remove unused template files/routes/imports (verify each with grep before deleting),
rename mis-named components, `npm run lint:fix`. Backend: remove console.log debug lines,
uninstall bcrypt (keep bcryptjs if that's what code uses — verify), crypto, path, init npm
packages if unused. Add jest + supertest + mongodb-memory-server dev deps and tests/ covering:
auth (1.x), RBAC matrix R1 (API level), order stock + pricing + transitions (4.x), discount
redemption (9.1), referential deletes (R6). Add "test" script.
```
**🔍 Test Prompt**
```
Bug-hunt: `npm run build` (dashboard) and `npm test` (backend) both pass; the app still works
end to end; list any test that is skipped or flaky.
```
**✅ Done when:** the build is clean · lint is clean · the business-rule tests pass.

### 🧪 Final System Gate
```
Full regression on the local stack (backend :3000, main :3001, dashboard :5173, local MongoDB):
1. Seed admin → create manager + editor.
2. Each role: visit every menu item (matrix R1), hard-refresh each page.
3. Catalog: category → product with image + stock → visible on main site.
4. Customer: register on main site, add to cart, apply discount, place COD + card orders.
5. Admin: stock decreased, totals correct, complete/cancel flows, stock restored on cancel.
6. Dashboard numbers equal a manual Mongo aggregation (R4).
7. Security: every unauthenticated curl to admin/user/order endpoints → 401; no password hashes
   in any response; no secrets in source.
Report a PASS/FAIL table per item with evidence.
```

---

## Appendix A — Findings index

| Step | Severity | One-line issue |
|---|---|---|
| 1.1 | 🔴 | Public `/admin/register` creates admins |
| 1.2 | 🔴 | JWT in JS cookie; production cookie never reaches API |
| 1.3 | 🟠 | Route guard checks only cookie existence |
| 1.4 | 🟠 | Reset flow enumeration, no password rule, hardcoded Gmail password |
| 2.1 | 🔴 | Hooks after early return → crash on refresh; missing guards |
| 2.2 | 🟠 | Non-admin roles land on AccessDenied after login |
| 2.3 | 🟡 | Menu shows forbidden modules |
| 2.4 | ⚪ | Duplicate/template routes, no 404 |
| 3.1 | 🟠 | Departments/distributors never load after login |
| 3.2 | 🟡 | No API client, swallowed errors, fake loaders |
| 4.1 | 🔴 | Stock never checked/deducted on order |
| 4.2 | 🔴 | Client sets total and payment status |
| 4.3 | 🟠 | No order state machine; cancel doesn't restore stock |
| 4.4 | 🔴 | Payments not verified with Stripe; cross-user paymentId |
| 4.5 | 🔴 | Public order history (IDOR) and stats |
| 4.6 | 🟡 | Order pagination/search broken |
| 5.1 | 🔴 | Uploads before auth |
| 5.2 | 🟠 | Product update mass-assignment, no validators, image leak |
| 5.3 | 🟠 | Product add half-succeeds → duplicates |
| 5.4 | 🟡 | Edit Product loses stock/zero values |
| 5.5 | 🟡 | Double fetch, crash on null category |
| 5.6 | 🟠 | Product hard delete breaks history |
| 6.1 | 🟠 | Stock overwrite races, negatives, can't set 0 |
| 7.1 | 🟠 | Category delete orphans products |
| 7.2 | 🟡 | Category RBAC/UI mismatch, fs.unlink bug |
| 8.1 | 🔴 | Random fake chart data |
| 8.2 | 🟠 | Three revenue definitions |
| 8.3 | 🟡 | Undefined setErrorMessage, loading wrong |
| 9.1 | 🔴 | Discount maxUses/per-user broken, client totals |
| 9.2 | 🟡 | Discount validation, `!x === y` precedence bug |
| 10.1 | 🔴 | Public user search leaks PII + password hashes |
| 10.2 | 🟡 | Users page double role checks, 2 s debounce |
| 11.1 | 🔴 | Self/root/last-admin deletion, hash in response |
| 11.2 | 🟡 | Edit Role dialog submits on close |
| 12.1 | 🔴 | Delete employee calls product delete |
| 12.2 | 🟠 | Edit re-activates employees; breaks on refresh |
| 12.3 | 🟡 | CNIC as Number, pagination wrong |
| 13.1 | 🟠 | Department delete orphans employees |
| 14.1 | 🔴 | Delete supplier calls distributor delete |
| 14.2 | 🟡 | Toggle sends whole document |
| 15.1 | 🟠 | Distributor delete orphans suppliers |
| 16.1 | 🟠 | Public, global notifications |
| 17.1 | 🔴 | Secrets in source, weak JWT secret |
| 17.2 | 🟠 | No error handler, startup order, helmet |
| 17.3 | ⚪ | Template leftovers, no tests |

## Appendix B — Main-site integration (cafeFresco-main)

The backend serves **two clients**: the dashboard (admin, port 5173) and the shop (customer, port 3001). Fixing business rules on the backend is only finished when **both** clients work with the new rules.

### Integration instructions (read before any 🔗 step)

1. **Run all three apps** during integration steps: backend `:3000` (`npx nodemon app.js`), main `:3001` (`npm run dev`), dashboard `:5173` (`npm start`), with local MongoDB running.
2. **Keep two test accounts:** one customer (registered on the shop) and one admin (seeded). Use two browsers, or one normal window and one private window, so the `userToken` and `adminToken` cookies don't mix.
3. **Use Stripe test mode only:** card `4242 4242 4242 4242`, any future date and any CVC. Use card `4000 0000 0000 0002` to test a declined payment.
4. **Order of work inside a 🔗 step:**
   1. Backend change, keeping the old behaviour (compatibility window).
   2. Main-site change.
   3. Run the 🔗 integration test.
   4. Remove the old behaviour in B.6, only after every 🔗 step passes.
5. **Never change both sides blindly.** Each B prompt first asks Claude to **report the current shop code that calls the API**, then change it.
6. **One response shape:** every error is `{ message }`. The shop always shows `data.message` with `toast.error` (never `toast.success`).
7. **Money is displayed, never calculated, by clients.** The shop may show a preview, but the amount charged and stored always comes from the server response.

### API contract changes

| Endpoint | Old request (shop sends today) | New request | New response used by shop |
|---|---|---|---|
⚖️ aligned with [SHARED_DECISIONS.md](../SHARED_DECISIONS.md) D2–D5, D7. If this table and that file ever differ, the file wins.

| Endpoint | Old request (shop sends today) | New request | New response used by shop |
|---|---|---|---|
| `POST /order/create` | `{products, totalAmount, payment}` | `{shippingAddress, discountCode?, paymentMethod:'card'\|'cod'}` + header `Idempotency-Key`. **Lines come from the server cart**; `products`/`totalAmount`/`payment` are ignored until B.6 | `201 {order:{_id,products[snapshot],subtotal,discountAmount,totalAmount,paymentMethod,paymentStatus:'unpaid'}}`; 409 `{message, productId}` (stock / unavailable); 409 `{message}` (code used up); 400 `{message, fields}` |
| `POST /stripe/payment-intent` | `{amount}` (cents, from browser) | `{orderId}`; **one intent per order** (reused on retry) | `{clientSecret, amount}` |
| `POST /stripe/confirm` | — (new) | `{paymentIntentId}` | `{order}` with `paymentStatus:'paid'`; the server sends the email |
| `POST /stripe/payment/create` | card + COD | **deprecated**: COD Payment is created inside `/order/create`; removed in B.6 | — |
| `POST /order/set-transaction/:id` | `{paymentId}` | **deprecated**, removed in B.6 (server links payment itself) | — |
| `POST /discount/apply` | `{code, cartTotal}` | `{code}` (server reads the cart) | `{code, subtotal, discountAmount, total}`; **no longer marks the code as used** |
| `POST /order/send-order-email` | `{orderId, amount, status}` | **deprecated**: the server emails after COD create / card confirm; removed in B.6 | — |
| `POST /order/cancel/:id` | — (new, main-site Step 9.2) | — | customer cancels own `pending`+`unpaid` order |
| `GET /cart/all` | `{cart:[…]}` / 404 when no cart | unchanged request | `{cart:[{…, unitPrice, stock, available, reason}], removedCount}`; 200 `[]` when empty |
| `GET /product/all`, `/featured`, `/new-releases`, `/fetch`, `/:id` | unchanged | `?includeInactive=true` honoured for admins only | inactive products excluded for the shop; stock + discount included |

### New checkout flow (target)

```
CARD                                              COD
1. POST /order/create {shippingAddress,           1. POST /order/create {shippingAddress,
   discountCode, paymentMethod:'card'}               discountCode, paymentMethod:'cod'}
   → order (unpaid, stock reserved, cart cleared)    → order (unpaid, stock reserved, cart
2. POST /stripe/payment-intent {orderId}               cleared) + COD Payment + email — ONE call
   → clientSecret (same intent reused on retry)   2. Refresh cart state, clear discount/address,
3. stripe.confirmCardPayment(clientSecret)           go to /track?order=<id>
   ├─ fails → toast.error, order stays unpaid;
   │          "Retry" repeats 2–3 for the SAME order,
   │          "Cancel" → POST /order/cancel/:id
   └─ ok →
4. POST /stripe/confirm {paymentIntentId} → order paid (server sends the email)
5. Refresh cart state, clear discount/address, go to /track?order=<id>
```

Unpaid card orders that are never paid hold stock. ⚖️ aligned (SHARED D9): the backend runs on **Vercel serverless**, so a `setInterval` won't run reliably. `cancelStaleUnpaidCardOrders()` therefore runs **lazily** at the start of `/order/create`, `/order/fetch`, `/order/user/history` and `/stripe/payment-intent`, at most once per 60 s.
- **It retrieves the Stripe intent first.** If it `succeeded`, it calls `markOrderPaid()` instead of cancelling. That's the case where the customer paid but the confirm call was lost. Cancelling would have restored stock for a paid order.
- `processing` / `requires_action` → skip this time.
- Otherwise it cancels the intent and then `cancelOrder(order, {byType:'system'})`.

---

### B.1 Out-of-stock and error handling in checkout (with Step 4.1)
**🛠 Prompt**
```
First report how cafeFresco-main/src/Components/StripePayment.jsx handles failures from
/order/create. Then: in the catch block replace toast.success(error.message ...) with
toast.error; on a 409 response show the server message and keep the cart unchanged; never
navigate away on failure. Do not change the payment flow yet.
```
**🔗 Integration test prompt**
```
On http://localhost:3001 as a customer: set a product's stock to 1 in the dashboard, add qty 2 to
cart, checkout with COD → red error toast with product name, cart intact, no order in the
dashboard, stock still 1. Then qty 1 → order succeeds, dashboard shows it, stock 0. Report.
```

### B.2 Server-side totals and discount at checkout (with Steps 4.2 and 9.1)
**🛠 Prompt**
```
Report how cart totals are computed in cafeFresco-main (CartPage.jsx, Context/ProductState.jsx,
StripePayment.jsx) and which price field is used (price vs discountedPrice). Then:
⚖️ aligned (SHARED D1, D2, D5) — this prompt is the same work as main-site Steps 4.1, 6.3 and
7.1; if those are done, only verify.
- Cart uses unitPrice (same formula as server, utils/price.js) for display.
- Store the applied discount code string in the product context (appliedCode);
  CartPage handleDiscount sends {code} only and shows subtotal/discountAmount/total from the
  response; when cart items or quantities change KEEP the code and re-run the preview — clear
  it (with the reason) only if the preview fails.
- createOrder sends {shippingAddress, discountCode, paymentMethod:'card'|'cod'} only — no
  products (server reads the cart), no totalAmount, no payment — plus an Idempotency-Key header.
- After order creation, use order.totalAmount from the response for everything that follows
  (display, email, payment); if it differs from the shown preview, show a toast
  "Total updated to X" before charging.
- Handle 409/400 discount errors at order time: show message, clear discount, let user retry.
Keep COD flow working end to end.
```
**🔗 Integration test prompt**
```
On :3001: product with 10% product-discount → cart shows discounted price; apply a 20% code →
preview correct; place COD order → dashboard order total = (discounted subtotal − 20%) to the
cent; code usage count +1 in dashboard; reload cart and apply same code again → rejected
"already used"; apply code then remove an item → code kept, preview recomputed on the new
subtotal (and removed with a reason if minPurchase is no longer met). Tamper: edit request in
DevTools to send totalAmount:1 → server total unchanged. Report.
```

### B.3 New card payment flow (with Step 4.4)
**🛠 Prompt**
```
Rewrite the 'stripe' branch of handleSubmit in cafeFresco-main/src/Components/StripePayment.jsx to
the "New checkout flow (target)" in docs/dashboard/DASHBOARD_AUDIT.md Appendix B:
⚖️ aligned (SHARED D2, D3, D9) — same work as main-site Step 8.1; if done, only verify.
createOrder(paymentMethod 'card') → POST /stripe/payment-intent {orderId} → confirmCardPayment →
POST /stripe/confirm {paymentIntentId} → refresh cart → navigate /track?order=<id>.
The server sends the email; remove sendOrderEmail, createPayment and setTransactionId from BOTH
paths. COD = one /order/create call. If confirmCardPayment fails, keep the created order id in
state so pressing Pay again reuses the SAME order AND the same intent (the backend returns the
existing intent) — never a second order; also offer "Cancel order" (POST /order/cancel/:id).
Disable the Pay button while processing (prevent double charge). Show amount from the server
order. Implement cancelStaleUnpaidCardOrders() lazily as SHARED D9 (no setInterval; check the
Stripe intent before cancelling; reuse orderService.cancelOrder).
```
**🔗 Integration test prompt**
```
On :3001: (1) card 4242… → one order, paid, one Payment record, stock reduced, dashboard shows
paid; (2) card 4000 0000 0000 0002 (declined) → error toast, order exists unpaid, retry with
4242 → same order becomes paid (no second order); (3) double-click Pay → one charge, one order;
(4) leave an unpaid card order 30+ min (set STALE_CARD_ORDER_MIN=1 temporarily) → after the next
order/fetch request it is auto-cancelled, stock restored, code released; (4b) pay with 4242 but
block the /stripe/confirm request in DevTools → after the stale window the order becomes PAID
(not cancelled); (5) COD = exactly one network request and still works. Check Stripe test dashboard: exactly one successful charge
per paid order. Report.
```

### B.4 Order tracking uses the customer's own history (with Step 4.5)
**🛠 Prompt**
```
Report which endpoint cafeFresco-main/src/Components/Track.jsx (and any other file) uses to show
customer orders. If it uses /order/history/:userId switch it to /order/user/history. Show
order status, payment status and the snapshot line items/prices (Step 4.2 fields, fallback
for legacy orders). Use the server totalAmount.
```
**🔗 Integration test prompt**
```
Customer A sees only A's orders; logged out → redirected/blocked; curl /order/history/<A id>
without admin cookie → 401. A cancelled order shows "cancelled". Report.
```

### B.5 Unavailable products in the cart (with Step 5.6)
**🛠 Prompt**
```
Backend: /order/create rejects inactive products with 409 {message:"<title> is no longer
available", productId}; GET cart marks items whose product is inactive or deleted with
available:false (inspect routes/cart.js). Main site CartPage: show unavailable items greyed
with "No longer available" and a remove button, exclude them from totals, block checkout
while present.
```
**🔗 Integration test prompt**
```
Add product to cart on :3001 → deactivate it in dashboard → reload cart: item marked
unavailable, total excludes it, checkout blocked until removed; shop listings no longer show it.
```

### B.6 Close the compatibility window (after all 🔗 steps pass)
**🛠 Prompt**
```
Remove deprecated backend behaviour now that cafeFresco-main uses the new contract:
(SHARED D4) /stripe/payment-intent {amount} support, /order/set-transaction route, the whole
/stripe/payment/create route, the whole /order/send-order-email route, cartTotal handling in
/discount/apply, acceptance of products/totalAmount/payment in /order/create (now 400), the
"missing shippingAddress allowed" compat rule, GET /admin/logout alias. grep cafeFresco-main and cafeFresco-dashboard
first and report any remaining caller — do not remove anything still called.
```
**🔗 Integration test prompt**
```
Run the Final System Gate customer flows again (COD, card success, card decline + retry,
discount, out of stock, unavailable product, order tracking) on :3001 with the dashboard open
on :5173. Every flow PASS = integration complete.
```
