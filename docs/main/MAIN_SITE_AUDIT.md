# Cafe Fresco Main Site (Storefront): Deep Audit & Fix Plan

**Scope:** `cafeFresco-main` (the customer website, every page and component) plus each `cafeFresco-backend` route it calls. Most business gaps sit between the two.
**Goal:** a working, production-level system. **No new modules.** Only fix what exists. Where a fix needs a field or endpoint, it goes inside an existing model or route file.
**Method:** static review of every file in `cafeFresco-main/src` and the backend routes it uses, plus an import-casing check. Every finding has a file and line reference so it can be checked.
**Date:** 2026-10-27
**Companion:** [docs/dashboard/DASHBOARD_AUDIT.md](../dashboard/DASHBOARD_AUDIT.md). Some backend fixes (orders, payments, discount codes) are shared. When a step says **"Shared with Dashboard Step X"**, do the backend part once. If it is already done, run only the main-site part.

> ⚖️ **Single source of truth:** [docs/SHARED_DECISIONS.md](../SHARED_DECISIONS.md) holds the backend contract both audits use: order/checkout API, money formula, discounts, cancel, product availability, errors, auth and rate limits, plus **the master sequence across both audits**. **If any step here contradicts it, SHARED_DECISIONS wins.** Paste its 🤖 instruction in front of every fix prompt. Steps changed to match it are marked **⚖️ aligned**. Local ports: backend `:3000`, dashboard `:5173`, shop `:3001`.

---

## How to use this document

Work **one module at a time, in the order below**. Within a module, work **one step at a time**:

```
Step N
 ├─ 1. Read the Problem and the 🧭 Scope line
 ├─ 2. Paste  🤖 AGENT RULES (once per session)  +  the step's 🤖 Cross-project instruction (if any)
 │        +  the 🛠 Fix Prompt          → Claude applies the fix in EVERY project listed in Scope
 ├─ 3. Run the  🔍 Test Prompt  → Claude hunts for bugs in the fix (and fixes what it finds)
 │        For cross-project steps, also run 🧪 D-SMOKE (below)
 ├─ 4. Check the ✅ Done-when list by hand in the browser (storefront AND dashboard if in Scope)
 └─ 5. Only then move to Step N+1
After the last step of a module → run the module's 🧪 Module Gate prompt + 🧪 D-SMOKE → next module
```

### 🧭 Scope lines
Every step starts with a scope line: **Main** = `cafeFresco-main`, **Backend** = `cafeFresco-backend`, **Dashboard** = `cafeFresco-dashboard`.
- ✅ = this step changes code in that project.
- 🔎 = no code change is expected, but the agent must **verify** that project still works, because it uses the changed endpoint, model or middleware.
- — = not affected.

**No step is "main only" when it needs backend or dashboard work.** Those parts are written into the step's 🤖 Cross-project instruction, and the step isn't done until all of them are done.

### 🤖 AGENT RULES (paste once at the start of every work session)
```
You are fixing the Cafe Fresco system: cafeFresco-main (customer site), cafeFresco-backend
(Express API used by BOTH frontends) and cafeFresco-dashboard (admin panel). Rules:
1. Before changing any backend route, model, middleware or response shape, grep BOTH
   cafeFresco-main/src and cafeFresco-dashboard/src for every caller of it, and list them.
2. If a caller in either frontend depends on what you change, update that caller IN THE SAME
   STEP so neither frontend breaks. Never leave one frontend broken "for a later step".
3. Prefer backward-compatible response changes (add fields, don't rename/remove) unless the
   step says otherwise. If you must remove/rename, update all callers.
4. Shared logic (price formula, password rules, mail transporter, stock restore, discount
   validation, cookie options) lives ONCE in the backend (cafeFresco-backend/utils or services)
   and is imported everywhere — never copy-paste it into two routes.
5. Model changes: new fields optional or defaulted so old documents still load; if existing
   data must change type/format, write a one-off script in cafeFresco-backend/scripts/ and
   tell me to run it — do not run destructive DB changes yourself.
6. Check docs/dashboard/DASHBOARD_AUDIT.md for a step covering the same backend code. If it's
   already done, build on it; if not, implement the shared part as written there and tell me
   which dashboard step is now (partly) done.
7. At the end, report: files changed per project, callers checked, anything left for me.
8. docs/SHARED_DECISIONS.md overrides any step text in either audit. Use its "Shared code
   locations" modules (utils/cookies, utils/validation, utils/price, config/mailer,
   services/orderService, discountService, inventoryService, middleware/optionalAdmin).
   Deprecated endpoints are removed only in Dashboard Appendix B.6, never earlier.
```

### 🧪 D-SMOKE: dashboard smoke check (run after every cross-project step and every module gate)
```
First run the Three-project smoke test S1–S6 from docs/dashboard/DASHBOARD_AUDIT.md
(backend :3000, dashboard :5173, shop :3001). Then the extra dashboard page checks:
Dashboard smoke test after the last change. Start backend + dashboard. As an admin: log in;
open Dashboard home, Products list (filter/search/paginate), Edit Product (load + save),
Inventory (update stock), Orders (list, filter, view modal, update status), Users (search,
order history modal), Discount codes (list, create, edit); log out. Report each as PASS/FAIL
with any console or network error. Fix any FAIL caused by this step before continuing.
```

Severity tags: **🔴 Critical** (security hole, money or data loss, broken core flow, broken production build) · **🟠 High** (wrong business result) · **🟡 Medium** (broken UX, inconsistent logic) · **⚪ Low** (cleanup).

Paths are relative to the `FYP/` root. `M/` = `cafeFresco-main/src/`, `B/` = `cafeFresco-backend/`.

---

## Customer business rules this plan enforces (decide once, apply everywhere)

These sit next to the dashboard rules (R1–R6 in the dashboard audit). The storefront must follow **R2 (order lifecycle), R3 (payment), R5 (server computes prices)** from there, plus:

### C1. Session
- The login cookie is **httpOnly**. JavaScript never reads it.
- The frontend learns who is logged in only from `GET /user/me`.
- Logout is a server call that clears the cookie. It also clears the cart, wishlist and discount from memory.

### C2. Page access
| Page | Guest | Logged-in customer |
|---|---|---|
| `/`, `/products`, `/product/:id`, `/about`, `/contact` | ✅ | ✅ |
| `/login`, `/signup`, `/forgot`, `/user/reset-password/:token` | ✅ | redirect to `/` (except reset) |
| `/cart`, `/wishlist`, `/track`, `/user/profile` | redirect to `/login?next=…` | ✅ |
| `/address` | redirect to `/login?next=…` | ✅ only if cart is not empty, otherwise redirect to `/cart` |
| `/payment` | redirect to `/login?next=…` | ✅ only with a valid address from `/address`, otherwise redirect to `/address` |

### C3. Price shown = price charged
The customer always sees `unitPrice = price × (1 − discount/100)`, rounded to 2 decimals, on every card, the detail page, the cart and checkout. The server uses the **same formula** when it creates the order (Dashboard R5).

### C4. Stock
- A product with `quantityInStock = 0` shows **Out of stock**, and its "Add to cart" is disabled.
- The cart never holds more than the available stock. The server enforces this; the UI only reflects it.

### C5. Checkout order of operations
1. **Create the order first.** The server computes the total, takes the stock and records the shipping address. The order starts `pending` and `unpaid`.
2. **Card:** create a PaymentIntent for **that order**, confirm the card, and the server verifies with Stripe before marking the order `paid`.
3. **COD:** the order stays `unpaid` until an admin marks it paid (Dashboard R3).
4. **If card payment fails or is abandoned:** the customer can retry or cancel. Cancelling returns the stock.
5. **The server sends the confirmation email**, never the browser.

### C6. Reviews
Only a customer with a **completed** order containing the product may review it, once per product. A rating from 1 to 5 is required. Public review lists show the reviewer's **first name only**, never their email.

### C7. Customer cancel
A customer may cancel their own order only while it is `pending` **and** `unpaid`. Anything else goes through the shop (Contact page).

---

## Module order

| # | Module | Why this position |
|---|---|---|
| 0 | Build & production baseline | The production build is currently broken; nothing else can ship |
| 1 | Authentication & Session | Login doesn't work in production; every customer feature depends on it |
| 2 | Routing, Guards & Redirects | Every page's access depends on Module 1 |
| 3 | Global state (ProductState context) | Cart, wishlist and discount state feed every page |
| 4 | Product catalog (Home, Products, ProductItem) | Prices and stock shown to customers |
| 5 | Product detail & Reviews | Broken deep links, broken review logic |
| 6 | Cart & Discount code | Quantity and money rules |
| 7 | Checkout: Delivery address | The address never reaches the order |
| 8 | Checkout: Payment & order placement | Core money flow; most critical gaps |
| 9 | Order tracking (Track) | Customer's view of the order lifecycle |
| 10 | Wishlist | Crashes and stale counts |
| 11 | User profile | Fake data, no edit |
| 12 | Contact form | Spam relay, wrong feedback |
| 13 | Layout, content & responsiveness | Placeholder content, mobile layout |
| 14 | Production hardening | Secrets, logging, dead endpoints |

---

# Module 0 — Build & production baseline

### Step 0.1 🔴 The production build fails on Vercel because of an import's letter case
> 🧭 **Scope:** Main ✅ · Backend — · Dashboard 🔎 (the dashboard also deploys to Vercel/Linux, so run the same case check there)
>
> 🤖 **Cross-project instruction:** `Also run the same import-case check against cafeFresco-dashboard/src (copy the script there, or make it accept a path). Report and fix any mismatches; add the same "check:case" to the dashboard's build script.`

