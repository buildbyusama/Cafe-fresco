# Performance check (Step 6.4, SRS 5.1)

**Target (SRS 5.1):** at least 500 concurrent users, with APIs answering in 200–500 ms.

**Tool:** `tests/load64.js` (autocannon, 500 connections, 20 s per endpoint, 5 s pause between runs).

**Machine and setup:**
- the developer's Windows 11 laptop;
- local MongoDB;
- the backend started with `LOAD_TEST=true` (localhost bypasses the rate limiter; refused in production) and `LOG_LEVEL=warn`;
- a single Node process.

## Results

| Endpoint | Before: req/s | Before: p97.5 | Before: errors | After: req/s | After: p50 | After: p97.5 | After: p99 | After: errors |
|---|---|---|---|---|---|---|---|---|
| `/product/fetch?limit=16&sort=recommended` | 313 | 1,983 ms | 0 | **5,964** | 67 ms | **86 ms** | 314 ms | 0 |
| `/category/fetch` | 1,302 | 8,668 ms | 3,075 timeouts | **10,189** | 46 ms | **64 ms** | 70 ms | 0 |
| `/reco/trending` | 836 | 5,027 ms | 862 timeouts | **9,037** | 46 ms | **63 ms** | 104 ms | 0 |
| `/settings/public` | 10,373 | 638 ms | 1,742 | **10,009** | 48 ms | **60 ms** | 62 ms | 0 |
| `/health` | 10,261 | 62 ms | 0 | 9,930 | 49 ms | 59 ms | 64 ms | 0 |

"After" is with the response cache described below.

**Result:** all the listed endpoints meet the target at 500 concurrent connections, with no errors.

## What changed

- **`services/responseCache.js`:** the public catalogue reads (`/product/*`, `/category/*`, `/reco/*` except `for-me`) are served from memory for up to 15 s, and the response carries an `X-Cache` header.
  - Admin requests are never cached.
  - Personal routes are never cached (`/reco/for-me`, cart, chat, orders, account).
  - The cache is cleared at once on any admin change (from the activity-log middleware) and on any stock change (`adjustStock`), so prices, availability and stock are never more than one request out of date.
  - It holds at most 500 entries.
- **Existing caches stay as they were:**
  - store settings: 60 s;
  - recommendation lists: 5 min, cleared on product change;
  - search vectors: 5 min;
  - query embeddings: LRU of 500.
- **Load-test bypass:** the general rate limiter skips localhost when `LOAD_TEST=true`.

Every cache is size-capped, so memory stays bounded under load.

## Not measured here

- **Chat under load.** It costs money per message with a real key. The rule-based path is the same code as the tools and is covered by `chat33.js` and `chat34.js`.
- **Lighthouse page speed.** It needs a production build served by `vite preview` on the deployment target; run it after deploying.
- **Uptime (SRS 5.2, 99.9%).** It depends on the hosting; point an uptime monitor at `GET /health`.

## Document upload (RAG R1.3)

| Document | Size | Passages | Embedding batches | Time (test mode) |
|---|---|---|---|---|
| 200-page PDF (pdfkit) | 179 KB | 400 | 7 (sent 3 at a time) | 3.0 s |

**With the real OpenAI API**, each embedding batch adds about 0.5–1.5 s. Sending three at a time means a 200-page upload takes roughly **5–8 s** in total.

**On Vercel:**
- The Hobby plan's default function limit is 10 s, so very large documents are borderline there.
- Set `maxDuration` to 60 on Pro, or split very long documents.
- Typical guides (under 50 pages) take a couple of seconds.

## Document search (RAG R2.2)

**Threshold calibration** (real `text-embedding-3-small`, 512 dims, four fixture documents). The score is the best hybrid score, 0.75 × cosine + 0.25 × keyword overlap.

| Questions | Best scores |
|---|---|
| 7 relevant (catering notice, deposit, birthday, hall size, spoiled food, refund time, vegetarian) | 0.367 – 0.691 (median 0.517) |
| 7 unrelated (capital of France, car engine, joke, burger spice, opening time, Python, cricket) | 0.075 – 0.294 (median 0.121) |

**Chosen `RAG_MIN_SCORE`: 0.32.** It sits between the weakest relevant match (0.367) and the strongest unrelated one (0.294). Test mode (`AI_MOCK`) uses 0.30 with its own word-hash vectors. Without AI, search is keyword-only and needs at least half the question's meaningful words in a passage.

**Cross-language limitation.** An Urdu question about catering scored 0.217 against the English catering guide, below the threshold. Questions and documents in different languages often don't match. Upload documents in the language customers ask in, or upload both versions.

**Speed and memory** (20,000 synthetic passages, test mode, the developer's laptop):
- Vectors are held in one Float32Array: 39 MB.
- The whole search cache, with text and keywords, takes about 60 MB.
- One search takes 62 ms at p50 and 74 ms at p95, under the 100 ms target.

## Sign-off numbers (RAG R5.2)

Measured by `tests/rag52.js` (local, Atlas database) and `tests/rag22.js`.

| Check | Target | Result |
|---|---|---|
| Retrieval p95 at 20,000 passages | under 100 ms | 54–78 ms |
| Chat p95 added by a published 200-page library (mock AI) | under 300 ms | about +1 ms (30 → 32 ms) |
| 200-page sync ingest (389k characters, 400 passages), mock embeddings | — | 0.7 s |
| 200-page sync ingest, real `text-embedding-3-small` | fits Vercel's limit (10 s Hobby, 60 s Pro) | 3.7 s |

A file over about 400,000 characters (about 200 pages) is refused with "split it into smaller files", so no single upload can run past these numbers by much.
