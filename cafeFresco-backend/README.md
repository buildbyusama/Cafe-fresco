# Cafe Fresco Backend

A complete Node.js + Express backend API for Cafe Fresco ecommerce operations.
This project handles user authentication, product/catalog management, cart/wishlist, orders, payments, discounts, reviews, admin operations, and dashboard reporting.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Main Features](#main-features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Getting Started (Beginner Guide)](#getting-started-beginner-guide)
6. [Environment Variables](#environment-variables)
7. [Run the Project](#run-the-project)
8. [API Route Map](#api-route-map)
9. [Authentication & Roles](#authentication--roles)
10. [Image Uploads](#image-uploads)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)
13. [Future Improvements](#future-improvements)
14. [Developed By](#developed-by)

---

## Project Overview

Cafe Fresco Backend is the server-side system for an ecommerce-style cafe platform.

It provides:

- User and Admin authentication
- Role-based access control (Admin / Manager / Editor)
- Product and category management
- Cart and wishlist
- Order and payment handling (Stripe + COD support)
- Discount code support
- Review system
- Inventory and business entities (employee, department, supplier, distributer)
- Dashboard analytics endpoints

---

## Main Features

### 1) User Features

- Register and login with JWT
- Forgot/reset password via email
- Profile update and profile image upload
- Product search and recommendations
- Manage cart and wishlist
- Place orders and view order history
- Apply discount codes
- Add product reviews

### 2) Admin Features

- Admin register/login
- Create, update, and delete permissions/roles
- Manage users and admin list
- Notification endpoints (mark seen, fetch)
- Dashboard analytics (earnings and reports)

### 3) Catalog & Inventory Features

- Category CRUD with image upload
- Product CRUD with image upload
- Inventory update support
- Department management
- Employee management
- Supplier and distributer management

### 4) Commerce & Security Features

- Stripe payment intent creation
- Payment record creation and tracking
- Order status updates by authorized admin roles
- Login rate limiting for protection
- VPN/proxy detection middleware (production)
- CORS allowlist + cookie handling

---

## Tech Stack

### Core

- Node.js
- Express.js
- MongoDB + Mongoose

### Security & Auth

- JSON Web Token (`jsonwebtoken`)
- Password hashing (`bcryptjs` / `bcrypt`)
- `express-rate-limit`
- `cookie-parser`
- `validator`

### Payments & Communication

- Stripe
- Nodemailer

### Utilities

- Multer (image uploads)
- Axios
- NodeCache
- Dotenv
- Moment.js

### Deployment

- Vercel (`vercel.json` uses `app.js` as server entry)

---

## Project Structure

```bash
cafeFresco-backend/
├── app.js
├── package.json
├── vercel.json
├── config/
│   ├── db.js
│   └── sendMail.js
├── middleware/
├── models/
├── public/images/
└── routes/
```

- `config/` -> database and mail configuration
- `middleware/` -> auth, limiter, upload, VPN detection
- `models/` -> MongoDB schemas
- `routes/` -> all API modules
- `public/images/` -> uploaded images for product/category/user

---

## Getting Started (Beginner Guide)

### Step 1: Install prerequisites

Make sure you have:

- Node.js (v18 or above recommended)
- npm
- MongoDB database (local or MongoDB Atlas)

### Step 2: Open project

```bash
cd cafeFresco-backend
```

### Step 3: Install dependencies

```bash
npm install
```

### Step 4: Create environment file

Create a `.env` file in the project root.

Use this template:

```env
PORT=8080
NODE_ENV=development
DB_URI=your_mongodb_connection_string
SECRET_KEY=your_jwt_secret_key
STRIPE_SECRET_KEY=your_stripe_secret
EMAIL=your_email_address
EMAIL_PASSWORD=your_email_app_password
EMAIL_USER_URL=http://localhost:3000
EMAIL_RESET_URL=http://localhost:3001
```

### Step 5: Start the backend server

```bash
node app.js
```

or during development:

```bash
npx nodemon app.js
```

### Step 6: Test server

Open in browser:

```text
http://localhost:8080
```

Expected response:

```text
Server is running
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Port for Express server |
| `NODE_ENV` | Yes | `development` or `production` |
| `DB_URI` | Yes | MongoDB connection string |
| `SECRET_KEY` | Yes | JWT signing secret |
| `STRIPE_SECRET_KEY` | Yes (for payments) | Stripe private key |
| `EMAIL` | Yes (for mail) | Sender email |
| `EMAIL_PASSWORD` | Recommended | Email app password |
| `EMAIL_USER_URL` | Yes (for user reset link) | Frontend base URL for user reset |
| `EMAIL_RESET_URL` | Yes (for admin reset link) | Frontend base URL for admin reset |

---

## Run the Project

### Local

1. Configure `.env`
2. Run `npm install`
3. Run `node app.js` or `npx nodemon app.js`

### Production Notes

- Set `NODE_ENV=production`
- Configure CORS origins in `app.js`
- Add environment variables on your hosting platform

---

## API Route Map

Base route prefixes configured in `app.js`:

- `/user` -> user operations
- `/admin` -> admin operations
- `/category` -> category management
- `/product` -> product management
- `/review` -> product reviews
- `/cart` -> cart APIs
- `/wishlist` -> wishlist APIs
- `/stripe` -> payment APIs
- `/order` -> order APIs
- `/user-Interest` -> recommendation/search behavior
- `/api` -> dashboard/earning reports
- `/discount` -> discount code APIs
- `/employee` -> employee APIs
- `/department` -> department APIs
- `/supplier` -> supplier APIs
- `/distributer` -> distributer APIs

### Example Endpoints

- `POST /user/register`
- `POST /user/login`
- `POST /admin/login`
- `GET /product/all`
- `POST /cart/add`
- `POST /order/create`
- `POST /stripe/payment-intent`
- `POST /discount/apply`

---

## Authentication & Roles

- JWT tokens are used for user and admin sessions.
- Cookie support is enabled through `cookie-parser`.
- Role authorization middleware supports role checks like `admin`, `manager`, and `editor`.
- Protected routes use `isLogged` (user) and `isAdmin` + `authorizeRoles` (admin).

---

## Image Uploads

- Uploads are handled by Multer middleware.
- Storage folders:
  - `public/images/product`
  - `public/images/category`
  - `public/images/user`
- Allowed formats: `jpeg`, `jpg`, `png`, `gif`

---

## Deployment

This project includes `vercel.json` for deployment on Vercel:

- Build source: `app.js`
- Runtime: `@vercel/node`
- All routes rewrite to `app.js`

Before deployment:

1. Add all environment variables in Vercel settings
2. Update CORS allowed origins in `app.js`
3. Ensure MongoDB cluster allows your deployment IP/access

---

## Troubleshooting

- **MongoDB not connecting** -> Check `DB_URI`
- **JWT errors** -> Verify `SECRET_KEY`
- **CORS blocked** -> Add frontend domain to allowed origins
- **Email not sending** -> Verify email credentials and app password
- **Stripe issue** -> Check `STRIPE_SECRET_KEY` and payload amount type

---

## Future Improvements

- Add request validation library (Joi/Zod)
- Centralized error handler middleware
- Swagger/OpenAPI documentation
- Unit and integration test coverage
- Replace hardcoded secrets with strict env-based config

---

## Developed By

Developed by Muhammad Ismaeel.

## AI assistant (OpenAI)

The chat assistant and smart search use OpenAI through `services/ai/client.js` (the only place that talks to OpenAI).

- Set `OPENAI_API_KEY` in `.env`. Without it the shop still works and the assistant answers with built-in rules.
- Defaults: `OPENAI_MODEL=gpt-4o-mini` (chat) and `OPENAI_EMBED_MODEL=text-embedding-3-small` (search). Both can be changed in `.env`.
- Cost guard: `AI_DAILY_TOKEN_BUDGET` (default 2,000,000 tokens a day). Above it the assistant switches to rule-based answers until midnight (`APP_TZ`). Also set a monthly limit in your OpenAI account.
- `AI_MOCK=true` gives scripted offline answers, used by the tests (`FYP/tests`). Never enable it in production; the server refuses to start if you do.
- Every call has a timeout (`AI_TIMEOUT_MS`, default 20 s) and one retry on 429/5xx.
- **Turn the assistant off** without a deploy: Dashboard → AI Assistant → Assistant settings (or `CHAT_ENABLED=false`). A lower daily budget can be set there too (never above `AI_DAILY_TOKEN_BUDGET`).
- **After adding the key**, run `node scripts/embedProducts.js` once (or Assistant settings → Re-index) so smart search and "similar dishes" use embeddings. Until then they use keyword matching.
- **Knowledge (FAQ):** `node scripts/seedKnowledge.js` adds 8 common questions as drafts; write the real answers and publish them in Dashboard → AI Assistant → Knowledge.
- **Store facts** the assistant quotes (hours, contact, delivery, policies) come from Dashboard → Store Info. Empty facts are never invented: the assistant says it doesn't know.
- **Costs:** Dashboard → AI Assistant → Insights shows tokens and estimated cost (`OPENAI_PRICE_IN` / `OPENAI_PRICE_OUT`, USD per 1M tokens). Tests run with `AI_MOCK=true` and are counted separately (never in the real budget).
- **Endpoints:** `/chat/*` (customer chat, SSE), `/chat/admin/*` (insights, transcripts, usage, re-index), `/knowledge`, `/reco/*`, `/product/search`, `/events`, `/settings`.

## Images

Uploads go through `services/storage.js`: local `/public/images` by default, Cloudinary when `CLOUDINARY_URL` is set (required on Vercel, where local files disappear). Move existing images with `node scripts/migrateImagesToCloud.js --apply` after setting it.

## Monitoring

- `GET /health` → `{status, db, ai, uptime}`; returns 503 when the database is down. Point any uptime monitor at it (for example a free UptimeRobot HTTP check every 5 minutes).
- Logs are JSON lines (pino) with a `reqId` on every line; errors are `"level":50`.
- The dashboard bell raises: AI outages / budget used up, payment problems, more than 10 server errors in a minute, and crash-level errors (each de-duplicated).
- Dashboard → Activity Log (admin) lists every change made in the dashboard for a year.

## Documents (RAG)

Admins and managers upload PDF, Word (.docx), .txt or .md files in Dashboard → AI Assistant → Documents; the assistant answers from **published** ones and names the document it used. Plan: `docs/RAG_PLAN.md`.

- Limits: 10 MB per file (4 MB on Vercel, which rejects bigger request bodies), 50 documents, about 200 pages per document. Scanned (image-only) and password-protected PDFs are refused.
- Only the extracted text is kept, not the original file.
- Prices, stock, hours and order status always come from the database, even if a document says otherwise.
- **Anything in a published document can be read by customers through the chat.** Don't upload supplier prices, staff details, contracts or personal data. Uploads are scanned for emails, phone numbers and card/CNIC-like numbers, and publishing asks you to confirm.
- Phone numbers, offers, discount codes and HTML in documents are hidden from the assistant (contact details and deals come from the store tools). Sentences that try to instruct the assistant (English or Urdu) are dropped.
- Speed: a search over 20,000 passages takes under 100 ms; a 200-page document processes in about 4 s with real embeddings. See `docs/PERFORMANCE.md`.
- Settings: `RAG_MAX_FILE_MB`, `RAG_MAX_DOCS`, `RAG_MAX_PASSAGES`, `INGEST_MODE`, `RAG_MIN_SCORE`, `AI_PROMPT_VERSION` (see `.env.example`).
- Sample documents (catering guide, house policies, delivery guide, food safety, customer FAQ) are in `samples/documents/`. Load them with `node scripts/seedDocuments.js` (drafts) or `node scripts/seedDocuments.js --publish`. Edit them to match your real policies before publishing. They hold no prices, hours or contact details, because those come from the database.
