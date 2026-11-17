# RAG audit 2: answer quality

Scope (from `RAG_PLAN.md` R5.3): 30 real-key questions over realistic documents. The answers must:
- be grounded in a document;
- cite the source;
- take prices from the database;
- say "don't know" honestly;
- work in other languages;
- handle mixed questions.

Test: `tests/ragaudit2.js` uses the real model (`gpt-4o-mini`, 512-dimension `text-embedding-3-small`). The documents are a catering guide, a house-policies file and a stale 2022 menu. The full transcript is in `docs/ai-transcripts/rag/audit2.md`.

## Results

| Measure | Before fixes | After |
|---|---|---|
| Document answers that contain the fact | 15 / 23 | **23 / 23** |
| Answers that name the source | 8 / 19 | **19 / 19** |
| Honest "don't know" (pool, dogs, classes, wifi password, helipad) | 5 / 5 | 5 / 5 |
| Prices from the database, never the 2022 document | 4 / 4 | 4 / 4 |

## Findings and fixes

| # | Finding | Fix |
|---|---|---|
| 1 | For policy-style questions ("Where can I park?", "Is your meat halal?") the model called **only `search_knowledge`**. That tool's "say you don't know" note made it give up, even though the policies document scored 0.37 to 0.73. | When `search_knowledge` has no entry, it returns the matching document passages (with source cards). Its output limit was raised to 4,000 characters so passages aren't cut. |
| 2 | The mirror case: the model called **only `search_documents`**, and a published staff FAQ answer was missed. This was found in R5.2. | `search_documents` falls back to the FAQ. The two tools share internal helpers, so they can't call each other in a loop. |
| 3 | An Urdu question ("کیا آپ کا گوشت حلال ہے؟") missed the English document. The embeddings don't match across languages (documented in `PERFORMANCE.md`). | Prompt v2 says to write search queries in English and answer in the customer's language. The Urdu and Roman Urdu questions now find the passage. |

## Checked and found correct

- **Mixed questions** ("Do you cater weddings, and how much is the Chicken Karahi?") give one answer: the database price ($11.50), then the document fact with its source.
- **Asking for the "old menu" price** never brings out the document's $3.00 or $9.00. Prices in passages are replaced before the model sees them.
- **Store facts** (hours, delivery) still come from `get_store_info`.

## Known limits

- Insights counts document "lookups" from `search_documents` calls only. A document found through the FAQ fallback still shows in **top sources**, because those come from the answer's source cards.
- Answer wording is the model's own, so the audit checks for facts, not exact text.
