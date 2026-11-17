# RAG audit 3: UX

Scope (from `RAG_PLAN.md` R5.3):
- the upload flow and its limits;
- status feedback;
- the privacy confirmation;
- replace;
- the test box;
- source chips in the chat;
- mobile and accessibility.

The review was done live. `tests/ragux.js` drives every document surface at 1440, 768 and 360 px, saves screenshots, and checks the layout:
- no sideways page scroll;
- every control on screen;
- the usage line is not cut off;
- no page errors.

## Findings and fixes

| # | Surface | Finding | Fix |
|---|---|---|---|
| 1 | Documents page on phones | The table scrolled sideways inside its box, so the **Published switch and the Replace, Re-index and Delete buttons were off-screen** at 360 px. | Below 600 px each document is a card: title, details, status pills and the error reason, then a row with the switch, a "Published"/"Draft" label and the actions. The table and cards share the same pieces, so they behave the same. |
| 2 | Page toolbar, on every dashboard page | The summary line was forced onto one line, so on phones it was cut off ("4 of 20,000 …"). | It wraps on phones and stays on one line with an ellipsis from 600 px up. |
| 3 | Privacy confirmation | It used the **delete style** (red trash icon, red button) for a non-destructive choice. It also said "1 email addresses, 1 phone numbers". | The shared confirm dialog has a new `warning` style (amber triangle, amber button). Wording now uses the right singular or plural. |
| 4 | Test box | It showed a raw retrieval score ("score 0.638"), which means nothing to staff. | It shows **Strong / Good / Weak match**, using the thresholds calibrated in `PERFORMANCE.md`. |
| 5 | Insights | "What it looked up" showed the internal tool name `search_documents`, and the KPI said "1 messages each". | The bar is labelled **Documents**, and the KPI uses the right plural. |
| 6 | Accessibility | The actions column had an empty header, and the document title button had no visible focus ring. | Added a visually hidden "Actions" header and a focus outline. Every icon button already had an `aria-label` and a tooltip. |
| 7 | Layout bug found while fixing 6 | In MUI `sx`, `width: 1` means **100%**. The hidden label added a page-wide sideways scroll at 768 and 1440 px, which `ragux` caught. | Uses `'1px'`. |

## Checked and found correct

- **Chat source chips** at 1440 and 360 px: the reply names the document, and a "Sources: Catering and Events Guide › Weddings" chip sits under it. The style matches the shop's chip style.
- **Upload card:** shows the file types and size limit, a drag-and-drop area, and the privacy note. A failed upload shows its reason in red under the status.
- **Theme:** the colours, cards (14 px radius), status pills and buttons are the same as the rest of the dashboard. The dashboard has no dark theme, so a dark system setting shows the same light design on every page.
- **Tests:** `rag41`, `rag42`, `aidash51`, `regression`, `settings03`, `aisettings52`, `storeinfo-ui`, `audit63` and `tags11` are green. The shared toolbar and confirm dialog changes are used on every page.