**Problem:** [M/Components/Track.jsx:1](../../cafeFresco-main/src/Components/Track.jsx#L1) imports `./CSS/wishlist.css`, but the file is `CSS/Wishlist.css`. Windows ignores the difference, so it works locally. Vercel builds on Linux, which doesn't, so **the build fails** with "Could not resolve". A scan of every relative import found only this one, but nothing prevents the next one.
**Solution:** Fix the import. Add a lint rule (`import/no-unresolved` with `caseSensitive`), or a small check script, so the problem is caught on Windows too. Also fix the ESLint setup: `npx eslint src` currently exits with code 2 (a config error), so lint isn't running at all.

**🛠 Fix Prompt**
```
In cafeFresco-main: change the import in src/Components/Track.jsx to './CSS/Wishlist.css'.
Then make `npm run lint` work: run `npx eslint src` and fix the eslint.config.js error it reports
(do not disable rules wholesale). Add a script scripts/check-import-case.js (node, no deps) that
walks src/**/*.{js,jsx}, resolves every relative import (with .js/.jsx fallbacks) and fails if
the on-disk filename casing differs; add "check:case": "node scripts/check-import-case.js" and
make "build" run it first ("build": "npm run check:case && vite build").
Do not change any component logic.
```
**🔍 Test Prompt**
```
Bug-hunt the build baseline: (1) run `npm run check:case` → passes; temporarily rename an import
to wrong case → it fails with file+line, then revert; (2) `npm run build` succeeds; (3)
`npm run lint` runs and prints real findings (list the count per rule, do not fix them now);
(4) grep src for any other import whose casing differs from disk. Report PASS/FAIL per check.
```
**✅ Done when:** `npm run build` passes · casing mistakes fail the build on Windows too · lint runs.

---

### Step 0.2 🟠 Environment and deployment config
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅
>
> 🤖 **Cross-project instruction:** `Also check cafeFresco-dashboard/.gitignore ignores .env / .env.* (keep !.env.example) and create cafeFresco-dashboard/.env.example with its VITE_* keys (empty). In the backend's .env.example add the keys later steps introduce: CONTACT_TO, VPNAPI_KEY, VPN_CHECK, STRIPE_WEBHOOK_SECRET, CURRENCY.`

**Problem:**
- `cafeFresco-main/.gitignore` doesn't list `.env`. The backend has **no `.gitignore` at all**, and its `.env` holds `DB_URI`, `SECRET_KEY`, `STRIPE_SECRET_KEY` and the email password.
- [index.html:6](../../cafeFresco-main/index.html#L6) points the favicon at `/vite.svg`, which doesn't exist. `logo.ico` sits unused in the project root.
- `index.html` loads **two Font Awesome versions** (5.15.4 and 6.0.0), bootstrap-icons, and the **MDB UI kit JS**. MDB is heavy, conflicts with Bootstrap 5's JS, and nothing in the code needs it: the `data-mdb-*` attributes in `Address.jsx` are decorative.
- Nothing documents the required `VITE_BASE_URL` and `VITE_STRIPE_KEY`.

**Solution:** Ignore `.env` in both projects and add a `.env.example` to each. Fix the favicon. Load one Font Awesome version, and drop MDB once you've confirmed nothing depends on it.

**🛠 Fix Prompt**
```
1) cafeFresco-main/.gitignore: add .env and .env.*, but keep !.env.example. Create
   cafeFresco-main/.env.example with VITE_BASE_URL= and VITE_STRIPE_KEY= (empty, with a comment
   that the Stripe key must be the publishable pk_ key).
2) Create cafeFresco-backend/.gitignore (node_modules, .env, .env.*, !.env.example, logs, *.log)
   and cafeFresco-backend/.env.example listing every key from .env with EMPTY values.
3) index.html: move logo.ico to public/ and use <link rel="icon" href="/logo.ico">. Remove the
   Font Awesome 5.15.4 link and keep 6.x only. Grep src for "fa-" icon names that only exist in
   v5 and list them. Remove the MDB script tag after grepping src for "mdb" / "data-mdb"; remove
   those data-mdb-* attributes too, since they have no effect without MDB.
Do not touch any secrets' values.
```
**🔍 Test Prompt**
```
Bug-hunt: (1) `git check-ignore` (or read the .gitignore rules) confirms .env is ignored in both
projects and .env.example is not; (2) the .env.example files contain no real values; (3) run the
site and open Home, Cart, Product detail, Payment: every icon still renders (list any icon that
became a blank square and fix it with the v6 name); (4) the favicon shows; (5) the browser
console has no 404 for static assets. Report PASS/FAIL.
```
**✅ Done when:** secrets can't be committed · no missing assets · one icon library.

### 🧪 Module 0 Gate
```
Run `npm run build` and `npm run check:case` in cafeFresco-main, and `node -e "require('./app')"`
style syntax check (or `node --check app.js`) in cafeFresco-backend. All three must pass. Report.
```

---

# Module 1 — Authentication & Session

### Step 1.1 🔴 Login doesn't work in production, and the token is exposed to JavaScript
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard 🔎
>
> 🤖 **Cross-project instruction:** `Put cookie options in cafeFresco-backend/utils/cookies.js exporting userCookieOptions() and (for Dashboard Step 1.2) adminCookieOptions(); use them in users.js. Do NOT change admin cookie behaviour unless Dashboard Step 1.2 is being done now. Verify middleware/isLogged.js reads only userToken and isAdmin reads only adminToken, so the two sessions never mix. Confirm the backend CORS origins (CORS_ORIGINS env after Dashboard 17.1, otherwise allowedOrigins in app.js:31) contain the real production storefront URL and http://localhost:3001; if not, tell me. Then run D-SMOKE (admin login must still work).`

**Problem:**
- The backend sets `userToken` with **`httpOnly: false`** and also returns it in the JSON body ([B/routes/users.js:64-77](../../cafeFresco-backend/routes/users.js#L64-L77), [115-125](../../cafeFresco-backend/routes/users.js#L115-L125)). Any XSS can steal it.
- The frontend decides whether you're logged in by **reading the cookie from JavaScript**: `Cookies.get('userToken')` in [M/Context/ProductState.jsx:19](../../cafeFresco-main/src/Context/ProductState.jsx#L19) and [M/Components/Navbar.jsx:25](../../cafeFresco-main/src/Components/Navbar.jsx#L25), and `document.cookie.includes("userToken")` in [M/Components/ProductItem.jsx:108](../../cafeFresco-main/src/Components/ProductItem.jsx#L108).
- In production the API (`*.vercel.app` backend) and the storefront (`cafe-fresco-main.vercel.app`) are **different domains**. The cookie belongs to the API domain, so the storefront's JavaScript **can never see it**. As a result:
  - the Navbar always shows "Login / Sign Up", even after a successful login;
  - the cart and wishlist never load on page start;
  - the cart icon on every product card says **"Please login first"** to logged-in users.
- Locally this works only by accident: cookies ignore ports, so `localhost` is shared.
- [Navbar.jsx:26](../../cafeFresco-main/src/Components/Navbar.jsx#L26) logs the token to the console.

**Solution:**
- Make the cookie `httpOnly: true`, with `sameSite: 'none'` and `secure` in production. Stop returning the token in the body.
- Add `GET /user/me` (isLogged), which returns `{ _id, name, email, phone, address }` from the DB.
- In `ProductState`, keep `user` and `authStatus` (`'loading' | 'authenticated' | 'anonymous'`), loaded from `/user/me` on start and after login or signup.
- Every "am I logged in?" check uses `authStatus`.

**🛠 Fix Prompt**
```
Backend (cafeFresco-backend/routes/users.js):
- Add one helper userCookieOptions() → { httpOnly:true, secure: NODE_ENV==='production',
  sameSite: NODE_ENV==='production' ? 'none' : 'lax', maxAge: 15*24*60*60*1000, path:'/' }.
  Use it in /register and /login. Remove `userToken` from both JSON responses (keep message,
  and return user {name,email}).
- Add GET /user/me (isLogged): load user by req.user.userId selecting name email phone address;
  404→ respond 401 {message:'Session expired'} and clear the cookie; else { user }.
- Make sure CORS has credentials:true (it does) — no change needed there.
Frontend (cafeFresco-main):
- ProductState.jsx: remove js-cookie. Add state user (null) and authStatus ('loading').
  Add refreshSession(): GET /user/me with credentials:'include' → on 200 set user +
  'authenticated' and then load cart and wishlist; on 401 set user null, 'anonymous', and
  clear cart/wishlist state. Call refreshSession() once on mount (instead of the token check).
  Expose user, authStatus, refreshSession in the context value.
- Navbar.jsx: remove js-cookie and the console.log; use authStatus/user from context to choose
  which dropdown to show; show the user's first name in the dropdown header.
- ProductItem.jsx: replace document.cookie check with authStatus === 'authenticated'; if
  anonymous, navigate to /login?next=<current path> after the toast.
- LoginPage.jsx and Signup.jsx: after res.ok, `await refreshSession()` before navigating.
- Remove the js-cookie dependency from package.json if nothing else imports it.
```
**🔍 Test Prompt**
```
Bug-hunt the session change with the backend on a DIFFERENT host than the frontend if possible
(e.g. frontend on localhost:5173, backend reached via 127.0.0.1:<port> in VITE_BASE_URL) to mimic
cross-site: (1) after login, document.cookie does NOT contain userToken, yet /user/me returns the
user; (2) Navbar shows the logged-in menu immediately after login without reload; (3) hard reload
keeps the logged-in state; (4) product-card cart icon adds to cart when logged in, redirects
to login when not; (5) grep cafeFresco-main for "js-cookie", "Cookies.", "document.cookie",
"userToken" — list any remaining; (6) login JSON body contains no token. Report PASS/FAIL.
```
**✅ Done when:** no JS-visible token · the logged-in UI works across domains · the state survives a reload.

---

### Step 1.2 🔴 Logout crashes and doesn't log you out
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard — (admin logout is a separate route in admin.js)

**Problem:**
- The Logout button ([Navbar.jsx:206-210](../../cafeFresco-main/src/Components/Navbar.jsx#L206-L210)) calls `Cookies.remove('userToken')`. That can't remove a cookie set by the API's domain (and after Step 1.1, an httpOnly one). **The server session stays alive.**
- It then calls `setWishList(0)`, but `setWishList` **isn't in the context value** ([ProductState.jsx:221](../../cafeFresco-main/src/Context/ProductState.jsx#L221)). It's `undefined`, so the click throws a `TypeError`.
- The backend `POST /user/logout` clears a cookie called `'token'`, not `'userToken'` ([B/routes/users.js:135](../../cafeFresco-backend/routes/users.js#L135)). Nothing calls it anyway.
- The cart, wishlist count and applied discount stay in memory. **The next person to log in on the same browser sees the previous user's cart** until a reload.

**Solution:** Server logout clears `userToken` with the same options. The context gets a `logout()` that calls it and resets every piece of user state. The Navbar uses it.

**🛠 Fix Prompt**
```
Backend users.js POST /logout: res.clearCookie('userToken', userCookieOptions() without maxAge);
return 200. Frontend ProductState.jsx: add logout(): POST /user/logout with credentials, then
(regardless of result) setUser(null), setAuthStatus('anonymous'), setCart([]), setWishList(0),
setTotalPrice(0), setOriginalTotal(0), setDiscountApplied(false), clear any applied discount
code state. Expose logout. Navbar.jsx: Logout button calls `await logout()` then
navigate('/login', { replace:true }); close the dropdown. Remove the direct setWishList call.
```
**🔍 Test Prompt**
```
Bug-hunt logout: (1) click Logout → no console error; (2) afterwards GET /user/me → 401 and
/cart redirects to login (after Module 2) or shows nothing of the old user; (3) log in as user A,
add items, logout, log in as user B in the same tab → B never sees A's cart, wishlist count or
discount; (4) browser Back after logout doesn't show A's profile data from memory. Report.
```
**✅ Done when:** logout ends the server session · no state leaks between accounts · no crash.

---

### Step 1.3 🟠 Login page logic
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅ (the limiter is shared)
>
> ⚠️ **Extra finding:** customer login and admin login use the **same `loginLimiter` instance** ([B/routes/users.js:86](../../cafeFresco-backend/routes/users.js#L86), [B/routes/admin.js:72](../../cafeFresco-backend/routes/admin.js#L72)). They share one counter per IP, so 5 failed **customer** logins from the café's own network **lock the admins out** of the dashboard too, and the other way round.
>
> 🤖 **Cross-project instruction:** `Turn middleware/loginLimiter.js into a factory createLoginLimiter({max, windowMs, keyPrefix}) and create two separate instances: userLoginLimiter (users.js /login) and adminLoginLimiter (admin.js /login), both with skipSuccessfulRequests:true. Keep the 429 JSON shape {success:false,message}. Check cafeFresco-dashboard AuthLogin.jsx shows the 429 message correctly and fix it if it matches on a message string. Run D-SMOKE plus: 5 bad customer logins → the admin can still log in.`

**Problem:** ([M/Components/LoginPage.jsx](../../cafeFresco-main/src/Components/LoginPage.jsx))
- **Enter doesn't submit.** The form has no submit button and no `onSubmit`.
- The button isn't disabled while a request is running, so double-clicks send several requests, and each one counts toward the **5-per-15-minutes** rate limit ([B/middleware/loginLimiter.js:5](../../cafeFresco-backend/middleware/loginLimiter.js#L5)).
- The limiter also counts **successful** logins.
- The page always goes to `/` after login. It never returns to the page that sent you to log in.
- The VPN check compares `data.vpnSuccess === true`, but the backend sends the **string** `'true'` ([B/middleware/vpnDetect.js:29](../../cafeFresco-backend/middleware/vpnDetect.js#L29)), so it never matches.
- The backend says "Email not found" vs "Invalid credentials" ([users.js:99,108](../../cafeFresco-backend/routes/users.js#L99)). That tells an attacker which emails have accounts (**user enumeration**).
- The "Remember me" checkbox and the Facebook / Twitter / LinkedIn buttons do nothing.
- `document.body.style.overflow = 'hidden'` on desktop means **short screens can't scroll to the Login button**. The same applies on Signup, Forgot and Reset.
- A logged-in user can still open `/login`.

**Solution:**
- Use a real `<form onSubmit>`. Disable the button while submitting.
- Set `skipSuccessfulRequests: true` on the limiter. Return one generic "Invalid email or password".
- Make the VPN flag a real boolean on the backend and check `res.status === 403` on the frontend.
- Return to `?next=` after login.
- Remove the fake controls and the overflow lock.

**🛠 Fix Prompt**
```
Backend: loginLimiter add skipSuccessfulRequests:true. users.js /login: normalise email
(trim().toLowerCase()); for both "not found" and "wrong password" return 401
{message:'Invalid email or password'}. vpnDetect.js: send vpnBlocked:true (boolean) on the 403
responses and drop the string 'true'/'false' flags.
Frontend LoginPage.jsx: wrap inputs in <form onSubmit={e=>{e.preventDefault();handleLogin()}}>,
button type="submit", add `submitting` state to disable the button and show a spinner; validate
email and non-empty password before calling the API. Use res.status (429 → countdown,
403 + vpnBlocked → VPN message) instead of matching message strings. On success:
await refreshSession(); navigate to a safe `next` query param (only allow paths starting with
"/" and not "//"), default "/". Remove the Remember-me checkbox and the three social buttons +
"Or" divider. Remove the body overflow lock effect. If authStatus==='authenticated' on mount,
navigate to next or "/" with replace. Remove console.log(data).
```
**🔍 Test Prompt**
```
Bug-hunt login: Enter key submits; double-click sends one request; wrong email and wrong
password show the same message; 5 failed attempts → countdown, while successful logins don't
consume the limit; open /cart logged-out → login → lands back on /cart; next=//evil.com and
next=https://evil.com are ignored; logged-in user visiting /login is redirected; page scrolls on
a 600px-high window. Report PASS/FAIL.
```
**✅ Done when:** standard login behaviour · no user enumeration · returns you to where you were.

---

### Step 1.4 🟠 Signup logic
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard —
>
> 🤖 **Cross-project instruction:** `Put validatePassword() and normalizeEmail() in cafeFresco-backend/utils/validation.js. Step 1.5 and Dashboard Step 1.4 (admin reset) import the same helpers.`

**Problem:** ([M/Components/Signup.jsx](../../cafeFresco-main/src/Components/Signup.jsx), [B/routes/users.js:21](../../cafeFresco-backend/routes/users.js#L21))
- There's no confirm-password field. The password rule is only **5 characters**.
- The name isn't validated on the server: a name of spaces passes.
- The duplicate check runs `findOne({ email })` on the raw input, while the schema lowercases the email on save. Make normalisation explicit so `Test@x.com` and `test@x.com` can't fail differently (one says "exists", the other hits the unique index and returns 500).
- The frontend's `catch` shows no message, so a network error looks like nothing happened.
- There's no loading state, and Enter doesn't submit.
- After signup the UI doesn't know you're logged in (fixed by Step 1.1's `refreshSession`).
- The fake social buttons and Remember-me are here too.
- A VPN-API outage **blocks every signup** (see Step 14.2).

**Solution:** Server-side rules: trimmed name of at least 2 characters, a normalised email, and a password of at least 8 characters containing a letter and a digit. Catch the duplicate-key error and return a clean 409. The frontend adds confirm-password, inline errors, a loading state and a real form.

**🛠 Fix Prompt**
```
Backend users.js /register: trim name (>=2 chars), email = trim().toLowerCase(), password >= 8
with at least one letter and one digit; duplicate → 409 {message:'An account with this email
already exists'}; also catch Mongo E11000 → same 409. Use userCookieOptions().
Frontend Signup.jsx: real <form onSubmit>, add Confirm Password field, client-side checks that
mirror the server rules with inline messages, `submitting` state, toast on network error, on
success await refreshSession() then navigate to safe `next` or "/". Remove the social buttons,
Remember-me and the body overflow lock. Fix label htmlFor values to match input ids.
Redirect authenticated users away from /signup.
```
**🔍 Test Prompt**
```
Bug-hunt signup: Test@X.com then test@x.com → second gets 409 (not 500); "   " name rejected;
"abcdefgh" rejected, "abcd1234" accepted; mismatched confirm blocked client-side; network off →
error toast; after success Navbar shows the logged-in menu. Report.
```
**✅ Done when:** clean validation on both sides · no 500s for user input mistakes.

---

### Step 1.5 🔴 Forgot / reset password
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅ (admin forgot/reset uses a third hard-coded transporter)
>
> 🤖 **Cross-project instruction:** `There are THREE transporters: users.js:201, admin.js:251 and config/sendMail.js. Replace all three with the single transporter from config/mailer.js (admin.js too). Apply the same "always 200" response and rate limit to the admin forgot-password route (Dashboard Step 1.4), and make sure cafeFresco-dashboard AuthForget.jsx / AuthReset.jsx still show correct messages and redirect to /admin/login after a reset. Test both reset emails (customer + admin) end to end, then run D-SMOKE.`

**Problem:**
- **The mail credentials are hard-coded** in source: a Gmail address plus app password in [B/routes/users.js:207-208](../../cafeFresco-backend/routes/users.js#L207-L208), duplicated in [B/config/sendMail.js:7-8](../../cafeFresco-backend/config/sendMail.js#L7-L8). Anyone with the code can send mail as the shop. **Treat that password as leaked and rotate it.**
- `/forgot-password` returns **404 "User not found"**, which is user enumeration. It has no rate limit, so it can be used to email-bomb a customer. It returns raw `err.message` on failure.
- `/reset-password/:token` doesn't validate `newPassword`. An empty value hashes `undefined` and throws a 500.
- On the frontend [Reset.jsx:17-22](../../cafeFresco-main/src/Components/Reset.jsx#L17-L22) calls `setLoading(true)` **before** the "passwords do not match" return. The button then stays on **"Updating…" forever**.
- After a successful reset the page stays put; it should go to login.
- The [UserProfile.jsx:38](../../cafeFresco-main/src/Components/UserProfile.jsx#L38) "Reset Password" button shows `toast.success('Server Problem, Reload')` for an error.

**Shared with Dashboard Step 1.4**: the same mail transporter and rules. Do the transporter part once.

**Solution:**
- Use one mail transporter from env (`EMAIL`, `EMAIL_PASSWORD`).
- Forgot always answers 200 with "If an account exists, we've sent a link", and gets a rate limit.
- Reset applies the Step 1.4 password rules. On success it clears the session cookie and the frontend redirects to `/login`.

**🛠 Fix Prompt**
```
⚖️ aligned (SHARED D10 + shared code table):
Backend: create config/mailer.js exporting ONE transporter created from process.env.EMAIL and
process.env.EMAIL_PASSWORD (throw at startup with a clear log if missing); config/sendMail.js
keeps sendOrderMail but imports mailer.js; users.js and admin.js import mailer.js and delete
their own hard-coded transporters. Never log or return
err.message to clients (log server-side, respond generic).
/forgot-password: normalise email; add a forgot/reset limiter instance (createLimiter, 5 per
15 min per IP — same as the admin one) on forgot AND reset; ALWAYS return
200 {message:'If an account exists for this email, a reset link has been sent.'}; only send
mail if the user exists. /reset-password/:token: validate newPassword with the same rule as
register (share a validatePassword helper); on success also res.clearCookie('userToken', ...).
Frontend Reset.jsx: validate match + rule BEFORE setLoading(true); real form; on success toast
then navigate('/login', {replace:true}). Forgot.jsx: real form, validate email format, show the
server message, disable while sending. UserProfile.jsx: the "missing email" branch uses
toast.error with a clear message.
Tell me (do not do it) that the Gmail app password must be revoked in the Google account.
```
**🔍 Test Prompt**
```
Bug-hunt reset flow: grep backend for "mi0364919" / "ukfzz" / "pass:" — must be zero hits;
existing and non-existing emails get the identical response; 6th forgot request in an hour →
429; mismatched passwords → button returns to normal; weak password rejected by server; full
flow with a real email ends on /login and old password no longer works; expired token (10 min)
→ clear error. Report.
```
**✅ Done when:** no secrets in code · no enumeration · the reset flow works end to end.

### 🧪 Module 1 Gate
```
Full auth regression on a production-like setup (NODE_ENV=production locally with https if
possible, or the deployed preview): signup → logout → login → refresh → logout → forgot → reset
→ login with new password. Confirm the cookie is httpOnly+Secure+SameSite=None in production and
that no step prints a token or password to the console or network JSON. Report every step.
```

---

# Module 2 — Routing, Guards & Redirects

### Step 2.1 🔴 Private pages have no access control
> 🧭 **Scope:** Main ✅ · Backend 🔎 (every API the private pages call must return 401 without a cookie; the guard is only UX) · Dashboard —
>
> 🤖 **Cross-project instruction:** `For every endpoint the guarded pages call (cart/*, wishlist/*, order/user/history, user/user-info, user/me, stripe/*, discount/apply, order/create), curl it without a cookie and confirm 401. Any that returns data is a backend bug: fix it in this step.`

**Problem:** [M/App.jsx:30-46](../../cafeFresco-main/src/App.jsx#L30-L46) lists every route as public. A guest who opens a private page gets a different broken result on each one:
- `/cart` shows "Your cart is empty".
- `/user/profile` shows **made-up data** ("Bay Area, San Francisco", "(239) 816-9029").
- `/payment` shows a blank invoice with a working "PAY" button.
- `/track` and `/wishlist` redirect only after an error toast.

**Solution:** Add one `RequireAuth` wrapper that uses `authStatus`:
- `loading` shows a spinner;
- `anonymous` sends the user to `/login?next=<path+search>`;
- `authenticated` renders the page.

Add a `GuestOnly` wrapper for `/login`, `/signup` and `/forgot`. Apply rule C2.

**🛠 Fix Prompt**
```
In cafeFresco-main create src/Components/RouteGuards.jsx exporting RequireAuth and GuestOnly
(both read authStatus from productContext; use <Navigate replace>). RequireAuth redirects to
`/login?next=${encodeURIComponent(location.pathname + location.search)}`. GuestOnly redirects
authenticated users to a safe `next` or "/". In App.jsx wrap /cart, /wishlist, /track,
/user/profile, /address, /payment in RequireAuth and /login, /signup, /forgot in GuestOnly.
Leave /user/reset-password/:token public. Remove the per-page 401 → navigate('/login') code in
Track.jsx and Wishlist.jsx only after the guard is in place (keep a 401 handler that calls
refreshSession() in case the session expires mid-visit).
```
**🔍 Test Prompt**
```
Bug-hunt guards: as guest open each private URL directly → login page, then after login you
land on the original URL including query string; as logged-in user open /login, /signup,
/forgot → redirected; during the initial /user/me request no private page flashes content or
redirects prematurely (throttle network to Slow 3G to check). Report a route × state table.
```
**✅ Done when:** the C2 table holds for every route.

---

### Step 2.2 🟠 Product detail works only when you click from a list
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅ (Edit Product calls the same `GET /product/:id`)
>
> 🤖 **Cross-project instruction:** `cafeFresco-dashboard/src/views/pages/product/editProduct.jsx:43 calls GET /product/:id. Keep the response shape identical (only add fields). ⚖️ aligned (SHARED D7): invalid id → 400, missing (or inactive, for the shop) → 404. editProduct must call /product/:id?includeInactive=true with credentials:'include', and show "Product not found" for 400/404 with a Back to products button instead of an empty, saveable form (this is the same as Dashboard Step 5.4's not-found state; do it once). Run D-SMOKE (Edit Product load + save).`

**Problem:**
- [M/Components/ProductDetail.jsx:43-51](../../cafeFresco-main/src/Components/ProductDetail.jsx#L43-L51) takes all product data from `location.state`. Otherwise it **redirects to Home**, so refreshing the page, opening a shared link or a Google result, or opening in a new tab all **dump the customer on the home page**.
- The URL is `/product/:title` ([ProductItem.jsx:26](../../cafeFresco-main/src/Components/ProductItem.jsx#L26)). Titles aren't unique, so two products with the same name share a URL.
- The page shows the price from the click moment, not the current price, and never shows stock.

**Solution:** Change the route to `/product/:id` and fetch `GET /product/:id`, which already exists and populates category and inventory ([B/routes/products.js:260](../../cafeFresco-backend/routes/products.js#L260)). Show a "Product not found" state on 404 or an invalid id.

**🛠 Fix Prompt**
```
App.jsx: route `/product/:id`. ProductItem.jsx handleClick → navigate(`/product/${props.id}`)
with no state. ProductDetail.jsx: read id from useParams, fetch `${BASE_URL}/product/${id}`
on id change, with loading / not-found / error states; build productData from the response
(title, price, discount, description, image, category.title, inventory.quantityInStock).
Remove location.state usage and the navigate('/') fallback. Backend products.js GET /:id:
return 400 for an invalid ObjectId and 404 for a missing or inactive product (SHARED D7); the
page shows "Product not found" for both. Make sure GET /product/fetch and other named
routes are declared BEFORE /:id (they are — keep it that way and add a comment).
```
**🔍 Test Prompt**
```
Bug-hunt: open a product, hard-refresh → same product; paste URL in a new incognito tab → loads;
/product/123 and /product/<valid but missing id> → "Product not found" (no redirect, no crash);
clicking a "Craving more?" product on the detail page switches to that product (id change
re-fetches and scrolls top). Report.
```
**✅ Done when:** every product has a stable, shareable URL.

---

### Step 2.3 🔴 The checkout steps can be skipped, and the address form reloads the page
> 🧭 **Scope:** Main ✅ · Backend — (saving the address on the order is Step 7.1; the redirect target `/track?order=` is finished in Step 9.1) · Dashboard —

**Problem:**
- [M/Components/Address.jsx:30-43](../../cafeFresco-main/src/Components/Address.jsx#L30-L43) `handleSubmit` doesn't call `e.preventDefault()`. React navigates to `/payment`, then **the browser submits the form natively and reloads the page**. That throws away `location.state`, so the payment page shows **no customer name or address**.
- The **"Go back" button is `type="submit"`** ([line 57](../../cafeFresco-main/src/Components/Address.jsx#L57)) and sits inside the same component area. Clicking it is meant to go back; it should never submit.
- `/payment` can be opened directly with no address, and `/address` with an empty cart.
- After a successful order the user is sent to `/cart` ([StripePayment.jsx:111,156](../../cafeFresco-main/src/Components/StripePayment.jsx#L111)) instead of a confirmation or their order.

**Solution:**
- `preventDefault`, validation, and `type="button"` with `navigate(-1)` for Go back.
- Keep the checkout address in context, plus `sessionStorage` so a refresh survives, rather than only in router state.
- Guards per rule C2.
- After an order, go to `/track?order=<id>`, which highlights the new order (Module 9).

**🛠 Fix Prompt**
```
ProductState: add checkoutAddress state + setCheckoutAddress, persisted to sessionStorage
(try/catch around storage) and cleared on logout and after a successful order.
Address.jsx: e.preventDefault(); validate (Module 7 defines fields) before navigating; save to
setCheckoutAddress; navigate('/payment'). "Go back" → type="button" onClick={()=>navigate('/cart')}.
On mount, if cart is empty (after cart has loaded) → navigate('/cart', {replace:true}) with toast.
Payment.jsx: read address from context, not location.state; if missing → navigate('/address',
{replace:true}); if cart empty → '/cart'. After successful order (StripePayment) → clear
checkoutAddress, await getCart(), navigate(`/track?order=${order._id}`, {replace:true}).
```
**🔍 Test Prompt**
```
Bug-hunt checkout navigation: fill address → Payment shows the name/city/address (Network tab
shows no full page reload); refresh /payment → data still there; "Go back" goes to /cart without
submitting; open /payment directly with no address → /address; empty cart → /address and
/payment both bounce to /cart; after a successful order Back button doesn't return to /payment
with a payable form. Report.
```
**✅ Done when:** checkout can only be walked in order · a refresh doesn't lose data.

---

### Step 2.4 🟡 Navigation gaps and dead links
> 🧭 **Scope:** Main ✅ · Backend 🔎 (`/product/fetch?category=<id>` must filter by id; it already does) · Dashboard —

**Problem:**
- There's no 404 route, so an unknown URL renders a page with only the header and footer.
- Clicking a category on Home ([M/Components/Catogories.jsx:12-15](../../cafeFresco-main/src/Components/Catogories.jsx#L12-L15)) uses `category.name`, which is **undefined** (categories have `title`). It navigates to `/products?category=undefined`. The Products page **ignores the query string** and clears `searchTerm` on mount ([ProductPage.jsx:22-25](../../cafeFresco-main/src/Components/ProductPage.jsx#L22-L25)), so **category clicks do nothing**.
- "View All Categories" isn't a link.
- The mobile menu ([Navbar.jsx:241-261](../../cafeFresco-main/src/Components/Navbar.jsx#L241-L261)) has no Wishlist, Track, Profile or Logout, and **always shows Login/Sign Up**, even when you're logged in.
- The social icons and "Visit Our Instagram" link nowhere.

**Solution:**
- Add a `*` route that shows a simple Not Found page with a Home link (part of the router, not a new module).
- The Products page reads `?category=<id>&q=` from the URL and writes filters back to it.
- The category card links to `/products?category=<id>`.
- The mobile menu mirrors the desktop menu and the auth state.
- Social links come from one config constant; if no real URLs exist, hide them.

**🛠 Fix Prompt**
```
App.jsx: add <Route path="*"> rendering a small inline NotFound (heading, Home link).
Catogories.jsx: onClick navigate(`/products?category=${cat._id}`); "View All Categories" →
<Link to="/products">. ProductPage.jsx: use useSearchParams for category (by _id) and q; the
select's option values become category ids ('' for all); search input bound to q; changing
either resets page to 1 and updates the URL (replace). Remove the setSearchTerm('') reset and
the global searchTerm if no longer used elsewhere (grep first).
Navbar mobile menu: show Wishlist always; if authenticated show Track Order, Profile, Logout
(using context logout), else Login/Sign Up. Create src/config/site.js with SOCIAL_LINKS
{facebook,twitter,instagram} (empty strings); render social icons as <a target="_blank"
rel="noopener noreferrer"> only when a URL is set — same for Posts "Visit Our Instagram".
```
**🔍 Test Prompt**
```
Bug-hunt navigation: /does-not-exist → Not Found; Home category click → Products filtered to
that category and the URL is shareable; browser Back restores previous filter; mobile width
375px: menu shows correct items for guest vs logged-in; no anchor in the app has href="#" that
jumps the page to top (grep `href="#"` and list). Report.
```
**✅ Done when:** every visible link goes somewhere real · category filters can be shared by URL.

### 🧪 Module 2 Gate
```
Walk the whole site as guest and as customer at 1440px and 375px. For every link/button in the
Navbar, Footer, Home sections and mobile menu record where it goes. Any dead control, wrong
redirect or flash of protected content is a FAIL — fix and re-run.
```

---

# Module 3 — Global state (ProductState context)

### Step 3.1 🟠 The context keeps stale, dead and inconsistent state
> 🧭 **Scope:** Main ✅ · Backend — · Dashboard —

**Problem:** ([M/Context/ProductState.jsx](../../cafeFresco-main/src/Context/ProductState.jsx))
- `token` is read once at mount (line 19), so cart and wishlist load only if you were logged in **at page start** (fixed by Step 1.1, which makes `refreshSession` the trigger).
- `wishlists` holds a **count** but is initialised to `''` and set to `length || ''`. The Navbar then checks `wishlists.length`, a number's `.length`, which is `undefined`. It works only by accident.
- `Buy` / `addtoBuy` is the "Buy now" path. Its button is commented out ([ProductDetail.jsx:271](../../cafeFresco-main/src/Components/ProductDetail.jsx#L271)), but Payment and StripePayment still branch on it. That branch reads `Buy._id` while products elsewhere use `id`, so it would order an undefined product.
- `addToCart` returns `<Navigate>` from an async function (line 117), which does nothing.
- On a non-401 error, `addToCart` shows `toast.success(result.message)` (line 120) even for failures.
- `getCart` / `getWishlist` don't clear state on 404 ("Cart not found" for new users), so stale data stays.
- `new Audio(...)` is created on **every render**, in both the context and each `ProductItem` ([ProductItem.jsx:18](../../cafeFresco-main/src/Components/ProductItem.jsx#L18)). A ringtone plays on every toast, including errors. That isn't a professional default, and autoplay rules block it until the first click anyway.
- `console.log(data)` on every category fetch.

**Solution:**
- Store `wishlistCount` as a number.
- Remove the dead Buy-now path.
- Add one small `apiFetch` helper that always sends credentials, parses JSON safely, and on 401 calls `refreshSession`.
- Treat a 404 cart or wishlist as empty.
- Create the sound once with `useRef`, behind an `enableSound` constant that defaults to **off**.

**🛠 Fix Prompt**
```
cafeFresco-main:
1) Create src/api.js exporting apiFetch(path, {method, body, ...}) that prefixes VITE_BASE_URL,
   sets credentials:'include' and JSON headers when body is present, parses JSON safely (empty
   body → {}), and returns {ok, status, data}. Use it in ProductState first.
2) ProductState: rename wishlists → wishlistCount (number, default 0) and expose setWishlistCount;
   update Navbar badge to `wishlistCount > 0`. getCart/getWishlist: 404 → treat as empty
   (setCart([]) / count 0); 401 → refreshSession(). addToCart: success → toast.success, non-ok →
   toast.error(data.message), 401 → toast + return {needsLogin:true} (callers navigate);
   remove the <Navigate> return. Remove Buy/addtoBuy everywhere (Payment.jsx, StripePayment.jsx
   isBuyEmpty branches) — cart is the only checkout source. Remove console.log calls.
3) Sound: create a single Audio in a useRef inside ProductState; expose playSound() that does
   nothing unless SOUND_ENABLED (src/config/site.js, default false) and catches play() promise
   rejections. Replace every `ringtone.play()` in the app with playSound(); delete the Audio in
   ProductItem.jsx.
```
**🔍 Test Prompt**
```
Bug-hunt state: grep for "addtoBuy", "Buy.", "wishlists", "ringtone", "new Audio" → only the
single ref remains; brand-new user (no cart/wishlist docs) logs in → no error toasts, badges 0;
add to cart with an invalid product id → error toast (not success); React DevTools Profiler:
typing in Products search doesn't create Audio objects; no console logs on page load. Report.
```
**✅ Done when:** one consistent source for cart and wishlist state · no dead checkout path · no error shown as success.

### 🧪 Module 3 Gate
```
Re-run Module 1 and 2 test prompts quickly (state changes can break them). Then log in, add 3
products, remove 1, add 1 to wishlist, logout, login — badges are correct at every step. Report.
```

---

# Module 4 — Product catalog (Home, Products page, ProductItem)

### Step 4.1 🟠 Customers see one price and are charged another
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅
>
> 🤖 **Cross-project instruction:** `Create cafeFresco-backend/utils/price.js with unitPrice(product) (the same formula as rule C3, round to 2 decimals) and use it in cart.js now and in order.js /create (Dashboard Step 4.2) so there is ONE backend formula; the frontend helper must give identical results. ⚖️ aligned (SHARED D1): in cafeFresco-dashboard allProduct.jsx show three columns, Price / Discount / Final price (exactly Dashboard Step 5.5), so admins see what customers pay. Currency: backend CURRENCY and VITE_CURRENCY in both frontends (default USD); the shop's formatMoney must match the dashboard's src/utils/format.js output. Run D-SMOKE.`

**Problem:**
- Products have a `discount` percentage and a `discountedPrice` virtual ([B/models/product.js:24,62](../../cafeFresco-backend/models/product.js#L24)). The storefront ignores both and shows `price` everywhere: [ProductItem.jsx:93](../../cafeFresco-main/src/Components/ProductItem.jsx#L93), [ProductDetail.jsx:66](../../cafeFresco-main/src/Components/ProductDetail.jsx#L66), [CartPage.jsx:41](../../cafeFresco-main/src/Components/CartPage.jsx#L41), and the Payment summary.
- After Dashboard Step 4.2, the server charges the **discounted** price. Before it, an admin-set discount simply never reaches the customer.
- Either way, the price shown ≠ the price charged.
- `/product/new-releases` and `/product/featured` use `aggregate`, which **drops virtuals**, so `discountedPrice` is missing there even if the frontend looked for it.

**Solution:** One shared frontend helper `unitPrice(product)` that implements rule C3. Show the old price with a strike-through when there's a discount. The backend cart endpoint returns `unitPrice` too, so the cart and the order use the same number.

**🛠 Fix Prompt**
```
cafeFresco-main: create src/utils/price.js with unitPrice({price, discount}) =
round2(price*(1-(discount||0)/100)) and formatMoney(n) → "$12.50" (one currency format used
everywhere; replace every `{x}$` and `$${x}` / box-icon dollar in the app with formatMoney).
ProductItem, ProductDetail, CartPage, Payment: show formatMoney(unitPrice) and, when discount>0,
the original price struck through plus "-N%". Pass discount through from all list components
(ProductPage, flavorProduct, MoreProduct, Wishlist).
Backend: cart.js GET /all add discount to the populate select and return unitPrice per item;
make sure products routes return `discount` (aggregate results include raw fields — fine).
Do not change how the order total is computed here (Module 8 / Dashboard 4.2 own that).
```
**🔍 Test Prompt**
```
Bug-hunt prices: set a product to price 10, discount 15 in the dashboard → card, detail, cart
line, payment summary all show $8.50 with $10.00 struck; discount 0 → no strike; price 9.999
→ shows $10.00 consistently; grep for remaining raw `.price` renders in JSX and list them.
Report.
```
**✅ Done when:** every surface shows the same unit price · it equals what the server will charge.

---

### Step 4.2 🟠 Out-of-stock products can be bought
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard 🔎 (`GET /product/:id` is used by Edit Product)
>
> 🤖 **Cross-project instruction:** `Only ADD fields (inventory.quantityInStock, inStock) to /all, /new-releases, /featured and /:id. Do not remove any field cafeFresco-dashboard editProduct.jsx reads (grep which fields it uses before removing "reviews"; if it uses them, keep them on /:id). Stock is only truly enforced by order creation (Dashboard Step 4.1) and the cart (Step 6.1). If Dashboard 4.1 is not done yet, say so in your report. ⚖️ aligned (SHARED D7): these public routes also filter isActive:true (Dashboard 5.6). If 5.6 is done, add the stock fields without breaking the optionalAdmin + includeInactive behaviour the dashboard relies on. Run D-SMOKE.`

**Problem:**
- `GET /product/all` doesn't populate inventory ([B/routes/products.js:155](../../cafeFresco-backend/routes/products.js#L155)), and neither do `new-releases` or `featured`. The storefront never knows what's in stock.
- Every card and the detail page allow "Add to cart" at any quantity. Only the Wishlist shows a stock badge.
- The server cart also accepts any quantity (Module 6). Today, order creation doesn't check stock at all (Dashboard Step 4.1).

**Solution:** Return `inStock` and `quantityInStock` with every public product payload. Cards show an "Out of stock" badge and disable the cart button. The detail page caps the quantity stepper at the available stock.

**🛠 Fix Prompt**
```
Backend products.js: /all, /new-releases, /featured, /:id all include inventory.quantityInStock
(populate for find; $lookup on 'inventories' for the aggregates) and do NOT expose internal
fields like reviews arrays of ids. cafeFresco-main: ProductItem receives stock; when stock<=0
show an "Out of stock" badge, disable the cart icon (cursor not-allowed, tooltip). ProductDetail:
show "In stock: N" / "Out of stock"; quantity stepper max = stock; Add to cart disabled at 0.
```
**🔍 Test Prompt**
```
Bug-hunt stock display: set stock 0 → card badge + disabled icon, detail button disabled; stock
3 → stepper stops at 3; product with no inventory doc → treated as out of stock, no crash.
Check that the aggregate $lookup doesn't duplicate products. Report.
```
**✅ Done when:** customers can't start buying what isn't in stock.

---

### Step 4.3 🟡 Products page logic
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard 🔎 (Products and Inventory pages use the same `/product/fetch`)
>
> 🤖 **Cross-project instruction:** `GET /product/fetch is also called by cafeFresco-dashboard allProduct.jsx:27 and inventory.jsx:37. Keep its response shape exactly {success,total,page,totalPages,products}. The limit cap of 50 must not drop below what the dashboard requests (check the limit it sends). Regex escaping (utils/validation.js escapeRegex) must not break the dashboard's search box. Keep the ?includeInactive=true (Dashboard 5.6) and ?stock=low|out (Dashboard 6.1) params working; the dashboard pages must send includeInactive=true. Run D-SMOKE (Products + Inventory search/filter/paginate).`

**Problem:** ([M/Components/ProductPage.jsx](../../cafeFresco-main/src/Components/ProductPage.jsx))
- Changing the category doesn't reset the page. On page 3, choosing a small category shows **"No products found"**.
- With 0 results `totalPages` is 0, so "Next" stays enabled and clicking it goes to page 2 of nothing.
- The pagination links use `href="#"`, which jumps to the top.
- The "Search" button does nothing; search is live already.
- It downloads **every product** on each visit. Acceptable at FYP scale, but `/product/fetch` already supports server-side filtering, sorting and paging.
- The fixed pixel positions (`left: 140px`, `marginLeft: 90`, `width: 600px`) break below about 1000px.

**Solution:** Use `GET /product/fetch?category=&name=&page=&limit=16&sort=` with its `totalPages`. Keep page, category, query and sort in the URL. Pagination uses buttons. Remove the dead Search button, or make it submit. Add a price sort, which the API already supports. Use a responsive layout.

**🛠 Fix Prompt**
```
ProductPage.jsx: fetch from /product/fetch with category, name (debounced 300ms), sort
(''|'low'|'high'), page, limit=16; render total/totalPages from the response. Pagination:
<button> elements; Prev disabled on 1, Next disabled when page>=totalPages; hide when
totalPages<=1. Any filter change → page 1. Add a sort <select> (Default, Price low→high,
high→low). Replace absolute positioning with a Bootstrap row (col-12 col-md-3 select,
col-12 col-md-6 search, col-12 col-md-3 sort). Remove the fake Search anchor (or make Enter
in the input trigger immediate search). Backend /product/fetch: escape regex special chars in
`name`; cap limit at 50; include inventory stock (Step 4.2).
```
**🔍 Test Prompt**
```
Bug-hunt listing: search "(" → no 500; page 3 then change category → page 1; zero results →
no pagination, friendly empty state; sort low→high is correct across pages (not just within a
page); 375px width has no horizontal scroll. Report.
```
**✅ Done when:** filtering, sorting and paging are correct and can be shared by URL.

---

### Step 4.4 🟡 ProductItem card bugs
> 🧭 **Scope:** Main ✅ · Backend — · Dashboard —

**Problem:** ([M/Components/ProductItem.jsx](../../cafeFresco-main/src/Components/ProductItem.jsx))
- The cart icon turns into a check mark after 200 ms **whether or not the add succeeded** (lines 46-48). It then stays a check forever, so a second click does nothing, even after the item is removed from the cart.
- The "New" and "Featured" badges sit at the same position and overlap.
- Only the image is clickable; the title isn't.
- The image has no fallback for a missing file and no `alt` text ("Card image cap").
- `price` propType is `number`, but form data can make it a string.

**Solution:** The check icon reflects the **result** (show it for 2 s after success, then revert). Stack the badges. Make the title a link. Add an image `onError` fallback and real `alt` text.

**🛠 Fix Prompt**
```
ProductItem.jsx: make handleCartSubmit await addToCart(); show check icon for 2s only when it
returned ok, and an `adding` state disables the icon during the request. Render badges in a
flex column container (New, Featured, Out of stock, -N%). Wrap title in <Link to=/product/:id>.
Image: alt={title}, onError → a local placeholder from assets, loading="lazy".
propTypes: price oneOfType([number,string]).
```
**🔍 Test Prompt**
```
Bug-hunt cards: API down → icon never turns to check; success → check then back; a product
both new and featured → two readable badges; broken image path → placeholder. Report.
```
**✅ Done when:** cards tell the truth about the cart action.

### 🧪 Module 4 Gate
```
Compare, for 5 random products, the price/stock shown on Home sections, Products list, detail
page and the dashboard product page. All must match. Report a table.
```

---

# Module 5 — Product detail & Reviews

### Step 5.1 🔴 Adding a review is broken and has no business rule
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅ (the Products table shows `averageRating`)
>
> 🤖 **Cross-project instruction:** `Changing averageRating from String to Number affects cafeFresco-dashboard allProduct.jsx:165. Render it there as Number(x).toFixed(1) plus "(reviewCount)", and "—" when 0. Write cafeFresco-backend/scripts/recalcRatings.js that recomputes averageRating (Number) and reviewCount for every product from the reviews collection and rebuilds product.reviews ids (fixing the undefined entries the old bug pushed). Tell me to run it once; do not run it yourself. The buyer check depends on orders having orderStatus 'completed', which admins set in the dashboard (Dashboard Step 4.3). Run D-SMOKE.`

**Problem:** ([B/routes/review.js:9-46](../../cafeFresco-backend/routes/review.js#L9-L46))
- `product.reviews.push(review._id)` uses `review`, the **text string from the body**, not the saved document (`Newreview`). It pushes `undefined`, so the product's review list is never filled.
- The response returns the string too.
- The handler doesn't check whether the product exists. If it doesn't, the review **is saved**, and then `product.reviews` throws, so the client gets a 500 for a review that was stored.
- `productId` isn't validated as an ObjectId.
- Rating 0, or no star clicked, fails the schema `min: 1` and returns a raw 500 message. An empty review text is accepted.
- `averageRating` is typed **String** ([B/models/product.js:56](../../cafeFresco-backend/models/product.js#L56)).
- **Anyone logged in can review any product** without buying it. That's an easy route to fake reviews.
- The detail page shows **hard-coded 4.5 stars** ([ProductDetail.jsx:225-231](../../cafeFresco-main/src/Components/ProductDetail.jsx#L225-L231)) for every product.

**Solution:**
- Validate the input. Require the product to exist.
- Require a **completed order containing this product** (rule C6).
- Make `averageRating` a Number and add `reviewCount`. Recalculate both with an aggregate after save.
- Show the real average and count on the detail page.

**🛠 Fix Prompt**
```
Backend review.js POST /add/:productId: validate ObjectId (400), rating integer 1–5 (400),
review text trimmed 3–1000 chars (400); 404 if product missing (check BEFORE saving); 403
{message:'You can review products you have received'} unless orderModel.exists({userId,
orderStatus:'completed','products.productId':productId}); 409 if already reviewed (also add a
unique compound index {user:1,product:1} in models/review.js and map E11000 → 409). Save, then
recompute with an aggregate ($match product, $group avg + count) and $set product.averageRating
(Number, rounded 1 decimal) and reviewCount; push Newreview._id. Respond 201 with the review
(user name only). models/product.js: averageRating Number default 0, add reviewCount Number
default 0. Frontend ProductDetail.jsx: show real averageRating stars (full/half/empty) and
"(N reviews)"; if not eligible show the server's 403 message near the form.
```
**🔍 Test Prompt**
```
Bug-hunt reviews: user without a completed order → 403; with one → 201 and product
averageRating/reviewCount update correctly; second review same product → 409; rating 0 / 6 /
"abc" → 400; missing product id → 404 and NO review document created; two parallel submits →
one review. Check a product with legacy string averageRating still renders. Report.
```
**✅ Done when:** only verified buyers can review · ratings are correct numbers.

---

### Step 5.2 🟠 The public review list leaks customer emails
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard 🔎 (grep the dashboard for `/review/`; nothing uses it today, so confirm that before changing the shape)

**Problem:**
- `GET /review/all/:productId` is public and populates `'user', 'name email'` ([review.js:53](../../cafeFresco-backend/routes/review.js#L53)). The detail page shows **each reviewer's email address** as their name ([ProductDetail.jsx:362](../../cafeFresco-main/src/Components/ProductDetail.jsx#L362)). That's a privacy leak.
- `review.user?.name.charAt(0)` crashes if a user has no name or was deleted (`user` is null, so the `?.` is on the wrong part).
- The list isn't sorted (newest first) and isn't limited.
- After submitting, the form isn't cleared, and the button can be clicked repeatedly.

**Solution:** Return only `{ firstName, rating, review, createdAt }` from the server, sorted newest first and limited to 50. Clear the form and lock the button.

**🛠 Fix Prompt**
```
Backend review.js GET /all/:productId: validate id; populate user 'name' only; sort createdAt
-1; limit 50; map to {_id, name: first word of user.name or 'Customer', rating, review,
createdAt}. Frontend ProductDetail.jsx: display name (never email), initial from
(review.name || 'C')[0]; disable Submit while sending and when rating==0; after success reset
rating and text. Keep the carousel but add a simple list fallback when only 1 review exists
(hide prev/next controls when reviews.length < 2).
```
**🔍 Test Prompt**
```
Bug-hunt: curl /review/all/<id> → no "email" key anywhere in the JSON; review by a deleted user
renders as "Customer"; submit twice fast → one request. Report.
```
**✅ Done when:** no PII on public pages.

---

### Step 5.3 🟡 Detail page actions
> 🧭 **Scope:** Main ✅ · Backend — (uses the existing wishlist endpoints; their hardening is Step 10.1) · Dashboard —

**Problem:** ([M/Components/ProductDetail.jsx](../../cafeFresco-main/src/Components/ProductDetail.jsx))
- After saving to the wishlist, the page **navigates to `/products`** (line 104), throwing the customer off the product they were viewing.
- `toast.success(result.message)` runs before the `ok` check, so "Product already in wishlist" shows as a **success**.
- "Add to cart" is an `<a href="#">`, which jumps to the top.
- The gallery shows the same single image as its only thumbnail.
- The "Category:" row shows `details`, a confusing prop name.
- `console.log`s run on every review fetch.

**Solution:** Stay on the page and toggle the "Save" button to "Saved". Use the correct toast types. Use buttons, not anchors. Hide the thumbnail strip when there's one image.

**🛠 Fix Prompt**
```
ProductDetail.jsx: handleWishList → no navigate; ok → toast.success + mark saved, 400 already
→ toast (info) + mark saved, other → toast.error; 401 → navigate to login?next. Track saved
state on load by checking the user's wishlist ids (from context: expose wishlistIds alongside
count). Replace <a href="#"> actions with <button type="button">. Hide thumbnails when only one
image. Rename details→categoryTitle. Remove console.logs.
```
**🔍 Test Prompt**
```
Bug-hunt detail actions: save → stays on page, button shows Saved, Navbar badge +1; save again
→ no duplicate, no success toast; click Add to cart → page doesn't jump. Report.
```
**✅ Done when:** detail actions give correct feedback and keep the customer on the page.

### 🧪 Module 5 Gate
```
Full product-detail regression: deep link, refresh, add to cart (respecting stock), save,
review as non-buyer (blocked) and as buyer (allowed). Check the dashboard product view still
works with the new averageRating type. Report.
```

---

# Module 6 — Cart & Discount code

### Step 6.1 🔴 The cart API accepts any product and any quantity
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard —
>
> 🤖 **Cross-project instruction:** `This step changes the cart response shape (add/remove/update now return the formatted cart and new users get {cart:[]}). In the SAME step, update cafeFresco-main ProductState getCart/addToCart/removeFromCart/updateCartItemQuantity so they read the new shape. The storefront cart must keep working after this step even though the full UI rework is Step 6.2. Use the backend utils/price.js unitPrice from Step 4.1.`

**Problem:** ([B/routes/cart.js](../../cafeFresco-backend/routes/cart.js))
- `/add` doesn't check that `productId` is a valid, existing product. `quantity` isn't validated, so it can be `0`, `-5`, `"2"` or `1e9`. Line 33 (`existingProduct.quantity += quantity`) **concatenates strings** when the quantity arrives as a string.
- `/update-quantity` sets **any value**, including 0, negatives, `null` or 9999, with no stock check.
- `/all` crashes when a cart item's product has been deleted: `item.productId._id` on `null` gives a **500, and the whole cart becomes unusable** for that user.
- New users get **404 "Cart not found"** from `/all` and `/update-quantity` instead of an empty cart.

**Solution:**
- Validate `productId` (it must exist) and `quantity` (an integer from 1 to 99, and no more than the stock).
- Clamp the quantity to the stock.
- On read, drop items whose product no longer exists, and save the cleaned cart.
- Return `{ cart: [] }` for users without a cart. Return the **same formatted shape** from add, remove and update so the UI can use the response directly.

**🛠 Fix Prompt**
```
Backend cart.js: write a helper formatCart(cartDoc) that populates items.productId (title price
discount isActive image category.title inventory.quantityInStock). ⚖️ aligned (SHARED D7):
DROPS items whose product is null/deleted (saves the cart, returns removedCount so the UI can
say "N unavailable items were removed"); KEEPS inactive or out-of-stock items with
available:false and reason ('inactive'|'out_of_stock'|'insufficient_stock'), excluded from
subtotal. Returns {cart:[{productId,title,image,category,price,discount,unitPrice,quantity,
stock,available,reason}], removedCount}. Helper getOrCreateCart(userId). /order/create
(orderService) rejects unavailable lines with 409 {message, productId} (Dashboard B.5). /add: validate ObjectId,
product exists, quantity = parseInt, 1..99; newQty = existing+qty; if newQty > stock → 409
{message:`Only ${stock} left`}. /update-quantity: same validation, quantity 1..min(99,stock),
else 409. /remove: validate id. /all: no cart → 200 {cart:[]}. All four respond
{message, cart: formatCart(...)}.
```
**🔍 Test Prompt**
```
Bug-hunt cart API with curl: add qty "2" twice → 4 (not "22"); add -1 / 0 / 1.5 / "x" → 400;
add beyond stock → 409; update to 0 → 400; random ObjectId → 404; delete a product that's in a
cart (DB directly) → GET /cart/all returns the rest, 200; new user → {cart:[]}. Report.
```
**✅ Done when:** a cart can never hold invalid quantities or dead products.

---

### Step 6.2 🟠 The cart page has race conditions and stale totals
> 🧭 **Scope:** Main ✅ · Backend 🔎 (requires Step 6.1's response shape) · Dashboard —

**Problem:** ([M/Components/CartPage.jsx](../../cafeFresco-main/src/Components/CartPage.jsx), [ProductState.jsx:67-100](../../cafeFresco-main/src/Context/ProductState.jsx#L67-L100))
- The quantity is held in **two places**: the local `quantities` array and the context `cart`.
- Updates are matched by **array index** and read `cart[index]` from a stale closure. Fast clicks, or a removal during an update, change the wrong line.
- When the server rejects an update, the optimistic change is **never rolled back**.
- `quantities` isn't reset when the cart becomes empty (the effect only runs for length > 0).
- **"Proceed to Pay" is enabled with an empty cart.**
- The total shows as `{totalPrice}$`.
- The trash link is `href="#!"`.

**Solution:** The cart in context is the **only** source. Update by `productId`, and replace the cart with the server's response (Step 6.1 returns the formatted cart). Disable the +/- buttons for that line while its request runs, and cap them at the stock. Disable checkout when the cart is empty.

**🛠 Fix Prompt**
```
ProductState: updateCartItemQuantity(productId, qty) → POST update-quantity via apiFetch; on ok
setCart(data.cart); on error toast + keep previous cart (no optimistic change, or optimistic
with rollback). Track pendingIds (Set) in state. removeFromCart/addToCart also setCart(data.cart)
instead of re-fetching. CartPage.jsx: delete local `quantities` state; render item.quantity;
+ disabled when quantity >= item.stock or pending; - disabled at 1 or pending; key by productId;
trash is a <button>. Subtotal computed with unitPrice (Step 4.1) via one derived value (useMemo),
displayed with formatMoney. ⚖️ aligned (SHARED D7, Dashboard B.5): lines with available:false
render greyed with their reason ("No longer available" / "Out of stock" / "Only N left") and a
Remove button, are excluded from the subtotal, and block checkout; if the response has
removedCount > 0 show a one-time info toast. "Proceed to Pay" disabled when cart empty or any line pending; an
item now out of stock shows a warning and blocks checkout until removed/reduced.
```
**🔍 Test Prompt**
```
Bug-hunt cart UI: click + 10 times fast → final quantity equals server value, no wrong line
changed; server rejects (exceed stock) → quantity reverts with message; remove the middle of
three items during an update → others intact; empty cart → checkout disabled, totals $0.00.
Report.
```
**✅ Done when:** the cart UI always matches the server cart.

---

### Step 6.3 🔴 Discount codes: applied on the client, burned on preview, stackable
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅
>
> 🤖 **Cross-project instruction:** `Backend discount logic goes in cafeFresco-backend/services/discountService.js (Dashboard Step 9.1), and both /discount/apply and /order/create import it. Model changes (usedCount, isActive, uppercase code) affect cafeFresco-dashboard/src/views/pages/discountCode/discount.jsx. In the same step, uppercase the code input on create, show Used / Max uses and Active columns, and add an Active toggle that saves through PUT /discount/update/:id (the backend must accept isActive). Write scripts/migrateDiscountCodes.js that uppercases existing codes, sets usedCount = usedBy.length and removes null/undefined entries from usedBy (the old req.user.id bug pushed undefined). Tell me to run it. Order creation must accept discountCode in this step; if Step 8.1 isn't done yet, wire validate+redeem into the current /order/create so the discount actually reaches the stored order total. Run D-SMOKE (Discount codes page).`

**Problem:**
- The cart sends its **own total** as `cartTotal` ([CartPage.jsx:63-71](../../cafeFresco-main/src/Components/CartPage.jsx#L63-L71)), and the server trusts it.
- When a code is already applied, `cartTotal = totalPrice` is **the discounted total**. Clicking **Apply** again (the button stays enabled) **discounts the discount**: 10% off twice. Applying a second different code stacks too.
- Once a code is applied, changing quantities no longer updates `totalPrice` (`if (!discountApplied)` at line 49). The customer goes on to pay **the discounted total of the old cart**. If they add items, they underpay.
- On the backend, `/discount/apply` marks the code **used on preview**, and `req.user.id` is undefined, so the per-user check never works. `maxUses` is ignored. A missing `code` crashes `.trim()`.
- The applied discount never reaches the order: `/order/create` doesn't know about codes.

**Shared with Dashboard Step 9.1** (backend `validateDiscount` / `redeemDiscount`). Do that first, or do it here and mark it done there.

**Solution:**
- The cart keeps only the **code string**.
- `/discount/apply` is a preview computed from the **server cart**. The UI shows `subtotal`, `discountAmount` and `total` from the response.
- Re-run the preview whenever the cart changes. Only one code at a time: Apply is disabled while a code is applied, and Remove clears it.
- The code is sent to `/order/create`, which validates and redeems it atomically.

**🛠 Fix Prompt**
```
(If Dashboard Step 9.1 isn't done, implement its backend part now exactly as written there.)
Backend /discount/apply: body {code} only; compute subtotal from the user's server cart using
unitPrice; return {code, subtotal, discountAmount, total} — no writes. 400 for empty code.
Frontend: ProductState holds appliedCode (string|null) and discountPreview; remove
totalPrice/originalTotal/discountApplied in favour of derived values: subtotal from cart,
discountAmount/total from preview when appliedCode is set. Re-call preview (debounced) whenever
cart changes while a code is applied; if it fails (min purchase no longer met, expired) clear
the code and toast the reason. CartPage: input uppercase-trimmed; Apply disabled when empty or
a code is applied; Remove button clears appliedCode. Payment page shows subtotal, discount,
total from the same derived values. appliedCode is sent to /order/create (Module 8).
```
**🔍 Test Prompt**
```
Bug-hunt discounts: apply 10% code twice → only one 10% discount; apply code then add items →
total recomputed with discount on the new subtotal; reduce below minPurchase → code removed
with message; preview does not mark the code used (apply, refresh, apply again works; another
account can still use a maxUses:1 code until someone ORDERS with it); devtools edit of the
preview total has no effect on the stored order total. Report.
```
**✅ Done when:** one code per order · the discount is computed and redeemed only by the server.

### 🧪 Module 6 Gate
```
Scenario test: two users, one product with stock 3, one code maxUses 1. User A adds 2 + code,
User B adds 2 + code. Both check out (COD). Expected: one order gets the code, the other is told
the code is used up; stock never below 0; second order fails with "Only 1 left" if stock is
short. Report the actual DB state.
```

---

# Module 7 — Checkout: Delivery address

### Step 7.1 🔴 The delivery address is collected and then thrown away
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅
>
> 🤖 **Cross-project instruction:** `Three projects in one step, in this order: (1) backend order model + /order/create validation; (2) cafeFresco-main Address.jsx + send shippingAddress from StripePayment.jsx's current createOrder call. Do it NOW even if Step 8.1 rewrites it later, or every order placed in between fails with 400; (3) cafeFresco-dashboard allOrder.jsx View modal shows the address and phone, and the order list gets a City column. Put the phone regex in backend utils/validation.js (Step 11.1 and the frontend reuse the same pattern). Run D-SMOKE (Orders view).`

**Problem:**
- The order model has **no address fields** ([B/models/order.js](../../cafeFresco-backend/models/order.js)), and `StripePayment.jsx` never sends the address ([StripePayment.jsx:24-28](../../cafeFresco-main/src/Components/StripePayment.jsx#L24-L28)). The name, city, zip, address and email the customer types appear on the payment screen and are then **lost**.
- **The shop has no idea where to deliver.** For a café delivery business this breaks the core flow.
- There's **no phone field**, and COD delivery needs one.
- No field is validated; every field can be empty.
- The email field is separate from the account email and isn't used for anything.
- The user's saved `address` and `phone` (the user model has both) aren't pre-filled.

**Solution:**
- Add a `shippingAddress { fullName, phone, city, zip, line1 }` sub-document to the existing order model. The server validates it and the dashboard order view shows it (Dashboard Step 4.2 order view).
- The form pre-fills from `/user/me`, validates all fields, and drops the separate email: the account email is used.
- Optionally offer "Save as my default address", which uses the existing `PUT /user/update-profile`.

**🛠 Fix Prompt**
```
Backend models/order.js: add shippingAddress {fullName, phone, city, zip, line1} (all String,
optional at schema level for legacy orders). order.js POST /create: require body.shippingAddress
with fullName 2–60, phone matching /^\+?[0-9\s-]{7,15}$/, city 2–60, zip 3–10 alnum, line1
5–200; trim all; 400 with a field map on failure; store on the order.
Dashboard: in the order View modal (allOrder.jsx) show the shipping address block (legacy
orders → "No address recorded").
Frontend Address.jsx: fields fullName (prefill user.name), phone (prefill user.phone), city,
zip, line1 (prefill user.address); remove the email field; controlled inputs with `value`;
inline validation mirroring the server; checkbox "Save as my default address" → PUT
/user/update-profile {phone, address} on submit (ignore failure with a warning toast).
Store in checkoutAddress (Step 2.3). Fix label/id pairs; remove MDB data attributes.
```
**🔍 Test Prompt**
```
Bug-hunt address: submit empty → inline errors, no navigation; invalid phone → error; valid →
Payment shows the address; place a COD order → the order document in Mongo has
shippingAddress; the dashboard shows it; POST /order/create without shippingAddress via curl →
400. Profile prefill works for a user with saved phone/address. Report.
```
**✅ Done when:** every new order has a valid delivery address that the admin can see.

### 🧪 Module 7 Gate
```
Place one COD order end to end and open it in the dashboard: customer, items, address, total
all visible and correct. Report with a screenshot description.
```

---

# Module 8 — Checkout: Payment & order placement (highest business risk)

### Step 8.1 🔴 The card is charged before the order exists, and the client sets the amount
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅
>
> 🤖 **Cross-project instruction:** `⚖️ aligned (SHARED D2, D3, D4, D9): do NOT delete /order/set-transaction, /order/send-order-email or /stripe/payment/create in this step. Stop the shop calling them, and leave them deprecated until Dashboard Appendix B.6 removes them; grep both frontends (the dashboard has no callers; confirm). The order logic goes in services/orderService.js (createOrderFromCart, markOrderPaid, cancelOrder, cancelStaleUnpaidCardOrders). ONE INTENT PER ORDER: store order.stripePaymentIntentId, and have /stripe/payment-intent return the existing open intent on retry, so a retry can never create a second charge. Implement the stale-order cleanup lazily exactly as SHARED D9 (Vercel serverless, so no setInterval; check the Stripe intent before cancelling, and a succeeded intent → markOrderPaid, never cancel). Dashboard changes in the same step: allOrder.jsx shows a Payment method column (Card/COD), the View modal shows the Stripe PaymentIntent id when present, and the status dialog enforces Dashboard R3 (a card order can't be marked paid by hand; COD only after completed). If you add the Stripe webhook (POST /stripe/webhook), mount it in app.js BEFORE express.json() with express.raw({type:'application/json'}), verify the signature with STRIPE_WEBHOOK_SECRET, and make it idempotent with /stripe/confirm (both share one markOrderPaid(orderId, paymentIntent) function). Stripe amounts use the order's server total only. Run D-SMOKE (Orders list/view/update).`

**Problem:** ([M/Components/StripePayment.jsx:87-165](../../cafeFresco-main/src/Components/StripePayment.jsx#L87-L165))
- **Card flow:** create a PaymentIntent for an amount **the browser chose** → charge the card → only then call `/order/create`. If order creation fails (stock ran out, validation error, network drop, tab closed), **the customer has paid and there is no order**. Nothing records the money.
- `totalAmount` and `payment: 'paid'` are sent by the browser and trusted by the server ([B/routes/order.js:15,41-42](../../cafeFresco-backend/routes/order.js#L15)). A customer can create a `paid` order for $0.01 with curl.
- `if (!data) return toast.error(data.message)` never triggers. A failed intent passes `undefined` to `confirmCardPayment`.
- **Errors are shown as `toast.success`** (line 162).
- There's no double-submit protection, so a double-click can **charge twice and create two orders**.
- `alert("Stripe not loaded")`.
- The PAY button is enabled with an empty card field and an empty cart.
- **COD:** three separate calls (order → payment → set-transaction). If the second or third fails, the order exists without a payment record, and the user sees an error and retries, **creating a duplicate order**.
- `/order/set-transaction/:orderId` lets **any customer attach a payment to any order** (no ownership check).
- `/stripe/payment/create` marks payments `Completed` on the client's word.
- `/order/send-order-email` takes `amount` and `status` **from the client** and sends an email to the user with that content. It can be spammed, and the content can be faked.

**Shared with Dashboard Steps 4.1 (stock), 4.2 (server totals), 4.4 (Stripe verification).** Do the backend parts once, following those steps. This step adds the customer-side flow and closes the remaining gaps.

**Solution:** Follow rule C5.
1. `POST /order/create {shippingAddress, discountCode?, paymentMethod: 'card'|'cod'}`: the server reads **the user's cart**, computes totals, deducts stock, redeems the code, stores `paymentMethod`, and returns the order. The client never sends products or amounts.
2. **COD:** the same call also creates the Payment record (`Pending`) inside the handler. Done in one request.
3. **Card:** `POST /stripe/payment-intent {orderId}` returns a `clientSecret` for the order's server total. Then `confirmCardPayment`, then `POST /stripe/confirm {paymentIntentId}`, and the server verifies and marks the order paid. If the network fails after the charge, the order is still there, `pending` and `unpaid`. The **Stripe webhook** (or retrying confirm from the Track page) can reconcile it.
4. The server sends the confirmation email from inside create (COD) and confirm (card). The shop stops calling `/order/send-order-email`, `/order/set-transaction` and `/stripe/payment/create`; they're removed in Dashboard B.6 (SHARED D4).
5. Clear the cart only after the order is created, on the server, as today.
6. Unpaid card orders are cleaned up lazily, with Stripe checked first (SHARED D9).

**🛠 Fix Prompt**
```
Prerequisite: Dashboard Steps 4.1, 4.2, 4.4 and 9.1 backend parts (do them now if not done,
exactly as written there). Then:
Backend order.js POST /create: body {shippingAddress, discountCode, paymentMethod} only —
IGNORE products/totalAmount/payment if sent. Build lines from the user's server cart (empty →
400). Store paymentMethod ('card'|'cod') on the order (add to schema, enum). For 'cod', create
the Payment record (method 'COD', status 'Pending', transactionId `cod_${order._id}`) and set
order.paymentId in the same handler; send the order email (fire-and-forget, logged) with the
SERVER total. Add an idempotency guard: accept header Idempotency-Key; store it on the order
(unique sparse index) and return the existing order if the same key is re-sent by the same
user. Remove the shop's calls to /order/send-order-email, /order/set-transaction and
/stripe/payment/create; mark those routes "DEPRECATED — removed in B.6" (do not delete yet).
/stripe/payment-intent reuses order.stripePaymentIntentId when that intent is still open.
/stripe/confirm → orderService.markOrderPaid (idempotent; sends the email).
Frontend StripePayment.jsx: rewrite handleSubmit:
  - guard: submitting state, cart not empty, address present, for card the CardElement is
    complete (listen to onChange .complete);
  - generate one idempotency key per checkout attempt (crypto.randomUUID) kept in a ref;
  - POST /order/create {shippingAddress, discountCode: appliedCode, paymentMethod};
  - COD → success; card → POST /stripe/payment-intent {orderId} → confirmCardPayment →
    POST /stripe/confirm {paymentIntentId} → success;
  - card error after order exists → keep the order, toast.error(result.error.message), show
    "Retry payment" (re-run intent+confirm for the same orderId — the backend returns the SAME
    intent) and "Cancel order" (Step 9.2);
  - success → clear appliedCode + checkoutAddress, await getCart(), navigate to
    /track?order=<id>.
  All failures use toast.error. Replace alert() with toast.error. Button label shows the
server-confirmed total after order creation.
```
**🔍 Test Prompt**
```
Bug-hunt checkout end to end with Stripe test cards:
4242 4242 4242 4242 → order paid, one Payment, one email, cart empty;
4000 0000 0000 0002 (declined) → order exists pending/unpaid, retry with 4242 → paid, no second
order; 4000 0025 0000 3155 (3DS) → works after auth;
double-click Pay → one order, one charge (check Stripe dashboard);
curl POST /order/create with totalAmount:1, payment:'paid', products:[…] → fields ignored,
total from cart, unpaid;
COD → order + Pending payment in ONE request (Network tab);
the shop's Network tab never calls /order/set-transaction, /order/send-order-email or
/stripe/payment/create (they still exist, deprecated, until B.6; after B.6 → 404);
Retry after a decline: Stripe dashboard shows ONE PaymentIntent for the order, not two;
pay with 4242 but block /stripe/confirm in DevTools, set STALE_CARD_ORDER_MIN=1, and trigger
/order/user/history → the order becomes PAID, not cancelled (SHARED D9);
kill the network right after card confirm → order still exists; confirm later via retry →
paid. Report each case with DB evidence.
```
**✅ Done when:** no charge without an order · no amount set by the client · no duplicate orders · the server sends the emails.

---

### Step 8.2 🟠 The payment page shows fake invoice content
> 🧭 **Scope:** Main ✅ · Backend — · Dashboard —

**Problem:** [M/Components/Payment.jsx:66-95](../../cafeFresco-main/src/Components/Payment.jsx#L66-L95) shows a hard-coded invoice block:
- "**#AL2545**";
- a "**COPY PAYMENT LINK**" button that does nothing;
- editable inputs with placeholders "**Legal Consulting**" and "**Oct 25, 2020**";
- a close "×" icon.

This is template content. It confuses customers and looks unprofessional. The item rows show the raw `item.price × item.quantity` without formatting (for example `$10.5`), and the page isn't responsive (`h1` customer name).

**Solution:** Replace it with a real **order summary**: the items (name, qty, unit price, line total), subtotal, discount (code), total and the delivery address, with an "Edit" link to `/address`. Every number comes from the derived cart values (Step 6.3).

**🛠 Fix Prompt**
```
Payment.jsx: delete the "Create new invoice" box and all placeholder inputs. Left column:
"Delivery to" card with the checkoutAddress and an Edit link to /address. Right column: order
summary list from cart (title, qty × formatMoney(unitPrice), formatMoney(line total)), then
Subtotal, Discount (code) (only if applied), Total — all from the shared derived values — then
the payment form. Use Bootstrap grid classes for mobile; no fixed font hacks.
```
**🔍 Test Prompt**
```
Bug-hunt payment page: no placeholder text remains (grep "AL2545", "Legal Consulting",
"PAYMENT LINK"); totals equal the cart page's; 375px width readable without horizontal
scroll; Edit returns to /address with fields pre-filled. Report.
```
**✅ Done when:** the payment page shows only the real order.

### 🧪 Module 8 Gate
```
Run the full money matrix: {COD, card success, card decline→retry, card decline→cancel} ×
{no code, valid code}. For each, record order total, discount, paymentStatus, Payment record,
stock before/after, code usedCount, email sent. Compare with the business rules C5/R2/R3/R5.
Any mismatch is a FAIL.
```

---

# Module 9 — Order tracking (Track)

### Step 9.1 🔴 Order history leaks the password hash and shows wrong statuses
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard 🔎 (the Users page calls the admin route `/order/history/:userId`)
>
> 🤖 **Cross-project instruction:** `GET /order/history/:userId (admin route, used by cafeFresco-dashboard allUser.jsx:124) has the same populate('products userId') leak. Fix it the same way: populate userId with 'name email' only and products.productId with 'title'. Protect it as Dashboard Step 4.5 says if that isn't done. Grep order.js for every populate('userId') and make sure none returns password or resetPasswordToken. Check that the dashboard history modal still renders and run D-SMOKE (Users → order history).`

**Problem:**
- `GET /order/user/history` runs `.populate('products userId')` ([B/routes/order.js:219](../../cafeFresco-backend/routes/order.js#L219)). That populates the **entire user document** into every order, including the **bcrypt password hash and the reset token**, and sends it to the browser.
- `populate('products')` on a sub-document array does nothing useful, so the items are never shown.
- The route logs the user id to the console.
- The page ([M/Components/Track.jsx:112](../../cafeFresco-main/src/Components/Track.jsx#L112)) colours payment by `=== "completed"`, but the values are `paid`/`unpaid`, so **paid orders show gray**.
- It shows the raw 24-character ObjectId and no items, address or method.
- The state variable is called `wishlist`, a copy-paste from Wishlist.jsx, and the error says "Failed to fetch wishlist".

**Solution:**
- Select only the order's own fields. Use the line snapshots from Dashboard Step 4.2, and fall back to a populated product `title` for legacy orders.
- Show a short order number (the last 6 characters, uppercase), the items, total, method, status badges and address.
- Highlight `?order=<id>` from checkout.

**🛠 Fix Prompt**
```
Backend order.js GET /user/history: no populate of userId; populate('products.productId',
'title image') only for legacy fallback; select -__v; sort newest; remove console.logs;
paginate (page, limit 10). Never return user documents from order endpoints — grep order.js
for populate('userId') in customer-facing routes and fix.
Frontend Track.jsx: rename state to orders; render cards/rows with: Order #XXXXXX, date,
items (title × qty), total (formatMoney), payment method, order status badge
(pending=warning, completed=success, cancelled=danger), payment badge (paid=success,
unpaid=secondary), shipping city. Highlight and scroll to ?order=<id>. Empty state links to
/products. Error text says "orders". Pagination with buttons.
```
**🔍 Test Prompt**
```
Bug-hunt history: Network tab JSON for /order/user/history contains no "password",
"resetPasswordToken", "email" of the user; paid order shows a green badge; legacy order
without snapshot still lists item titles; deleted product in an old order → "Removed product",
no crash; ?order=<id> highlights the right row. Report.
```
**✅ Done when:** no sensitive fields in the response · statuses are correct and readable.

---

### Step 9.2 🟠 Customers can't cancel or retry an unpaid order
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅
>
> 🤖 **Cross-project instruction:** `⚖️ aligned (SHARED D5, D6): cancelOrder(order, actor) in services/orderService.js is the ONLY cancel path (it restores stock once, releases the discount, cancels an open Stripe intent, writes statusHistory {byType,byId} and notifies admins). It's used by the admin cancel in /order/update-status (Dashboard Step 4.3) and the customer /order/cancel/:id. If Dashboard Step 4.3 isn't done, implement the shared service now and switch the admin cancel to it too. Dashboard changes in the same step: allOrder.jsx shows "Cancelled by customer" (from statusHistory) in the list/view, and the status dialog is disabled for cancelled orders. The new admin notification renders in the header NotificationSection. Run D-SMOKE (Orders + notifications).`

**Problem:** After Step 8.1, a declined card leaves a `pending` / `unpaid` order holding stock. Customers have no way to **retry payment** or **cancel**, so stock stays locked until an admin cancels the order by hand. There's also no customer-side cancel for COD orders placed by mistake.
**Solution:** Apply rule C7. `POST /order/cancel/:id` (isLogged, owner only) works only when the order is `pending` and `unpaid`. It uses the same "cancel restores stock exactly once" logic as Dashboard Step 4.3, and frees a redeemed discount code (`$inc usedCount: -1`, `$pull usedBy`). The Track page shows "Pay now" for unpaid card orders and "Cancel" for eligible ones.

**🛠 Fix Prompt**
```
Backend order.js: add POST /cancel/:id (isLogged): validate id; atomically
findOneAndUpdate({_id, userId, orderStatus:'pending', paymentStatus:'unpaid'},
{orderStatus:'cancelled'}) — null → 409 'This order can no longer be cancelled' — by calling
orderService.cancelOrder(order, {byType:'customer', byId:req.user.userId}) with the extra
guard paymentStatus:'unpaid' and userId match. cancelOrder restores stock (stockRestored
guard), releases the discount, cancels an open Stripe intent (ignore "already canceled"),
writes statusHistory and notifies admins — same function as the admin cancel (Dashboard 4.3).
Before cancelling a card order, retrieve its intent: if it already succeeded, call
markOrderPaid and return 409 'This order has been paid' (SHARED D9 rule).
Frontend Track.jsx: for pending+unpaid orders show "Cancel" (confirm dialog) and, when
paymentMethod==='card', "Pay now" which opens the card form (reuse WrappedPaymentForm in a
retry mode taking orderId, calling intent+confirm only). Refresh the list after either action.
```
**🔍 Test Prompt**
```
Bug-hunt cancel: cancel own pending unpaid → cancelled, stock restored once (click twice fast);
cancel paid or completed → 409; cancel another user's order → 409/404 (no info leak);
discount code usable again after cancel; Pay now on a declined order → paid, stays one order.
Report.
```
**✅ Done when:** a failed payment never locks stock forever · the customer can fix their own mistakes.

### 🧪 Module 9 Gate
```
For one order of each state (pending/unpaid card, pending/unpaid COD, completed/paid,
cancelled) verify Track shows the correct badges and only the allowed buttons, and the
dashboard shows the same states. Report a table.
```

---

# Module 10 — Wishlist

### Step 10.1 🟠 The wishlist crashes on deleted products and errors for new users
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard —
>
> 🤖 **Cross-project instruction:** `The add/remove response shape changes, so update cafeFresco-main ProductState (count + wishlistIds) and ProductDetail.jsx (Step 5.3) in the same step.`

**Problem:**
- `GET /wishlist/all` returns **404 "Wishlist not found"** for any user who has never saved anything. The Wishlist page shows that as an **error toast** instead of an empty list ([M/Components/Wishlist.jsx:40-42](../../cafeFresco-main/src/Components/Wishlist.jsx#L40-L42)).
- When a saved product is deleted, `populate` returns `null` in `items`, and `item.image` **crashes the page**.
- `productId` isn't validated, so a bad id gives a CastError 500.
- "Add to Cart" ignores stock. The stock badge exists, but the button is still enabled.
- The loading spinner is a `<div>` placed directly inside `<table>`, which is invalid DOM and shows layout warnings.
- After "Add to Cart" the item stays in the wishlist and nothing indicates it was added.
- `console.log(product)`.

**Solution:** Return 200 with `[]` when there's no wishlist. Filter out `null` items and save the cleaned list. Validate ids. Disable Add to Cart when out of stock, and show the unit price. Put the spinner in a valid table row. Keep the item after adding (a common pattern), but show the toast result.

**🛠 Fix Prompt**
```
Backend wishlist.js: /all → no wishlist → 200 {wishlist:[]}; filter null items (and save the
cleaned array); populate also price discount title image; /add and /remove validate ObjectId
(400) and /add checks the product exists (404); use $addToSet for add and $pull for remove
(atomic, no duplicates). Return {message, wishlist, count} from add/remove so the context can
set count + ids without refetching.
Frontend Wishlist.jsx: spinner in <tbody><tr><td colSpan=5>; price via formatMoney(unitPrice);
Add to Cart disabled when out of stock; trash is a <button>; remove console.log; after remove
update local list from the response. Use context wishlistIds/count updates.
```
**🔍 Test Prompt**
```
Bug-hunt wishlist: new user opens /wishlist → empty state, no toast; delete a saved product in
DB → page still renders other items; add same product twice in parallel → stored once; badge
count matches the list after add/remove from detail and wishlist pages; out-of-stock row → Add
disabled. Report.
```
**✅ Done when:** the wishlist never errors for normal states · the badge is always correct.

### 🧪 Module 10 Gate
```
Cross-page check: save from detail page, view in wishlist, add to cart from wishlist, remove
from wishlist, logout/login — counts and lists correct everywhere. Report.
```

---

# Module 11 — User profile

### Step 11.1 🟡 The profile shows fake data and can't be edited
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard 🔎 (the Users page displays name, phone and address)
>
> 🤖 **Cross-project instruction:** `Reuse the phone regex from backend utils/validation.js (Step 7.1). Check cafeFresco-dashboard allUser.jsx still shows the updated phone and address correctly (empty → "—"). Run D-SMOKE (Users).`

**Problem:** ([M/Components/UserProfile.jsx](../../cafeFresco-main/src/Components/UserProfile.jsx))
- Missing fields fall back to **invented values**: "Bay Area, San Francisco, CA", "(239) 816-9029", "(320) 380-4539", "example@gmail.com", and a stock avatar from `bootdey.com` with `alt="Admin"`.
- A "Mobile" field is shown that doesn't exist in the model.
- `setData` runs before the `ok` check, and errors are only logged, so an expired session shows "Unknown".
- The backend already has `PUT /user/update-profile`, but there's **no edit form**. Wiring it up isn't a new module.
- That endpoint allows **changing the email with no uniqueness check** (a duplicate returns E11000 500) and **no verification**, so a typo locks the user out of password resets.
- `name`, `address` and `phone` aren't trimmed or length-checked server-side beyond `name >= 3`.
- There's no loading state.

**Solution:**
- Show real data, or "Not set" for empty fields. Use an initials avatar.
- Fields: Name, Email (read-only), Phone, Address.
- An "Edit profile" mode that saves through `update-profile`.
- The server **ignores `email`** in update-profile and validates phone and address with the Step 7.1 rules.
- Add a link to "My orders".

**🛠 Fix Prompt**
```
Backend users.js PUT /update-profile: accept only name, phone, address (ignore email);
trim; name 2–60, phone same regex as shippingAddress (allow empty), address <= 200; return the
updated user. Frontend UserProfile.jsx: use user from context (refreshSession after save);
loading skeleton; remove all fake fallbacks and the Mobile row and the bootdey image (initials
avatar circle); "Edit profile" toggles inputs for name/phone/address with validation, Save
(disabled while saving) / Cancel; email shown read-only with note "Contact us to change your
email". Keep "Send password reset email" button (uses Step 1.5 behaviour). Add Link to /track.
```
**🔍 Test Prompt**
```
Bug-hunt profile: user without phone/address shows "Not set" (grep for "Bay Area", "239",
"bootdey" → none); edit and save → persisted after reload and Navbar name updates; curl
update-profile with email → email unchanged; invalid phone → 400 shown inline. Report.
```
**✅ Done when:** the profile shows only real data · customers can keep their details current.

---

# Module 12 — Contact form

### Step 12.1 🟠 The contact form gives wrong feedback and can be abused as a spam relay
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard —
>
> 🤖 **Cross-project instruction:** `Use the single transporter from Step 1.5 (config/sendMail.js). Add CONTACT_TO to backend .env.example.`

**Problem:**
- The frontend marks Phone as optional, but the backend **requires** it ([B/routes/users.js:341](../../cafeFresco-backend/routes/users.js#L341)). The error "All fields are required." is then shown **as a success toast**, because the frontend never checks `res.ok` ([M/Components/Contact.jsx:33-35](../../cafeFresco-main/src/Components/Contact.jsx#L33-L35)).
- The form isn't cleared after a send.
- The HTML `required` attributes are bypassed because the button's `onClick` calls the handler directly.
- The backend inserts `name`, `subject` and `message` **raw into HTML** (HTML injection in the shop's inbox).
- It sets `from: email` (sender spoofing: Gmail rewrites or rejects it, and it can hurt deliverability). It should use `replyTo`.
- It has **no rate limit and no length limits**, so a bot can send unlimited email through the shop's Gmail account.
- The recipient address is hard-coded.

**Solution:**
- Phone optional on both sides. Validate lengths. Escape the HTML.
- Send `from` the shop address with `replyTo` set to the customer.
- Rate-limit to 5 per hour per IP. Read the recipient from `CONTACT_TO` in env.
- The frontend uses a real form submit, checks `res.ok`, and resets on success.

**🛠 Fix Prompt**
```
Backend users.js POST /contact: add a rate limiter (5/hour/IP); required name 2–60, valid email,
subject 3–120, message 10–2000, phone optional (same regex); escape all values with
validator.escape before inserting into HTML; mail from process.env.EMAIL, to
process.env.CONTACT_TO (add to .env.example), replyTo the customer email; generic error
message on failure. Frontend Contact.jsx: <form onSubmit> with preventDefault first, button
type="submit" (remove onClick), client validation mirroring the server, check res.ok →
success toast + reset form, else toast.error(data.message); 429 → "Too many messages, try
later". Remove marginLeft:'220px' and the fixed 690px image height (responsive layout).
```
**🔍 Test Prompt**
```
Bug-hunt contact: send without phone → success and email arrives with Reply-To set; message
"<b>x</b><script>" arrives escaped; 6th send in an hour → 429 message shown as error; empty
fields blocked client-side and server-side; form clears after success; 375px layout OK. Report.
```
**✅ Done when:** feedback is truthful · the form can't be used to spam or inject.

---

# Module 13 — Layout, content & responsiveness

### Step 13.1 🟡 Placeholder content and wrong branding on a public site
> 🧭 **Scope:** Main ✅ · Backend — · Dashboard —

**Problem:**
- **Lorem ipsum** is visible in [Learn.jsx:13](../../cafeFresco-main/src/Components/Learn.jsx#L13), [Subscribe.jsx:12](../../cafeFresco-main/src/Components/Subscribe.jsx#L12) and [MoreProduct.jsx:37](../../cafeFresco-main/src/Components/MoreProduct.jsx#L37).
- About says "**Flavour Land** promises…" ([About.jsx:21](../../cafeFresco-main/src/Components/About.jsx#L21)), which is the wrong brand.
- The banner has the typo "Dinning" ([Banner.jsx:34](../../cafeFresco-main/src/Components/Banner.jsx#L34)).
- The **Subscribe** box (shown on Home, Products and Contact) has an email input and button that **do nothing**. Customers think they've subscribed. A newsletter would be a new module, so the honest fix is to remove the input or turn the box into a "Contact us" call to action.
- "Learn more" goes nowhere.
- The footer year is hard-coded "2025" in decorative Unicode characters, which screen readers can't read.
- Many `<img>` tags have no `alt`.
- Every page has the same `<title>`.

**Solution:** Real copy, the correct brand, no fake controls, an accessible footer, and a page title per route.

**🛠 Fix Prompt**
```
Replace lorem ipsum in Learn, Subscribe and MoreProduct with short real Cafe Fresco copy (ask me
for exact text if unsure; use neutral placeholders like "Fresh food, made daily." meanwhile).
About: "Flavour Land" → "Cafe Fresco". Banner: "Dinning" → "Dining". Subscribe.jsx: remove the
email input + button; make the CTA a <Link to="/contact" className="btn btn-dark">Get in
touch</Link> (rename heading accordingly). Learn "Learn more" → Link to /about. Footer: plain
text "© {new Date().getFullYear()} Cafe Fresco. Developed by Muhammad Usama, Muhammad Waleed".
Add meaningful alt to every <img> (decorative ones alt=""). Add a small useDocumentTitle(title)
hook (src/hooks) and set titles on each route page ("Products · Cafe Fresco", etc.).
```
**🔍 Test Prompt**
```
Bug-hunt content: grep src for "Lorem", "Flavour Land", "Dinning", "consectetu" → zero; every
<img> has an alt attribute (grep and list any without); no input on the site that submits
nowhere; each route sets a distinct document.title. Report.
```
**✅ Done when:** no placeholder or misleading content remains.

---

### Step 13.2 🟡 The layout breaks on phones and tablets
> 🧭 **Scope:** Main ✅ · Backend — · Dashboard —

**Problem:** Layout is done with hard-coded pixel offsets throughout:
- Navbar mobile cart `left: "-238px"`, `top: "15px"` ([Navbar.jsx:61-64](../../cafeFresco-main/src/Components/Navbar.jsx#L61-L64)), so on most phone widths the cart icon lands off-screen or on top of the logo;
- `marginLeft: 135` product grids;
- Categories `width: '1200px'` and `marginLeft: "130px"`;
- Subscribe `marginLeft: "110px"`, a 400px input and images at `right: -562px`;
- Contact `marginLeft: '220px'`;
- Products heading `width: "600px"`;
- Posts `marginLeft: "450px"`.

The result is **horizontal scrolling and overlapping elements below about 1000px**. Most food orders come from phones. The Categories wheel handler also hijacks vertical page scrolling (`onWheel` adds `deltaY` to `scrollLeft`), so the page can't be scrolled past the category strip with a mouse wheel.

**Solution:** Use the Bootstrap grid and flex utilities already loaded, and remove the pixel offsets. The Categories strip uses `overflow-x: auto` with native horizontal scroll and the arrow buttons. Drop the wheel hijack.

**🛠 Fix Prompt**
```
Go component by component (Navbar, Banner, Catogories, flavorProduct, MoreProduct, ProductPage,
Learn, Posts, Subscribe, Contact, Footer, CartPage, Payment, Wishlist, Track): remove fixed
pixel margins/positions/widths used for layout and replace them with Bootstrap container/row/
col and d-flex/gap utilities; product grids → row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-4 with
cards width:100%. Navbar: cart icon and toggler in a d-flex ms-auto group, no negative offsets.
Categories: overflow-x:auto container, remove the onWheel handler. Move remaining one-off
styles into App.css classes. Don't change behaviour or copy. Do it in small commits per file.
```
**🔍 Test Prompt**
```
Bug-hunt responsiveness: at widths 360, 390, 768, 1024, 1440 open Home, Products, Product
detail, Cart, Address, Payment, Track, Wishlist, Profile, Contact, Login. Check:
document.documentElement.scrollWidth <= window.innerWidth (no horizontal scroll), no
overlapping elements, Navbar cart badge visible, mouse wheel scrolls the page over the
category strip. Produce a page × width PASS/FAIL table and fix FAILs.
```
**✅ Done when:** every page works from 360px to desktop without horizontal scroll.

### 🧪 Module 13 Gate
```
Run Lighthouse (mobile) on Home, Products and Product detail; record Performance,
Accessibility, Best Practices, SEO. Fix any Accessibility issue that is about missing
alt/labels/contrast introduced or left by this plan. Report scores before/after.
```

---

# Module 14 — Production hardening

### Step 14.1 🔴 An unauthenticated upload endpoint, and dead or broken routes
> 🧭 **Scope:** Main 🔎 (confirm there are no callers) · Backend ✅ · Dashboard ✅ (the Users page calls `/user/search`)
>
> 🤖 **Cross-project instruction:** `cafeFresco-dashboard allUser.jsx:89 calls GET /user/search. After protecting it, make sure that fetch sends credentials:'include', URL-encodes the query, and handles 401/403. ⚖️ aligned (SHARED D8 / Dashboard 10.1–10.2): the search returns the same paginated shape as /user/all, {success, data, totalUsers, currentPage, totalPages}, with data:[] (200) for no matches, never 404, and safe fields only. This IS Dashboard Step 10.1: do it once. Run D-SMOKE (Users search).`

**Problem:**
- `POST /user/upload-image` ([B/routes/users.js:181-198](../../cafeFresco-backend/routes/users.js#L181-L198)) has **no `isLogged`**: anyone can upload files to the server's disk. It references an undefined `User` and `req.user.id`, so it always crashes **after** saving the file. Disk fills, error leaks. Nothing in the storefront uses it.
- `GET /user/search` is public and searches all customers by name, email or phone (**Shared with Dashboard Step 10.1**).
- `router.use('/images/user', express.static(...))` inside the user router duplicates the global static serving.

**Solution:** Delete `upload-image`. The profile avatar is the initials (Module 11), and adding avatar upload would be a new feature. Protect `/user/search` as Dashboard Step 10.1 says. Remove the duplicate static route.

**🛠 Fix Prompt**
```
Backend users.js: delete POST /upload-image and the multer import if unused; delete the
router.use('/images/user', ...) line; if Dashboard Step 10.1 not done, protect GET /search with
isAdmin + authorizeRoles('admin','manager'), escape the regex, and select name email phone
createdAt only. Grep both frontends for "upload-image" and "/user/search" and report callers.
```
**🔍 Test Prompt**
```
Bug-hunt: curl POST /user/upload-image → 404 and no new file in public/images/user; curl
/user/search?query=a without admin cookie → 401; dashboard user search still works as admin.
Report.
```
**✅ Done when:** no public write endpoints exist besides register, login, forgot/reset and contact (all rate-limited).

---

### Step 14.2 🟠 VPN detection blocks real customers, and its key is hard-coded
> 🧭 **Scope:** Main ✅ (the login/signup VPN message, already done in Step 1.3) · Backend ✅ · Dashboard — (admin login doesn't use vpnDetect; keep it that way)

**Problem:** [B/middleware/vpnDetect.js](../../cafeFresco-backend/middleware/vpnDetect.js) runs on login and register in production.
- The vpnapi.io **API key is hard-coded** (line 42).
- Any error, including **API quota exhausted** (the free tier is small), a timeout or a network glitch, returns **500 and blocks login and signup for everyone** (fail-closed, lines 56-59).
- There's no timeout on the axios call, so a slow API stalls logins.
- Mobile carriers often use carrier-grade NAT or iCloud Private Relay, which vpnapi flags. **Legitimate customers get locked out** with no way forward.
- It logs every user's IP.

**Solution:** Move the key to env. Add a 2-second timeout. **Fail open** on errors (log, and allow). Allow turning it off with `VPN_CHECK=off`. Log the IP only when it blocks. Keep the business decision visible: if blocking VPNs isn't a real requirement, set `VPN_CHECK=off` in production.

**🛠 Fix Prompt**
```
vpnDetect.js: key from process.env.VPNAPI_KEY (add to .env.example); if VPN_CHECK==='off' or
no key → next(); axios timeout 2000; on any error → console.warn('vpn check skipped', reason)
and next(); only block on explicit vpn/proxy/tor true with 403 {vpnBlocked:true, message:
'Please turn off VPN/proxy to sign in.'}; remove the per-request IP console.log. Tell me to
revoke the old hard-coded key.
```
**🔍 Test Prompt**
```
Bug-hunt: with NODE_ENV=production and an invalid key → login still works (warning logged);
VPN_CHECK=off → no API call made (log/mock axios); a mocked vpn:true response → 403 with
vpnBlocked:true and the login page shows the message. grep for the old key → zero hits. Report.
```
**✅ Done when:** a third-party outage can't block logins · no hard-coded key.

---

### Step 14.3 🟡 Error leaks, logging and code hygiene
> 🧭 **Scope:** Main ✅ · Backend ✅ · Dashboard ✅
>
> 🤖 **Cross-project instruction:** `⚖️ aligned (SHARED D8): the backend part IS Dashboard Step 17.2 (central error handler, next(err)). Do it once there, and here only do the frontend parts. Before removing the "error" field from backend responses, grep cafeFresco-dashboard/src AND cafeFresco-main/src for reads of data.error / errorData.error / result.error and switch them to data.message. Apply the same console.log cleanup to the dashboard files this plan touched (keep console.error). Run D-SMOKE.`

**Problem:**
- Many storefront routes return `error: error.message` to the client (cart.js, wishlist.js, order.js, review.js, payment.js), which exposes internal details.
- `console.log` runs everywhere: in the storefront (Navbar token, login response, categories, reviews) and in backend handlers (user ids).
- `index.css` and `CSS/text_animation.css` are empty files.
- `Product.json` and `react-select` look unused.
- `README.md` doesn't describe setup or env.

**Solution:** Use one error-response pattern (log the details server-side, send a generic message plus a stable `code`). Strip the debug logs. Delete dead files after grepping for them. Rewrite the README with setup, env and the checkout flow.

**🛠 Fix Prompt**
```
Backend: in cart.js, wishlist.js, order.js, review.js, payment.js, users.js replace
`error: error.message` in responses with nothing (keep console.error server-side). Remove
debug console.log lines (keep console.error/warn). Frontend: remove all console.log; grep for
imports of Product.json, text_animation.css, index.css, react-select — delete what is unused
(and uninstall react-select if unused). Rewrite cafeFresco-main/README.md: what it is, setup,
env vars (.env.example), scripts, checkout flow summary (rule C5), deployment notes (Vercel
rewrites, backend CORS origin list must include the storefront URL).
```
**🔍 Test Prompt**
```
Bug-hunt hygiene: grep backend routes for "error.message" inside res.json → zero; grep main src
for console.log → zero; `npm run build` and `npm run lint` pass; trigger a 500 (e.g. stop
Mongo) → client gets a generic message, server log has the stack. Report.
```
**✅ Done when:** no internals leak to clients · the build and lint are clean · the README is accurate.

### 🧪 Module 14 Gate — final release check
```
Final production-readiness pass for the storefront:
1) npm run build (main) and node --check on backend files pass; no secrets in source
   (grep for "pass:", "sk_", "mongodb+srv", "key=").
2) Deploy preview (or NODE_ENV=production locally over https): run Module 1, 6, 8, 9 gates again.
3) Security spot-checks with curl: every customer route without cookie → 401; with user A's
   cookie against user B's resources → 403/404; no response contains password/reset tokens/
   other users' emails.
4) Mobile 390px walk-through of the complete purchase.
Write a short PASS/FAIL report per item and list anything deferred.
```

---

## Appendix A: Findings index

| Step | Sev | One-line summary |
|---|---|---|
| 0.1 | 🔴 | `Track.jsx` import casing breaks the Linux/Vercel build; lint not running |
| 0.2 | 🟠 | `.env` not ignored (backend has no .gitignore), missing favicon, duplicate/unused CDN libs |
| 1.1 | 🔴 | JS-readable token; login state read from cookie → broken on separate production domains |
| 1.2 | 🔴 | Logout throws (`setWishList` undefined), never ends server session, leaks cart to next user |
| 1.3 | 🟠 | Login: no Enter submit, enumeration, limiter counts successes, no `next` redirect, scroll lock |
| 1.4 | 🟠 | Signup: weak rules, email case 500, no confirm/loading/error feedback |
| 1.5 | 🔴 | Hard-coded Gmail password; forgot enumeration/no limit; reset stuck "Updating…" |
| 2.1 | 🔴 | No route guards; guests see fake profile data and a payable blank checkout |
| 2.2 | 🟠 | Product detail only works from `location.state`; refresh/shared links go Home |
| 2.3 | 🔴 | Address form reloads the page (no preventDefault), "Go back" submits, steps skippable |
| 2.4 | 🟡 | Category click broken (`cat.name`), no 404, mobile menu ignores auth, dead links |
| 3.1 | 🟠 | Context: dead Buy-now path, wishlist count type bug, error shown as success, Audio per render |
| 4.1 | 🟠 | Product discount ignored: shown price ≠ charged price |
| 4.2 | 🟠 | Stock not exposed; out-of-stock items can be added |
| 4.3 | 🟡 | Products paging/filter bugs, regex injection in `/product/fetch`, layout |
| 4.4 | 🟡 | Cart icon shows success regardless of result; overlapping badges |
| 5.1 | 🔴 | Review push bug, review saved then 500, no buyer check, hard-coded 4.5 stars |
| 5.2 | 🟠 | Public reviews expose reviewer emails; crash on missing user |
| 5.3 | 🟡 | Save-to-wishlist navigates away and shows errors as success |
| 6.1 | 🔴 | Cart API accepts any product/quantity (string concat, negatives); deleted product → 500 |
| 6.2 | 🟠 | Cart UI index-based races, no rollback, checkout enabled when empty |
| 6.3 | 🔴 | Discount stacks/re-applies, client total trusted, stale discounted total, code burned on preview |
| 7.1 | 🔴 | Delivery address never saved on the order; no phone; no validation |
| 8.1 | 🔴 | Card charged before order exists; client sets amount/paid; double-submit; forgeable payment/email routes |
| 8.2 | 🟠 | Payment page shows fake invoice (#AL2545, "Legal Consulting") |
| 9.1 | 🔴 | Order history sends user password hash; wrong paid badge; no items shown |
| 9.2 | 🟠 | No customer cancel/retry; failed card orders lock stock |
| 10.1 | 🟠 | Wishlist 404 for new users, crash on deleted products, invalid DOM |
| 11.1 | 🟡 | Profile shows invented data; no edit; update-profile allows unverified email change |
| 12.1 | 🟠 | Contact errors shown as success; HTML injection; no rate limit; spoofed `from` |
| 13.1 | 🟡 | Lorem ipsum, wrong brand "Flavour Land", fake Subscribe form |
| 13.2 | 🟡 | Pixel-offset layout breaks phones; category strip hijacks scrolling |
| 14.1 | 🔴 | Unauthenticated file upload endpoint; public user search |
| 14.2 | 🟠 | VPN check fails closed and blocks all logins on API errors; hard-coded key |
| 14.3 | 🟡 | `error.message` leaks, console logs, dead files, README |

## Appendix B: Steps that share backend work with the dashboard audit

| Main-site step | Dashboard step | Do the backend once |
|---|---|---|
| 1.5 Forgot/reset + mail transporter | 1.4 | Shared transporter from env |
| 6.3 Discount codes | 9.1 | `validateDiscount` / `redeemDiscount` |
| 8.1 Checkout | 4.1, 4.2, 4.4 | Atomic stock, server totals and snapshots, Stripe confirm |
| 9.2 Customer cancel | 4.3 | Shared `restoreStock(order)` guarded by `stockRestored` |
| 14.1 User search | 10.1 | Protect `/user/search` |

## Appendix C: Which projects each step changes

✅ = code change in that project · 🔎 = verify only · — = not affected. Steps marked ✅ in more than one column have a 🤖 Cross-project instruction and must finish in all of them before the step counts as done.

| Step | Main | Backend | Dashboard | | Step | Main | Backend | Dashboard |
|---|---|---|---|---|---|---|---|---|
| 0.1 | ✅ | — | 🔎 | | 6.1 | ✅ | ✅ | — |
| 0.2 | ✅ | ✅ | ✅ | | 6.2 | ✅ | 🔎 | — |
| 1.1 | ✅ | ✅ | 🔎 | | 6.3 | ✅ | ✅ | ✅ |
| 1.2 | ✅ | ✅ | — | | 7.1 | ✅ | ✅ | ✅ |
| 1.3 | ✅ | ✅ | ✅ | | 8.1 | ✅ | ✅ | ✅ |
| 1.4 | ✅ | ✅ | — | | 8.2 | ✅ | — | — |
| 1.5 | ✅ | ✅ | ✅ | | 9.1 | ✅ | ✅ | 🔎 |
| 2.1 | ✅ | 🔎 | — | | 9.2 | ✅ | ✅ | ✅ |
| 2.2 | ✅ | ✅ | ✅ | | 10.1 | ✅ | ✅ | — |
| 2.3 | ✅ | — | — | | 11.1 | ✅ | ✅ | 🔎 |
| 2.4 | ✅ | 🔎 | — | | 12.1 | ✅ | ✅ | — |
| 3.1 | ✅ | — | — | | 13.1 | ✅ | — | — |
| 4.1 | ✅ | ✅ | ✅ | | 13.2 | ✅ | — | — |
| 4.2 | ✅ | ✅ | 🔎 | | 14.1 | 🔎 | ✅ | ✅ |
| 4.3 | ✅ | ✅ | 🔎 | | 14.2 | ✅ | ✅ | — |
| 4.4 | ✅ | — | — | | 14.3 | ✅ | ✅ | ✅ |
| 5.1 | ✅ | ✅ | ✅ | | | | | |
| 5.2 | ✅ | ✅ | 🔎 | | | | | |
| 5.3 | ✅ | — | — | | | | | |

The steps that stay Main-only (2.3, 3.1, 4.4, 5.3, 8.2, 13.1, 13.2) are purely frontend. They call no changed endpoint, or they depend on a backend step that comes earlier in this plan.

**Overall sequence across both audits:** use the **Master sequence** in [SHARED_DECISIONS.md](../SHARED_DECISIONS.md#master-sequence-identical-in-both-audits). It's the only valid order. The catalog work (Dashboard 5.x `isActive`, stock and prices) comes **before** the money flow, and the deprecated endpoints are removed last, in Dashboard B.6.
