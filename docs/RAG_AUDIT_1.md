# RAG audit 1: logic and data

Scope (from `RAG_PLAN.md` R5.3): ingest states and races, duplicates, limits, version cleanup, cache invalidation, roles, the activity log, stale detection.
Test: `tests/ragaudit1.js` (11 checks), plus `rag13`, `rag21`, `rag41` and `ragredteam` re-run green.

## Findings and fixes

| # | Area | Finding | Fix |
|---|---|---|---|
| 1 | Stale detection | A **Replace file** interrupted by a server stop was marked `failed`. Search only uses `ready`/`processing` documents, so the old version, which was still fine, stopped answering. The message said "Re-index it", but re-index needs a ready document, so it couldn't work. | `failStale()` puts an interrupted replace back on its serving version (`ready`, the version number restored) and removes the abandoned version's passages. An interrupted first upload still fails, with "Upload the file again". |
| 2 | Duplicates | A failed replace kept the **new file's fingerprint**. Uploading the original file again wasn't caught as a duplicate, and uploading the broken file elsewhere was refused as "already uploaded". | The replace stores `previousSha256`. A failed or interrupted replace restores it. If that original file was uploaded again meanwhile as another document, the restore skips the fingerprint instead of failing. |
| 3 | Test timing | `rag41` read the page before the library usage line loaded, so it failed now and then. | The test waits for the text. |

## Checked and found correct

- **Delete during ingest:** the `deleting` status, plus a re-check before marking ready, mean nothing comes back and no passages are left behind.
- **Replace overtaken by a newer replace:** the older run never marks ready and removes its own passages. Only the newest version's passages remain.
- **Version cleanup:** older versions retire once a new one is ready.
- **Limits:** file size (413), library size, total passages, the per-upload budget share, and 20 uploads per hour per admin (rag21).
  - Two uploads at the same moment can both pass the passage-count check. The overshoot is at most one document, which is within the memory margin, so it was accepted.
- **Cache:** publish, unpublish, delete, replace and re-index all reset the search cache. Unpublishing takes effect on the next search.
- **Roles:** admin and manager only. Editors get 403 and see no menu link (rag21, rag41).
- **Activity log:** `/documents` actions are labelled (R0.1 mapping).
