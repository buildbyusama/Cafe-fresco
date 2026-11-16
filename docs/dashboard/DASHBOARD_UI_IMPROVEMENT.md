# Cafe Fresco Dashboard: UI Improvement Plan

A step-by-step plan to turn the admin dashboard (`cafeFresco-dashboard`) into a modern, consistent, high-quality admin UI. It covers **every route, every section, every card, every button and every action**. Nothing about the business logic changes: the rules, API calls and permissions fixed in [DASHBOARD_AUDIT.md](DASHBOARD_AUDIT.md) stay exactly as they are.

**Stack (do not add a UI framework):** React 18, Vite 6, MUI 6 (`@mui/material`, `@mui/icons-material`), `@tabler/icons-react`, ApexCharts, framer-motion, the Berry template layout. Fonts installed: Inter, Poppins, Roboto.

---

## How to use this document

1. Work **in order**. Module 0 builds the shared pieces every later step uses; doing pages first means doing them twice.
2. For each step, run the **🛠 Master Prompt**. Then run the **🧪 Test Prompt**. Then run the **🔍 Bug-hunt Prompt** and fix what it finds. Re-run the test. Only then move to the next step.
3. A step is finished only when every **✅ Done when** item is true.
4. After each module, run its **Module Gate** and the **UI-SMOKE** below.
5. Log each finished step in [docs/PROGRESS.md](../PROGRESS.md) as `Dashboard UI x.y`.

### 🤖 Rules for every step (paste once per session)
```
You are improving the UI of cafeFresco-dashboard (React 18 + MUI 6 + Berry template).
Rules:
- UI only. Do not change API calls, request bodies, permission checks (src/config/permissions.js),
  route guards or business rules. If a UI change seems to need a logic change, stop and say so.
- Use the shared components from Module 0 (src/ui-component/app/*) and theme tokens. No new inline
  style={{}} for colour, spacing, radius, font or shadow — use the theme (sx with theme values).
- Every user action shows: a busy state on the control that started it, a success or error toast via
  NotifyContext, and a confirm dialog before anything destructive.
- Every data view has 4 states: loading (skeleton), empty (EmptyState), error (ErrorState + Retry),
  and data.
- Keep everything usable at 360px, 768px, 1024px, 1440px and 1920px. No horizontal page scroll
  (tables may scroll inside their own container).
- Keyboard and screen reader: every icon button has an aria-label and a Tooltip; dialogs trap focus;
  contrast is WCAG AA.
- Do not add npm dependencies without saying why. Prefer what is installed.
- After the change: npm run build passes, no new console errors, run the step's Test Prompt.
```

### 🧪 UI-SMOKE (after every module)
```
Log in as admin, manager and editor (accounts in docs/PROGRESS.md). For each role, open every page
in its sidebar at 1440px and at 390px. For each page check: the page header (title, breadcrumb,
primary action) looks the same as other pages; the loading skeleton appears then data; nothing
overlaps; no horizontal page scroll; no console errors; the sidebar highlights the right item.
Report a role × page PASS/FAIL table.
```

---

## Design direction (decide once, apply everywhere)

| Token | Value | Why |
|---|---|---|
| Brand / primary | Cafe Fresco red `#C8102E` (hover `#A50D26`, light `#FDECEF`) | Matches the storefront; passes AA on white text |
| Secondary | Warm amber `#F5A524` (light `#FEF4E2`) | Storefront's yellow `#feeab3` family, used for highlights only |
| Neutrals | Slate scale: background `#F6F7F9`, surface `#FFFFFF`, border `#E6E8EC`, text `#111827` / muted `#6B7280` | Calm, high-contrast admin look |
| Status colours | success `#16A34A`, warning `#D97706`, error `#DC2626`, info `#2563EB` (each with a 10% tint background) | One meaning per colour across all chips and badges |
| Font | **Inter** (already installed): 14px body, 13px table, 600 for headings | Modern dashboards use Inter or a similar neo-grotesk for numeric clarity |
| Numbers | `font-variant-numeric: tabular-nums` in tables and stat cards | Columns of money line up |
| Spacing | 8px grid; page padding 24px desktop / 16px mobile; card gap 24px | Consistent rhythm |
| Radius | 12px cards and dialogs, 8px inputs and buttons, 999px chips | Soft and modern without being playful |
| Elevation | Cards: 1px border + very soft shadow `0 1px 2px rgba(16,24,40,.06)`; no heavy shadows | Flat and clean, like current SaaS dashboards |
| Motion | 150–200ms ease-out for hover, dialogs and drawers; respect `prefers-reduced-motion` | Feels fast |
| Dark mode | Optional (Step 0.8). If done, every token gets a dark value | |
| Icons | Tabler icons only (outline, 1.75 stroke, 18–20px). Remove mixed MUI-icon usage in pages | One icon family |

Research basis for the direction above (re-check if needed): Material 3 guidance on density and tonal surfaces, the current Linear / Vercel / Stripe dashboard patterns (neutral surfaces, single accent colour, tabular numbers, skeleton loading, toasts at the bottom-right), and WCAG 2.2 AA contrast and target size (≥ 24px).

### Action feedback standard (every button, everywhere)

| Action type | While running | On success | On error |
|---|---|---|---|
| Save / create / update (form) | Button shows spinner + "Saving…", whole form disabled | Toast success "Product saved", then navigate or close dialog | Toast error with the server message; field errors inline under each field; form stays filled |
| Delete / cancel / destructive | ConfirmDialog first ("Delete *Latte*? This can't be undone."), confirm button red with spinner | Toast success; row fades out; list refreshes | Toast error with the server message (e.g. 409 "Category has 3 products") |
| Toggle (Active, Featured) | Switch disabled + small spinner; optimistic flip | Quiet toast "Hidden from shop" / "Visible in shop" | Switch flips back; toast error |
| Inline quick action (Send reset link, Mark seen) | Icon button spinner | Toast success | Toast error |
| Page data load | Skeleton of the real layout (not a full-page spinner) | Data | ErrorState card with Retry |
| Search / filter | Debounced 300–400ms; small progress bar under the toolbar; table keeps old rows dimmed | Rows | ErrorState inside the table |
| Upload image | Preview + progress; button disabled | Toast "Image uploaded" | Toast error "Image must be JPG/PNG/WebP under 2 MB" |

Toast rules: bottom-right on desktop, top-centre on mobile; success auto-hides after 3 s, error after 6 s; max 3 stacked; text is a sentence with the object name; never show raw server internals.

---

## Production standards (the measurable bar every step must meet)

### Design tokens (full scale; nothing outside this list)

| Group | Tokens |
|---|---|
| Spacing | 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px (`theme.spacing(n)` with base 4) |
| Radius | xs 4 (tags) · sm 6 (checkbox) · md 8 (inputs, buttons) · lg 12 (cards, dialogs) · xl 16 (drawers' outer corner) · pill 999 |
| Font sizes | 11 · 12 · 13 · 14 · 16 · 18 · 20 · 24 · 28 · 32 (stat values) |
| Line heights | 16 · 20 · 24 · 28 · 32 · 40 |
| Weights | 400 body · 500 labels · 600 headings, buttons · 700 stat values only |
| Elevation | e0 none · e1 card `0 1px 2px rgba(16,24,40,.06)` · e2 menu/popover `0 4px 12px rgba(16,24,40,.08)` · e3 dialog/drawer `0 12px 32px rgba(16,24,40,.12)` |
| Z-index | sidebar 1100 · header 1200 · drawer 1300 · dialog 1400 · popover/menu 1500 · toast 1600 · tooltip 1700 |
| Motion | fast 120ms (hover, toggle) · base 180ms (menus, fade) · slow 240ms (drawers, dialogs); easing `cubic-bezier(.2,0,0,1)`; all disabled under `prefers-reduced-motion` |
| Breakpoints | xs 0 · sm 600 · md 900 · lg 1200 · xl 1536 (MUI defaults; keep them) |
| Content width | page max 1440; forms max 960 (two-column) / 720 (single column); dialogs sm 480 · md 640 · lg 880; drawers 480 / 560 |
| Icon sizes | 16 table actions · 18 buttons/inputs · 20 nav · 24 empty states · 40 stat icon box |

### Component spec sheet

| Component | Spec |
|---|---|
| Button | heights sm 32 / md 36 / lg 44; padding x 12/16/20; icon gap 8; variants: primary (filled red), secondary (outlined neutral), tertiary (text), danger (filled error), ghost icon; loading keeps width (no jump) |
| Input / Select | height 40 (sm 32 in toolbars); label above field (not floating) for forms, placeholder only as example text; helper/error text 12px below; required shown as "*" after label; character counter right-aligned under textarea |
| Table | header 40px, rows 52px (comfortable) / 40px (compact); first column left, numbers right-aligned with tabular-nums, status centered; max 8 visible columns on 1440px, the rest hideBelow; row hover tint; selected row primary.lighter |
| Chip | height 24 (sm 20); status chips always have text, never colour-only; max one chip per cell except tag lists ("+N" overflow) |
| Card | padding 24 (20 below md); header row 56px with title + action; section gap 24 |
| Dialog | title 18/600, body 14, max 1 primary action on the right, Cancel left of it; destructive confirm uses danger button and names the object |
| Drawer | header with title + close; scrollable body; sticky footer actions |
| Toast | 360px max width, icon + one-line title + optional description + optional action (Undo / View); bottom-right desktop, top-center mobile |
| Empty state | 24px icon in 48px tinted circle, title 16/600, one sentence, one primary action |
| Skeleton | same box sizes as final content; table shows 8 rows; cards show value + label bars |
| Tooltip | on every icon-only control and truncated text; delay 400ms |

### Data-table behaviour (all tables)

- **Sorting:** sortable headers with an arrow showing direction; one column at a time. Server sort where the API supports it (products by price, orders by date); otherwise client-side on the loaded page only, with a note in the header tooltip.
- **Density toggle:** Comfortable or Compact, remembered per user in localStorage.
- **Column visibility menu:** "Columns" button, choices remembered per table.
- **Sticky header** inside the table container. On screens below md the first column is sticky when the table scrolls horizontally.
- **Truncation:** long text gets an ellipsis, with a tooltip showing the full value.
- **Row click vs. actions:** clicking a row opens details or edit; the action buttons stop the click from reaching the row.
- **Selection** (only where a bulk action exists): a checkbox column and a bulk bar ("3 selected · Activate · Deactivate · Clear"). Bulk actions call the existing single-item endpoints in sequence with a progress toast. No new endpoints.
- **Export CSV** of the rows currently loaded or filtered (client-side only, no new endpoint) on Products, Orders, Users, Inventory, Employees, Suppliers and Distributors.
- **URL state:** page, page size, sort, filters and search live in the query string.
- **Result count** in the toolbar ("52 orders"). After a create, edit or delete, keep the current page and scroll position.

### Wording and microcopy rules

- **Sentence case everywhere**, e.g. "Add product", not "Add Product" or "ADD PRODUCT".
- **Buttons are verb + object:** "Save product", "Delete category", "Send reset link". Never "Submit" or "OK".
- **Toasts say what happened to which item:** "Latte saved", "Order #A1B2C3 marked completed", "Couldn't delete Pastries: 3 products use it".
- **Errors explain what to do next:** "Discount must be between 1 and 100". Never "Invalid input". Never show stack traces or "Internal Server Error".
- **Empty states say why the list is empty and what to do:** "No products yet. Add your first product to start selling."
- **Confirm dialogs name the item and the consequence:** "Delete Latte? Customers will no longer see it. This can't be undone."
- **Use the same word for the same thing everywhere:** Products (not items), Orders, Customers (not users) in the UI, Team (admins), Discount codes, Stock.
- **Dates and money** always go through `utils/format.js`. The currency symbol never sits next to a raw number.

### Performance and quality budgets (production build)

| Metric | Budget |
|---|---|
| Lighthouse Performance (desktop, `vite preview`) | ≥ 90 Dashboard, Products, Orders |
| Lighthouse Accessibility | ≥ 95 every screen |
| Lighthouse Best Practices | ≥ 95 |
| LCP | < 2.0 s on desktop, < 3.0 s on mid-range mobile (Fast 4G) |
| INP | < 200 ms for toggles, filters and dialog opens |
| CLS | < 0.05 (skeletons match layout) |
| Initial JS (gzip) | < 300 kB; each page chunk < 120 kB; charts loaded only on the dashboard |
| Console | 0 errors and 0 React warnings on every screen |
| Table with 50 rows | scroll at 60 fps, filter response < 100 ms after debounce |

### Global Definition of Done (applies to every step on top of its own "Done when")

0. Every ✗ in that screen's row of the **Gap audit** table is closed. The screen uses the Step 0.15 loading pieces and the Step 0.16 filters listed for it.

1. Uses tokens and shared components only (no new `style={{}}` for design values).
2. All states from Appendix C exist and were seen working.
3. Every action follows the Action feedback standard.
4. Works at 360, 390, 768, 1024, 1440 and 1920 with no page-level horizontal scroll.
5. Keyboard-only use works, focus is visible, and the screen reader names every control.
6. Wording follows the microcopy rules.
7. `npm run build` passes, there are no console errors, and the step's Test Prompt and Bug-hunt Prompt pass.
8. Role behaviour is unchanged: admin, manager and editor each see exactly what `permissions.js` allows.
9. Visual regression screenshots are updated (Step 16.7) and reviewed.
10. The step is logged in `docs/PROGRESS.md`.

---

## Module order

| Module | Covers |
|---|---|
| 0 | Foundation: theme tokens, shared components, feedback system |
| 1 | App shell: sidebar, header, notifications, profile menu, breadcrumbs, footer, customization drawer |
| 2 | Auth pages: Login, Forgot password, Reset password |
| 3 | Dashboard home and every card/chart |
| 4 | Products: All, Add, Edit |
| 5 | Categories: All, Add, Edit |
| 6 | Inventory |
| 7 | Orders: list, filters, details drawer, status dialog |
| 8 | Users and order history |
| 9 | Permissions (admin roles) |
| 10 | Discount codes |
| 11 | Employees: list, add, edit |
| 12 | Departments |
| 13 | Suppliers: list, add, edit |
| 14 | Distributors |
| 15 | Error and redirect pages (404, Access denied) |
| 16 | Global polish: responsive, accessibility, dark mode, performance, final consistency audit |

**Table features per list page** (built in Step 0.11; each page's step must turn on its row):

| Page | Sort | Density/Columns | Export CSV | Bulk actions | Auto-refresh | Undo toggles |
|---|---|---|---|---|---|---|
| Products | price (server), name, stock | ✓ | ✓ | Activate / Deactivate | — | Active, Featured |
| Categories | name | ✓ | — | — | — | — |
| Inventory | stock, name | ✓ | ✓ | — | — | — |
| Orders | date (server), total | ✓ | ✓ | Mark completed / Mark paid (COD) | ✓ 60s + new-orders pill | — |
| Users | name, joined | ✓ | ✓ | — | — | — |
| Team access | name, role | — | — | — | — | — |
| Discount codes | expiry, usage | ✓ | — | — | — | — |
| Employees | name, department, hire date | ✓ | ✓ | — | — | — |
| Departments | name, employees | — | — | — | — | Active |
| Suppliers | name | ✓ | ✓ | Activate / Deactivate | — | Active |
| Distributors | name, suppliers | ✓ | ✓ | — | — | — |
| Dashboard | — | — | — | — | ✓ 60s cards + latest orders | — |

### Gap audit of the current code (scanned 2026-10-31)

What each screen has **today**, and what it must have after its step. ✗ = missing today.

| Screen | Loading today | Skeleton | Search | Filters | Busy buttons | Must add |
|---|---|---|---|---|---|---|
| Login | spinner only | ✗ | — | — | ✗ | LoadingButton, alert slide-in |
| Forgot password | ✗ | ✗ | — | — | ✗ | LoadingButton, success panel animation, resend countdown |
| Reset password | ✗ | ✗ | — | — | ✗ | LoadingButton, strength bar animation, expired state |
| Dashboard | ✓ | ✓ (template) | — | ✗ period | ✗ refresh | New StatCard skeletons, count-up numbers, chart draw-in, period filter, refresh spinner |
| All Products | ✓ text | ✗ | ✓ | ✓ category, sort | ✗ toggle/delete | Table skeleton, Status + Stock + Featured + Discounted filters, filter chips, busy toggles |
| Add Product | ✗ | — | — | — | ✓ | Upload progress, category dropdown loading, Save spinner + success check |
| Edit Product | ✓ | ✗ | — | — | ✓ | Form skeleton, image fade-in |
| All Categories | ✓ | ✗ | ✗ | ✗ | ✗ | Search, sort, "Has products / Empty" filter, table skeleton, busy delete |
| Add Category | ✓ | — | — | — | ✗ | Save spinner, upload progress |
| Edit Category | ✓ | ✗ | — | — | ✗ | Form skeleton, Save spinner |
| Inventory | ✓ | ✗ | ✓ | ✓ category, stock | ✓ | Summary-card skeletons, All/Low/Out segmented filter, Active/Inactive filter, row flash on update |
| Orders | ✓ | ✗ | ✓ | ✓ status, payment, month, year | ✓ | Table + drawer skeletons, Payment method filter (Card/COD), amount range, "Refund due" quick filter, date-range picker, filter chips |
| Users | ✓ | ✗ | ✓ | ✓ | ✗ | Joined date-range filter, "Has orders" filter, history drawer skeleton |
| Team access | ✓ | ✗ | ✗ | role select only | ✗ | Search, Role filter chips, busy on reset link / delete / role change |
| Discount codes | ✓ | ✗ | ✗ | ✗ | ✗ | Search by code, Status filter (Active/Expired/Used up/Inactive), sort by expiry, busy dialog save/delete |
| Employee list | ✓ | ✗ | ✓ | ✓ department | ✗ | Status filter, hire-date range, table skeleton, busy delete |
| Add / Edit Employee | edit only | ✗ | — | — | ✓ | Form skeleton (edit), department dropdown loading |
| Departments | ✓ | ✗ | ✗ | ✗ | ✗ | Search, Active/Inactive filter, card skeletons, busy dialog save/delete |
| Supplier list | ✓ | ✗ | ✗ | ✓ supplies, distributor, active | ✗ | Search by name/email/phone, table skeleton, busy toggle/delete |
| Add / Edit Supplier | edit only | ✗ | — | — | ✗ | Save spinner, form skeleton (edit), distributor dropdown loading |
| Distributors | ✓ | ✗ | ✓ | ✓ category, active | ✗ | Table skeleton, busy drawer save/delete |
| Notifications panel | ✓ | ✗ | — | ✗ | ✗ | List skeleton, All/Unread tabs, busy mark-all |
| 404 / Access denied | — | — | — | — | — | Entrance animation, illustration |

Each page step below must close every ✗ in its row. Step 16.4 re-checks this table.

**Page checklist (25 screens — tick each in its step):**
`/admin/login` · `/admin/forget-password` · `/admin/reset-password/:token` · `/admin/dashboard` · `/admin/all-product` · `/admin/add-product` · `/admin/edit-product/:id` · `/admin/all-category` · `/admin/add-category` · `/admin/edit-category/:id` · `/admin/all-inventory` · `/admin/all-order` (+ details + status dialog) · `/admin/all-user` (+ history dialog) · `/admin/all-permission` (+ add + edit dialogs) · `/admin/discount-code` (+ add/edit dialog) · `/admin/employees/list` · `/admin/employee/add` · `/admin/edit-employee/:id` · `/admin/departments` (+ dialog) · `/admin/suppliers` · `/admin/supplier/add` · `/admin/edit-supplier/:id` · `/admin/distributors` (+ dialog) · `/admin/access-denied` · `*` Not found.

---

# Module 0 — Foundation

### Step 0.1 Theme tokens
**Problem:** Colours, radius, fonts and shadows come from the Berry template defaults (purple/blue primary, Roboto) and from 112 inline `style={{}}` blocks across `views/pages`. Pages look like different products.
**Target:** One theme in `src/themes` that encodes the Design direction table: palette (primary red, secondary amber, slate neutrals, status colours with tints), typography (Inter, sizes h1–h6, body1/2, caption, overline, `tabular-nums` helper), shape (radius 12/8), shadows (two soft levels), component overrides.

**🛠 Master Prompt**
```
In cafeFresco-dashboard/src/themes and src/config.js: replace the template palette with the Cafe
Fresco tokens from docs/dashboard/DASHBOARD_UI_IMPROVEMENT.md "Design direction" (primary #C8102E,
secondary #F5A524, slate neutrals, success/warning/error/info + 10% tints as palette.*.lighter).
Set fontFamily to Inter (import @fontsource/inter 400/500/600/700 in index.jsx; remove Roboto/Poppins
imports if unused). Typography: h1 28/600, h2 24/600, h3 20/600, h4 18/600, h5 16/600, h6 14/600,
body1 14, body2 13, caption 12, overline 11/600 letter-spacing .06em; add theme.typography.numeric
= { fontVariantNumeric: 'tabular-nums' }. shape.borderRadius 8; add theme.custom.radiusCard 12.
Background default #F6F7F9, paper #FFFFFF, divider #E6E8EC. Keep the existing mode/preset plumbing
working. Do not touch pages yet.
```
**🧪 Test Prompt**
```
Build. Open Login, Dashboard and All Products: primary buttons are red #C8102E with white text,
font is Inter (DevTools computed style), page background #F6F7F9, cards white. Check contrast of
primary button text (≥ 4.5:1) and muted text on background (≥ 4.5:1). Report.
```
**🔍 Bug-hunt Prompt**
```
Grep src for the old template hex colours (#673ab7, #5e35b1, #2196f3, #1e88e5, #ede7f6, #e3f2fd)
and for 'Roboto' / 'Poppins'. List every remaining hit with file:line and whether it is visible.
Check Chip, Button, Avatar overrides still render (no white-on-white). Report.
```
**✅ Done when:** one palette and one font everywhere; no template purple/blue left visible.

---

### Step 0.2 Component overrides
**Problem:** MUI defaults and template overrides mix: buttons of different heights, inputs with different radii, tables with heavy borders, dialogs with sharp corners.
**Target:** `themes/compStyleOverride.jsx` defines the look of Button (36px, 8px radius, no uppercase, 600), IconButton (36px, tooltip-friendly), TextField/OutlinedInput (40px, 8px radius, clear focus ring in primary), Select, Switch (brand colour), Chip (pill, tinted status variants), Card/Paper (12px radius, 1px border, soft shadow), Table (header row: overline style on `#F9FAFB`, 52px rows, hover tint, no vertical borders), Dialog (12px radius, 24px padding, title 18/600, actions right-aligned), Tooltip (dark, 12px), Skeleton (rounded), LinearProgress (2px brand), Alert (tinted, 8px radius), Pagination (rounded), Tabs (underline indicator).

**🛠 Master Prompt**
```
In src/themes/compStyleOverride.jsx write MUI 6 styleOverrides/defaultProps for: MuiButton
(disableElevation, textTransform none, fontWeight 600, minHeight 36, borderRadius 8, sizes small 32
/ large 44), MuiIconButton, MuiOutlinedInput (borderRadius 8, height 40, focus ring 3px primary
.lighter), MuiInputLabel, MuiSelect, MuiSwitch (checked = primary), MuiChip (borderRadius 999,
fontWeight 600, height 24; add variants status-success/warning/error/info/neutral using tints),
MuiCard + MuiPaper (radius 12, border 1px divider, shadow '0 1px 2px rgba(16,24,40,.06)'),
MuiTableHead/MuiTableCell (head: 12px uppercase 600 muted on #F9FAFB; body: 13px, 52px rows,
borderBottom divider), MuiTableRow (hover bg #F9FAFB), MuiDialog (radius 12), MuiDialogTitle,
MuiDialogContent, MuiDialogActions (padding 16 24, gap 8), MuiTooltip (arrow, 12px), MuiSkeleton
(radius 8, wave), MuiLinearProgress (height 2), MuiAlert (radius 8, tinted standard variants),
MuiPagination, MuiTabs. Use theme tokens only.
```
**🧪 Test Prompt**
```
On All Products, Orders and any dialog: buttons are 36px with no uppercase; inputs 40px; table head
is the light grey overline style; rows 52px with hover tint; dialogs rounded 12px; chips are pills.
Screenshot-compare 3 pages: they look like one product. Report.
```
**🔍 Bug-hunt Prompt**
```
Find components that override these looks locally (sx/style with borderRadius, height, fontWeight,
textTransform, border on Table*) in views/pages and list them; those will be removed in their page
step. Check focus ring visibility on every input type (text, select, date, number). Report.
```
**✅ Done when:** every MUI primitive has one look defined in the theme.

---

### Step 0.3 Shared layout components
**Problem:** Every page builds its own header row, search box, table and empty message; spacing, titles and button positions differ page to page.
**Target:** New folder `src/ui-component/app/` with:

| Component | Purpose |
|---|---|
| `PageHeader` | Title, optional subtitle, breadcrumbs, right-side actions (primary button + secondary), optional tabs. Sticky on scroll on desktop. |
| `PageContainer` | Max width 1440, page padding, vertical gap 24 |
| `SectionCard` | Card with title, optional description, optional action, body padding 24 |
| `Toolbar` | Search field (with icon + clear), filter selects, filter chips with "Clear all", right-side actions; wraps on mobile |
| `DataTable` | Columns config, sticky header, row hover, row actions menu, selection (optional), loading skeleton rows, empty and error slots, server pagination footer (rows per page + range "1–10 of 52"), horizontal scroll inside its own container, mobile card-list fallback below 768px |
| `StatusChip` | Maps a status string to the status colour (pending/completed/cancelled, paid/unpaid, active/inactive, in stock/low/out) |
| `EmptyState` | Icon, title, text, optional action button |
| `ErrorState` | Message + Retry |
| `ConfirmDialog` | Title, message, danger variant, confirm spinner (wraps NotifyContext confirm) |
| `FormSection` | Two-column form block: label/description on the left, fields on the right (stacks on mobile) |
| `FormActions` | Sticky bottom bar on long forms: Cancel / Save with busy state and "Unsaved changes" hint |
| `LoadingButton` | Button with `loading` prop (spinner + label) |
| `StatCard` | Icon, label, value (tabular), delta chip, sparkline slot, skeleton |
| `ImageUpload` | Drop zone + preview + replace/remove + validation message |
| `MoneyText`, `DateText` | Format via `utils/format.js` |

**🛠 Master Prompt**
```
Create src/ui-component/app/ with the components in the Step 0.3 table, using only MUI + theme
tokens + Tabler icons. DataTable API: <DataTable columns={[{field, header, width, align, render,
hideBelow:'md'}]} rows loading error onRetry empty={{title,text,action}} rowKey="_id"
rowActions={(row)=>[{label, icon, onClick, color, disabled, hidden}]} pagination={{page,
pageSize, total, onPageChange, onPageSizeChange}} mobileCard={(row)=>node} />. Loading renders 8
skeleton rows matching column widths. Below 768px render mobileCard list if provided. Row actions:
up to 2 visible icon buttons with tooltips, the rest in a "⋯" menu. Export everything from
src/ui-component/app/index.js. Add a short JSDoc on each component. Do not migrate pages yet.
```
**🧪 Test Prompt**
```
Create a temporary route /admin/ui-kit (admin only, removed at Step 16.5) that renders every shared
component in all states (loading, empty, error, data, disabled, busy). Check at 1440 and 390px.
Keyboard: Tab through toolbar, table actions, pagination, dialog. Report.
```
**🔍 Bug-hunt Prompt**
```
Review the shared components for: missing aria-labels on icon buttons, focus lost after closing a
dialog or menu, DataTable layout shift between loading and data, pagination off-by-one (page 0 vs
1), mobile card list missing the row actions, long text not truncating with a tooltip. Report.
```
**✅ Done when:** every page step can be built only from these components.

---

### Step 0.4 Feedback system (toasts, confirm, busy)
**Problem:** `NotifyContext` exists, but pages mix toast calls, MUI Snackbars and silent failures; some buttons can be double-clicked; deletes use different confirm texts.
**Target:** One API: `notify.success(msg)`, `notify.error(msg | error)`, `notify.info(msg)`, `notify.promise(promise, {loading, success, error})`, `confirm({title, message, confirmLabel, danger})`. A `useAction(fn, {success, error, confirm})` hook that sets busy state, prevents double submit, shows confirm/toasts and returns `{run, busy}`. Toast placement and timing follow the standard above.

**🛠 Master Prompt**
```
Extend src/contexts/NotifyContext.jsx: notify.success/error/info/warning, notify.promise, error
accepts an apiFetch result or Error and extracts data.message (never raw stack); max 3 toasts,
success 3s, error 6s, bottom-right ≥ md, top-center < md, close button, role="status"/"alert".
confirm() returns a Promise<boolean>, supports danger (red confirm), shows a spinner on the confirm
button while the caller's promise runs if passed {onConfirm}. Add src/hooks/useAction.js:
const {run, busy} = useAction(async (...args)=>{...}, {confirm?, success?, error?}) — ignores calls
while busy. Document both in a comment block at the top of each file.
```
**🧪 Test Prompt**
```
On /admin/ui-kit: trigger success, error, info, promise and confirm (cancel and confirm). Double-
click a useAction button 5 times fast → one call. Error from a fake 409 shows the server message.
Mobile shows toasts top-center. Screen reader announces toasts. Report.
```
**🔍 Bug-hunt Prompt**
```
Grep views/ and layout/ for Snackbar, alert(, window.confirm, console.log, enqueueSnackbar,
setOpenSnackbar and any toast call not going through NotifyContext; list them with file:line for
migration in their page steps. Report.
```
**✅ Done when:** one toast look, one confirm look, no double submits possible through `useAction`.

---

### Step 0.5 Loading skeletons and page transitions
**Problem:** Pages show a full-screen spinner or a blank area while loading, then jump.
**Target:** Every page shows a skeleton of its real layout (header + toolbar + table rows / form sections / stat cards). Route changes show the 2px top progress bar (`Loader`) and a 150ms fade-in of the content. `prefers-reduced-motion` disables the fade.

**🛠 Master Prompt**
```
Add skeleton variants to PageHeader (title bar), Toolbar, DataTable (rows), SectionCard (form
fields), StatCard. Update ui-component/Loader to a 2px LinearProgress in primary at the top of the
viewport. Wrap MainLayout's <Outlet/> in a framer-motion fade (opacity 0→1, 150ms) that is skipped
when prefers-reduced-motion is set. No page migrations yet.
```
**🧪 Test Prompt**
```
Throttle network to Slow 3G and open three pages: skeleton matches final layout (no jump bigger
than 8px; measure CLS in Performance panel < 0.05). Reduced motion on → no fade. Report.
```
**🔍 Bug-hunt Prompt**
```
Find every CircularProgress / "Loading..." text used as a whole-page loader in views/ and list
them for replacement. Check the top progress bar never stays visible after a failed lazy import.
Report.
```
**✅ Done when:** no page uses a full-screen spinner for its data.

---

### Step 0.6 Formatting helpers
**Problem:** Money, dates and numbers are formatted differently across pages (`$12`, `12.00`, `2026-10-28T…`).
**Target:** `utils/format.js` exports `formatMoney`, `formatNumber`, `formatDate` (`29 Oct 2026`), `formatDateTime` (`29 Oct 2026, 14:05`), `formatRelative` (`5 min ago`), `shortId` (`#A1B2C3`). All tables and cards use them through `MoneyText`/`DateText`.

**🛠 Master Prompt**
```
Extend src/utils/format.js with the helpers above using Intl (currency from VITE_CURRENCY, default
USD; dates in the browser locale but day-month-year order). Add unit-style examples in a comment.
MoneyText/DateText use them and apply tabular-nums.
```
**🧪 Test Prompt**
```
Check formatMoney(0), (8.5), (1234.5), formatDate of a UTC midnight date in a UTC+5 browser,
formatRelative for 30s, 5min, 3h, 2d, shortId of an ObjectId. Report results.
```
**🔍 Bug-hunt Prompt**
```
Grep views/ for toFixed(, toLocaleString(, new Date( used in JSX and for '$' string concatenation;
list each for replacement in its page step. Report.
```
**✅ Done when:** one format for every money value and date.

---

### Step 0.7 Icon and illustration set
**Problem:** Pages mix MUI icons, Tabler icons and emoji-like glyphs; empty states have no visuals.
**Target:** Tabler only, 20px in menus, 18px in buttons, 16px in table actions; a fixed icon per concept (product `IconPackage`, category `IconCategory`, inventory `IconBuildingWarehouse`, order `IconReceipt`, user `IconUsers`, role `IconShieldLock`, discount `IconDiscount2`, employee `IconId`, department `IconBuildingCommunity`, supplier `IconTruckDelivery`, distributor `IconTruck`, edit `IconPencil`, delete `IconTrash`, view `IconEye`, more `IconDots`). Empty states use the concept icon inside a tinted circle.

**🛠 Master Prompt**
```
Create src/ui-component/app/icons.js exporting the concept→Tabler icon map above. Replace icons in
menu-items/*.js with the map. List (do not yet change) every @mui/icons-material import in views/.
```
**🧪 Test Prompt**
```
Sidebar shows one consistent icon style; sizes are 20px; no missing icons. Report.
```
**🔍 Bug-hunt Prompt**
```
List icon-only buttons in the app without aria-label or Tooltip. Report.
```
**✅ Done when:** one icon family with a fixed meaning per icon.

---

### Step 0.8 (optional) Dark mode
**Target:** A light/dark toggle in the profile menu, persisted in localStorage, defaulting to the OS setting. Every token has a dark value (surface `#111827`, background `#0B0F17`, border `#1F2937`, text `#F3F4F6`). Charts switch theme.

**🛠 Master Prompt**
```
Add dark values for all tokens in the theme; ConfigContext gets mode ('light'|'dark'|'system')
persisted in localStorage; toggle in ProfileSection. ApexCharts options read theme.palette.mode.
```
**🧪 Test Prompt**
```
Switch modes on every page of the checklist; check contrast AA in dark mode and that no white
boxes remain (inline styles). Report a page × mode table.
```
**🔍 Bug-hunt Prompt**
```
Grep for hard-coded '#fff', 'white', '#000', 'black' in views/ and layout/. Report.
```
**✅ Done when:** every page is readable in both modes (or the step is explicitly skipped).

### Step 0.9 Base cards and unused template components
**Problem:** `MainCard`, `SubCard` and `CardSecondaryAction` (`src/ui-component/cards`) frame 13 page files with template padding, title sizes and a divider style that don't match the new SectionCard. Several template components are not used anywhere: `extended/Accordion`, `extended/AppBar`, `extended/ImageList`, `extended/Form/FormControl`, `extended/Form/FormControlSelect`, `extended/Form/InputLabel`.
**Target:** MainCard and SubCard restyled to the card tokens (12px radius, 1px border, 24px padding, title h4/600, optional subtitle, optional action slot, no heavy divider) so every page that still uses them looks right before its own step; CardSecondaryAction becomes a small IconButton with tooltip; AnimateButton keeps a subtle 0.98 press scale only; Transitions use 150ms; unused components deleted.

**🛠 Master Prompt**
```
Restyle src/ui-component/cards/MainCard.jsx, SubCard.jsx and CardSecondaryAction.jsx to the card
tokens above, keeping their props API so existing pages don't break. Restyle extended/AnimateButton
(scale .98 on press, respects reduced motion), extended/Transitions (150ms), extended/Avatar and
extended/Breadcrumbs (theme tokens). Grep for imports of Accordion, AppBar, ImageList,
Form/FormControl, Form/FormControlSelect, Form/InputLabel; delete the ones with zero imports.
```
**🧪 Test Prompt**
```
Open every page that imports MainCard/SubCard (grep list): card radius, border, padding and title
size match SectionCard; nothing broke; build passes. Report deleted files.
```
**🔍 Bug-hunt Prompt**
```
Check MainCard `content={false}` users (tables inside cards) keep zero padding; check dark mode
(if done) for MainCard backgrounds. Report.
```
**✅ Done when:** one card look everywhere; no unused template components left.

---

### Step 0.10 Global states: session, expiry, shared lists, offline
**Problem:**
- While `MainContext` checks the session (`sessionStatus: 'loading'`), guarded pages can flash empty.
- When the session expires, `api/client.js` reports a 401 and the app returns to login with no explanation.
- The shared lists in `views/context/index.jsx` (categories, departments, distributors) feed dropdowns on Products, Inventory, Employees, Suppliers and Distributors. Their loading and errors are silent, so a dropdown can be empty with no reason.
- Nothing tells the admin when the network or backend is down.

**Target:**
- **Session check:** the top progress bar plus a centered logo skeleton (never a blank screen or flash of the login page).
- **Session expired (401):** toast "Your session expired. Please sign in again.", then redirect to `/admin/login?next=<current page>`, keeping unsaved form drafts in sessionStorage where the form supports it.
- **Shared lists:** expose `{data, status, error, reload}` for each list. Dropdowns show a loading row, and on error show "Couldn't load categories · Retry".
- **Offline banner:** a thin warning bar under the header when `navigator.onLine` is false or 3 requests fail in a row with a network error. It disappears on recovery with a toast "Back online".

**🛠 Master Prompt**
```
In views/context/index.jsx expose status/error/reload for categories, departments and distributors
(keep existing names working). Add a SharedSelect wrapper (src/ui-component/app) that shows
loading/error+retry states for these lists and use it wherever those dropdowns appear (product
add/edit/list filter, inventory filter, employee forms/list filter, supplier forms/list filter,
distributor filter/form). In AdminRoutes/HomeRedirect render Loader + logo skeleton while
sessionStatus==='loading'. In the 401 handler: toast "Your session expired…" once, then navigate
to /admin/login?next=<path+query>. Add an OfflineBanner in MainLayout.
```
**🧪 Test Prompt**
```
Hard refresh any page → no login flash. Delete the adminToken cookie then click any action → toast
+ redirect with next → login returns to the page. Stop the backend → offline/connection banner and
dropdowns show Retry; start it → banner gone, Retry works. Report.
```
**🔍 Bug-hunt Prompt**
```
Several parallel 401s → only one toast and one redirect; login page itself never shows the expired
toast in a loop; banner doesn't cover the header on mobile. Report.
```
**✅ Done when:** no silent session or network failure anywhere.

---

### Step 0.11 Data-table power features
**Problem:** Tables only show rows. Admins can't sort most columns, choose columns, change density, export, or act on several rows at once.
**Target:** Every item in the "Data-table behaviour" standard is built into the shared `DataTable` and `Toolbar`, so each page only turns features on.

**🛠 Master Prompt**
```
Extend src/ui-component/app/DataTable + Toolbar with: sortable headers (sortField/sortDir props,
server or client mode), density toggle (persisted per tableId in localStorage), column visibility
menu (persisted), sticky header + sticky first column below md, truncation with tooltip, optional
selection with a BulkBar (actions call a provided per-row async fn sequentially with a progress
toast "Activating 3 of 5…" and a final summary toast), Export CSV of current rows (columns as
shown, values formatted, filename "<table>-YYYY-MM-DD.csv", UTF-8 BOM for Excel), result count,
and keep page/scroll after mutations. Document props in JSDoc. Showcase all on /admin/ui-kit.
```
**🧪 Test Prompt**
```
On /admin/ui-kit: sort both ways, change density and columns then reload (persisted), select rows
and run a fake bulk action with one failing row (summary toast "4 updated, 1 failed"), export CSV
and open it in Excel (accents and currency correct). Report.
```
**🔍 Bug-hunt Prompt**
```
Selection cleared on page change? (it should be, with a toast if rows were selected); CSV escapes
commas/quotes/newlines; hidden columns excluded from CSV; sort + pagination combination correct.
Report.
```
**✅ Done when:** every table can turn on these features with props alone.

---

### Step 0.12 Undo, optimistic updates and data freshness
**Problem:** Reversible actions (Active toggle, Featured, supplier active) can't be undone. Lists go stale while an admin keeps a page open, e.g. new orders never appear.
**Target:**
- **Undo for reversible toggles:** the success toast includes an "Undo" action for 6 s, which calls the same endpoint with the previous value. Deletes have no undo, because they are permanent on the server; they keep the confirm dialog.
- **Optimistic updates:** for toggles only. They roll back on error.
- **Data freshness:**
  - A `useAutoRefresh(fetchFn, {interval: 60000, pauseWhenHidden: true})` hook.
  - The Orders list and dashboard cards refresh silently.
  - When new orders arrive, a "3 new orders · Show" pill appears above the table instead of rows jumping.
  - A "Updated 1 min ago" caption next to the Refresh button.

**🛠 Master Prompt**
```
Add notify action support (label + onClick) and an undoable() helper in useAction for toggles. Add
src/hooks/useAutoRefresh.js (interval, pause when document.hidden, no overlap, exposes
lastUpdated). Add a NewItemsPill component for DataTable. Wire on Dashboard (cards + latest
orders) and Orders list. No new endpoints.
```
**🧪 Test Prompt**
```
Toggle a product Active → toast with Undo → Undo restores both UI and DB. Place an order in the
shop while Orders is open → within 60s the pill appears; clicking it shows the order on top.
Switch tab away → no requests while hidden. Report.
```
**🔍 Bug-hunt Prompt**
```
Undo after navigating away still works or is safely ignored; auto-refresh doesn't reset filters,
selection, scroll or an open drawer; no duplicate rows. Report.
```
**✅ Done when:** reversible actions are undoable and long-open pages stay current without jumping.

---

### Step 0.13 Keyboard shortcuts
**Target:**
| Shortcut | Action |
|---|---|
| `/` | Focus the page search |
| `N` | Primary "Add …" action on list pages |
| `Ctrl/⌘ + K` | Quick jump (Step 1.2) |
| `Ctrl/⌘ + S` | Save the current form |
| `Esc` | Close dialog or drawer |
| `?` | Shortcuts help dialog |

Shortcuts are ignored while typing in inputs (except Ctrl+S and Esc), and the help dialog lists only the shortcuts that work on the current page.

**🛠 Master Prompt**
```
Add src/hooks/useShortcuts.js and a ShortcutsDialog; register page-level shortcuts in PageHeader
(primary action) and FormActions (save); global ones in MainLayout.
```
**🧪 Test Prompt**
```
Each shortcut on Products list, Add product and Orders; typing "n" in search doesn't open Add;
? lists only available shortcuts. Report.
```
**🔍 Bug-hunt Prompt**
```
Conflicts with browser shortcuts (Ctrl+S save page must be prevented only on forms); Mac ⌘ works.
Report.
```
**✅ Done when:** power users can drive the main flows from the keyboard.

---

### Step 0.14 Form UX standard
**Target:** One behaviour for all forms:
- **Validation timing:** on blur for each field, all fields on submit, and focus scrolls to the first error.
- **Required fields** are marked. Optional fields say "(optional)".
- **Numbers:** inputs block letters and "e", and show their unit (`$`, `%`, `pcs`).
- **Save button:** disabled until the form has changes (edit forms).
- **Unsaved changes:** a guard on route change and tab close. On "Add" forms a draft is kept in sessionStorage and restored with a "Draft restored · Discard" banner.
- **Server field errors** are mapped onto their fields.
- **Success:** a toast plus a sensible next step. "Add" forms offer "Save & add another".

**🛠 Master Prompt**
```
Create src/hooks/useForm.js (values, errors, touched, dirty, validateField, validateAll,
setServerErrors(fields), reset) using the existing validation rules per form, plus
useUnsavedGuard(dirty) and useDraft(key). FormActions gets "Save & add another" (optional prop).
Show usage on /admin/ui-kit.
```
**🧪 Test Prompt**
```
On the ui-kit demo form: blur errors, submit focuses first error, server field errors map, dirty
guard on navigation and reload, draft restore and discard, Save & add another resets with toast.
Report.
```
**🔍 Bug-hunt Prompt**
```
Draft leaking between different records; guard firing after a successful save; numeric fields
with comma decimals. Report.
```
**✅ Done when:** every form step in Modules 4–14 can use this standard unchanged.

---

### Step 0.15 Loading and motion kit
**Problem:** Only the dashboard has skeletons. Other pages show text such as "Loading…", a spinner, or nothing. Buttons give no sign of progress, and content pops in abruptly.
**Target:** a set of loading and animation pieces, all built on framer-motion (already installed) and MUI, all switched off under `prefers-reduced-motion`.

| Piece | Where | Behaviour |
|---|---|---|
| Top route progress bar | every route change and lazy load | 2px red bar, appears after 150ms (no flicker on fast loads) |
| Page fade-in | every page | content fades and slides up 4px over 180ms |
| Skeletons with shimmer | every table, form, card, drawer, dropdown, notification list | wave animation, boxes the same size as the real content |
| Inline refetch bar | tables while filtering, searching or paging | 2px bar under the toolbar; old rows dimmed to 60%, not removed |
| LoadingButton | every submit, save, delete, confirm and send | spinner replaces the icon, label changes to "Saving…", width stays fixed |
| Success check | after Save on forms | button briefly shows a ✓ for 800ms before navigating |
| Count-up numbers | stat cards, inventory summary, usage counts | numbers animate from the previous value over 600ms |
| Chart draw-in | dashboard charts | bars and lines animate on first load only |
| Row enter/exit | tables after create/delete | new row highlighted (primary.lighter fading out over 1.5s); deleted row fades and collapses over 200ms |
| Row flash | inventory adjust, order status change, toggles | 1s tint on the changed row |
| Image blur-up | product/category thumbnails and previews | grey box, then the image fades in; placeholder on error |
| Upload progress | ImageUpload | a percentage ring over the preview |
| Toggle spinner | Active/Featured switches | small spinner beside the switch while saving |
| Dropdown loading | shared dropdowns (categories, departments, distributors) | "Loading…" row with a spinner; error row with Retry |
| Empty-state entrance | EmptyState | icon scales from 0.9 to 1 with a fade |
| Toast motion | toasts | slide in from the right on desktop, from the top on mobile |
| Drawer/dialog motion | all overlays | 240ms slide or scale with a backdrop fade |
| Hover micro-interactions | cards, rows, nav items | 120ms background tint; cards lift 1px with the e2 shadow when clickable |
| Notification bell | new notification arrives | bell shakes once and the badge pops |

**🛠 Master Prompt**
```
Create src/ui-component/app/motion/ with: RouteProgress (delayed 150ms), PageFade, TableSkeleton,
FormSkeleton, CardSkeleton, ListSkeleton, InlineRefetchBar, LoadingButton (with success state),
CountUp, RowHighlight (enter/exit/flash via framer-motion AnimatePresence), BlurImage,
UploadProgress, SwitchWithBusy, SelectLoadingState, BellShake. Read a single
useReducedMotion() to disable motion. Integrate into DataTable (refetch bar, dimmed rows,
enter/exit/flash by rowKey), SectionCard (skeleton prop), StatCard (CountUp), ImageUpload,
EmptyState. Show every piece on /admin/ui-kit with a "simulate slow network" toggle.
```
**🧪 Test Prompt**
```
On /admin/ui-kit with slow mode: every piece animates as specified; fast loads (<150ms) show no
progress flicker; reduced motion → no animation but all states still visible; Performance panel
shows no long tasks > 50ms from animations; CLS < 0.05. Report.
```
**🔍 Bug-hunt Prompt**
```
Animations replaying on every re-render (should be first mount / value change only); CountUp
starting from 0 on refetch (should start from the previous value); row exit animation leaving
ghost rows after fast consecutive deletes; skeleton shown together with stale data. Report.
```
**✅ Done when:** no screen ever shows a blank area, a raw "Loading…" text or an instant content jump.

---

### Step 0.16 Filters and search kit
**Problem:** Five screens have no search, three have no filters, and the existing filters look different on every page and can't be cleared in one click.
**Target:** a shared `FilterBar` that every list page builds its filters from:

- **Search:** a field with an icon, a clear (×) button and the `/` shortcut, debounced 300–400ms. It searches the fields listed for each page in the table below.
- **Filter controls:** select, multi-select chips, segmented control, date-range picker with presets (Today, Last 7 days, Last 30 days, This month, This year, Custom), number range (min–max) and a boolean switch.
- **Active-filter chips:** shown under the bar, each with an × button, plus a "Clear all" button.
- **"Filters (3)" button on mobile:** opens a bottom sheet with all filters and an "Apply" button.
- **Saved views (optional):** the admin can save the current filters under a name, kept in localStorage. Examples: "Pending COD", "Low stock drinks".
- **URL sync and result count:** every filter lives in the URL. The result count updates as filters change ("12 of 52 products").
- **Server vs. client filtering:** use server-side filtering where the API already accepts the parameter. Otherwise filter the loaded data client-side, and say so in a tooltip, e.g. "Filters the current page".

| Page | Search fields | Filters to provide |
|---|---|---|
| Products | name | Category (multi), Status (Active/Inactive), Stock (In/Low/Out), Featured, Discounted, Price range, Sort |
| Categories | title, description | Has products / Empty, Sort A–Z |
| Inventory | product name | Category, Stock segmented (All/Low/Out), Active/Inactive, Sort by stock |
| Orders | shortId, name, email | Status tabs, Payment status, Payment method (Card/COD), Date range presets, Amount range, Refund due, Cancelled by |
| Users | name, email, phone | Joined date range, Has orders |
| Team access | name, email | Role chips (Admin/Manager/Editor) |
| Discount codes | code | Status (Active/Expired/Used up/Inactive), Expiry range, Sort by expiry/usage |
| Employees | name, CNIC, email | Department (multi), Status, Hire-date range |
| Departments | name | Active/Inactive |
| Suppliers | name, email, phone | Supplies (multi), Distributor, Active only |
| Distributors | name, contact person | Supply category, Active only |
| Notifications | — | All / Unread tabs |
| Dashboard | — | Period (This month / This year / custom range only if the stats API supports it) |

**🛠 Master Prompt**
```
Create src/ui-component/app/filters/: FilterBar, SearchField, MultiSelectFilter, SegmentedFilter,
DateRangeFilter (presets + custom; uses the browser's local dates, sends ISO to API), RangeFilter,
BooleanFilter, ActiveFilterChips, MobileFilterSheet, SavedViews (localStorage per page). A
useFilters(schema) hook reads/writes the URL query, debounces search, exposes {values, set,
clear, clearAll, activeCount, toQuery(), applyClientFilter(rows)}. Showcase on /admin/ui-kit.
Do not wire pages yet (each page step does it with the table above).
```
**🧪 Test Prompt**
```
On /admin/ui-kit: each filter type sets the URL, back/forward restores, Clear all resets, chips
remove one filter, mobile sheet applies on "Apply", saved view restores all values, date presets
produce correct start/end in UTC+5 for "Today" and "This month". Report.
```
**🔍 Bug-hunt Prompt**
```
Debounced search firing twice, filter change not resetting page to 1, invalid URL values (e.g.
?status=foo) ignored safely, date range end inclusive of the whole last day. Report.
```
**✅ Done when:** every list page can build its filter row from these pieces and the table above.

---

### 🧪 Module 0 Gate
```
/admin/ui-kit shows every shared component in every state, in light (and dark if done) mode, at
390 and 1440px, with no console errors. The theme has no template colours left. Report.
```

---

# Module 1 — App shell (layout on every page)

### Step 1.1 Sidebar
**Sections:** LogoSection, MenuList (NavGroup headings: Dashboard, Manage Products, Manage Categories, Inventory Management, Manage Orders, User Information, Manage Permissions, Organization Management, Additional Feature), NavCollapse (Products, Categories, Inventory, Orders, User, Permissions, Employee, Supplier, Department, Distributor, Feature), NavItem (every link), MiniDrawer (collapsed mode), mobile drawer.
**Problem:** Long template-style group titles, mixed casing ("All User", "Employee List"), nested collapses for single items, active state hard to see, collapsed mode tooltips missing.
**Target:**
- Groups renamed to short section labels: **Overview** (Dashboard), **Catalog** (Products, Categories, Inventory), **Sales** (Orders, Discount codes), **Customers** (Users), **Team** (Employees, Departments, Suppliers, Distributors), **Settings** (Roles & permissions).
- Each section is a flat list where a module has only list + add (the "Add" lives on the list page's header button, so the sidebar has one item per module).
- Active item: tinted background (primary.lighter) + primary text + 3px left indicator.
- Collapsed rail (72px) with icon tooltips; expanded 260px; state persisted.
- Order count badge on Orders (pending count) and low-stock badge on Inventory (optional, if an existing endpoint provides it; no new endpoints).
- Bottom of sidebar: signed-in user card (avatar initials, name, role chip).
- Role filtering stays exactly as `permissions.js` says.

**🛠 Master Prompt**
```
Restructure src/menu-items/* into the six groups above with one item per module (Dashboard,
Products, Categories, Inventory, Orders, Discount codes, Users, Employees, Departments, Suppliers,
Distributors, Roles & permissions). Keep URLs and the role filter (permissions.js urlRouteKeys)
unchanged; the "Add …" pages stay reachable from list page header buttons and their routes stay.
Restyle NavGroup/NavItem/NavCollapse: section label overline muted, item 40px, radius 8, active =
primary.lighter bg + primary.main text + 3px left bar; hover tint. MiniDrawer 72px with Tooltip
labels; persist open/closed in localStorage. Add a user card at the bottom (initials avatar, name,
role chip) from the admin session. Mobile: temporary Drawer, closes on navigation.
```
**🧪 Test Prompt**
```
As admin, manager, editor: the sidebar shows only allowed items (compare to permissions.js); each
item navigates and highlights correctly including on edit/add sub-routes (e.g. /admin/edit-product/
x highlights Products); collapse/expand persists after reload; mobile drawer closes after a click;
keyboard Tab/Enter works; tooltips appear in collapsed mode. Report.
```
**🔍 Bug-hunt Prompt**
```
Find menu items whose route no longer exists or that the role can't open (would land on Access
Denied); check deep links highlight the right parent; check the sidebar scrolls when the window is
short (600px height); check no layout shift when toggling. Report.
```
**✅ Done when:** the sidebar is short, flat, clearly highlighted and role-correct.

---

### Step 1.2 Header (top bar)
**Sections:** sidebar toggle, (new) page title area / global search slot, NotificationSection, ProfileSection.
**Target:** 64px white bar with bottom border, sticky; left: toggle + breadcrumbs (desktop) ; right: notifications bell, profile avatar. Optional command search (Ctrl+K) that jumps to pages the role can open (client-side list only, no new API).

**🛠 Master Prompt**
```
Restyle layout/MainLayout/Header: height 64, sticky, background paper, border-bottom divider, no
shadow; left = toggle IconButton (aria-label "Toggle sidebar") + Breadcrumbs (hidden < md); right =
NotificationSection + ProfileSection with 8px gap. Add an optional Ctrl+K quick-jump dialog listing
the role's allowed pages (from menu-items) with keyboard navigation.
```
**🧪 Test Prompt**
```
Header stays on top while scrolling long tables; breadcrumbs match the page; Ctrl+K opens, filters,
Enter navigates, Esc closes, only allowed pages listed for each role. Report.
```
**🔍 Bug-hunt Prompt**
```
Check header overlap with page content at 390px, z-index against dialogs and drawers, and focus
return after closing the quick-jump dialog. Report.
```
**✅ Done when:** a clean, sticky top bar on every page.

---

### Step 1.3 Notifications panel
**Sections:** bell button with unread badge, popover header "Notifications" + "Mark all as read", list (NotificationList), each item (icon by type, text, relative time, unread dot), empty state, loading, error.
**Target:** 380px popover (full-screen sheet on mobile); unread items bold with a dot; clicking an order notification opens Orders filtered to that order; "Mark all as read" with busy + toast; relative times (`5 min ago`).

**🛠 Master Prompt**
```
Restyle NotificationSection + NotificationList with the shared components: header row with title
and "Mark all as read" (useAction, toast "All caught up"); items with type icon in a tinted circle,
message, formatRelative time, unread dot; skeleton while loading; EmptyState "You're all caught up";
ErrorState + Retry. Badge shows unread count (99+ cap). Mobile: Dialog fullScreen. Remove the
"Start DND Mode"/"Allow Notifications" template switches if they do nothing (check first; if they
do nothing, delete them).
```
**🧪 Test Prompt**
```
Create a notification (e.g. customer cancels an order). Bell badge increments; open panel → item
unread; Mark all as read → badge 0, toast shown, state persists after reload; empty and error
states render (stop backend for error). Report.
```
**🔍 Bug-hunt Prompt**
```
Check long messages wrap; panel scrolls with 20 items; clicking outside closes; focus trap on
mobile sheet; badge not shown for 0. Report.
```
**✅ Done when:** notifications are readable, actionable and never show dead switches.

---

### Step 1.4 Profile menu
**Sections:** avatar button, greeting, role chip, (template) Account Settings, Social Profile, DND/notification switches, Logout.
**Target:** Avatar with initials; menu shows name, email, role chip; items: "Change password" (sends the existing reset-link flow, with toast), "Theme: Light/Dark/System" (if Step 0.8), "Log out" (confirm not needed; busy + redirect). Remove items that lead nowhere (Account Settings, Social Profile) unless they work.

**🛠 Master Prompt**
```
Rebuild ProfileSection: initials Avatar (primary.lighter bg); menu header name/email/role chip;
items as listed; delete template items with no route/handler; Logout uses useAction (busy) then
navigates to /admin/login with toast "Signed out".
```
**🧪 Test Prompt**
```
Every menu item does something real; logout clears session and back button doesn't show admin
pages; change-password sends email (or shows the server's honest error while Gmail is broken).
Report.
```
**🔍 Bug-hunt Prompt**
```
Grep ProfileSection for handlers that are empty or navigate to non-existent routes. Report.
```
**✅ Done when:** the profile menu has no dead items.

---

### Step 1.5 Breadcrumbs, footer, customization drawer, scroll
**Target:** Breadcrumbs generated from menu-items (Home › Catalog › Products › Edit "Latte"); footer is a single muted line (`© 2026 Cafe Fresco Admin · v1.0`); the template Customization drawer (font family / border radius) is removed from production (or hidden behind an env flag) because the theme is now fixed; NavigationScroll restores scroll to top on route change.

**🛠 Master Prompt**
```
Breadcrumbs: derive from menu-items + route params (edit pages show the entity name once loaded).
Footer: one line, muted caption, centred on mobile. Customization drawer: render only when
import.meta.env.VITE_UI_CUSTOMIZER === 'true'. Ensure scroll-to-top on route change.
```
**🧪 Test Prompt**
```
Breadcrumbs correct on all 25 screens; footer visible at page end, not floating; no customizer
gear in normal builds. Report.
```
**🔍 Bug-hunt Prompt**
```
Look for breadcrumb flicker (id shown before name), duplicate breadcrumb components inside pages
(remove them), and scroll position kept between pages. Report.
```
**✅ Done when:** shell pieces are consistent and nothing template-only remains.

### Step 1.6 Branding, logo and browser tab titles
**Problem:**
- No dashboard page sets `document.title`, so every tab reads "Cafe Fresco".
- `ui-component/Logo.jsx` and `LogoSection` use the template sizing.
- The collapsed sidebar has no compact logo mark.

**Target:**
- **Tab titles:** `useDocumentTitle` sets "<Page> · Cafe Fresco Admin" on every route. Edit pages use the entity name, e.g. "Edit Latte · Cafe Fresco Admin".
- **Logo:** two variants, full (sidebar expanded, login pages) and mark (collapsed rail, favicon).
- **Favicon:** `/favicon.svg` uses the brand red mark.
- **Pending count in the tab:** optional, e.g. "(3) Orders · Cafe Fresco Admin", only from data already loaded.

**🛠 Master Prompt**
```
Add src/hooks/useDocumentTitle.js and call it in all 25 screens (titles: Login, Forgot password,
Reset password, Dashboard, Products, Add product, Edit <name>, Categories, Add category, Edit
<name>, Inventory, Orders, Users, Team access, Discount codes, Employees, Add employee, Edit <name>,
Departments, Suppliers, Add supplier, Edit <name>, Distributors, Access denied, Page not found).
Logo.jsx gets variant="full"|"mark"; LogoSection uses mark when the sidebar is collapsed. Update
public/favicon.svg to the brand mark.
```
**🧪 Test Prompt**
```
Open every screen and read the tab title (Playwright page.title()) — all 25 distinct and correct;
logo switches with collapse; favicon visible. Report the list.
```
**🔍 Bug-hunt Prompt**
```
Title flashes "undefined" on edit pages before load; title not reset after leaving a page. Report.
```
**✅ Done when:** every tab is identifiable and branding is consistent.

### 🧪 Module 1 Gate
```
Run UI-SMOKE. Additionally record sidebar/header behaviour at 390, 768, 1024, 1440, 1920 and with
the sidebar collapsed. Report.
```

---

# Module 2 — Auth pages

### Step 2.0 Auth layout shell (MinimalLayout, AuthWrapper1, AuthCardWrapper, AuthFooter)
**Problem:** The three auth screens share template wrappers with a flat grey background, a template card size and a footer that may contain template links.
**Target:**
- **`AuthLayout`** (replaces the AuthWrapper1 and AuthCardWrapper usage):
  - Left brand panel on screens ≥ md: red gradient, logo, tagline, subtle pattern.
  - Right column: 400px card centred vertically.
  - Mobile: logo on top, then the card.
- **`AuthFooter`:** one muted line, "© <year> Cafe Fresco · Admin". Template links removed.
- **`MinimalLayout`:** background `#F6F7F9`; the session check shows the top Loader.

**🛠 Master Prompt**
```
Create src/views/pages/authentication/AuthLayout.jsx with the layout above and use it in Login,
Forget and Reset; restyle AuthFooter; delete AuthWrapper1/AuthCardWrapper if no longer imported;
MinimalLayout uses theme background.
```
**🧪 Test Prompt**
```
All three auth screens share the same layout at 390/768/1440; footer has no dead links. Report.
```
**🔍 Bug-hunt Prompt**
```
Card overflow on short screens (600px height) — card must scroll, not clip. Report.
```
**✅ Done when:** one auth shell for all three screens.

### Step 2.1 Login (`/admin/login`)
**Sections:** AuthWrapper1 background, AuthCardWrapper card, logo, heading, Email Address, Password + visibility toggle, Login button, Forgot password link, AuthFooter, error messages (wrong credentials, rate limit 429, session expired notice from `?next=`).
**Target:** Split layout on ≥ md: left brand panel (red gradient, logo, one-line tagline, small illustration/pattern), right form card 400px. Mobile: form only with logo on top. Inputs with leading icons, password toggle with aria-label, "Remember me" only if it does something (otherwise omit), LoadingButton "Signing in…", errors in an Alert above the form, Enter submits, autofocus email, `autocomplete` attributes set.

**🛠 Master Prompt**
```
Rebuild views/pages/authentication/Login.jsx + auth-forms/AuthLogin.jsx with the target layout.
Keep the existing submit logic, ?next= handling and messages. Add autocomplete="username" /
"current-password", autofocus on email, Alert for errors (429 → "Too many attempts, try again in 15
minutes"), LoadingButton. Footer links: "Forgot password?" and the copyright line.
```
**🧪 Test Prompt**
```
Wrong password → Alert, fields kept, focus to password; 6 failed tries → 429 message; success →
role home with a toast "Welcome back, <name>"; deep link /admin/all-order?x when logged out → login
→ returns to it. 390px and 1440px screenshots. Report.
```
**🔍 Bug-hunt Prompt**
```
Check password manager autofill works, Enter submits once (no double request), visibility toggle
keeps cursor position, layout doesn't jump when the Alert appears (reserve space or animate).
Report.
```
**✅ Done when:** a polished login that behaves exactly as before.

### Step 2.2 Forgot password (`/admin/forget-password`)
**Sections:** logo, heading, helper text, Email Address, Send button, back to login, success state.
**Target:** Same split layout; after submit show a success panel ("If an account exists for that email, we've sent a link. Check your inbox.") with "Back to login" and a 60-second "Resend" countdown.

**🛠 Master Prompt**
```
Rebuild Forget.jsx + AuthForget.jsx: same layout as login; LoadingButton; on 200 swap the form for a
success panel (generic text, no account enumeration) with Resend disabled for 60s; 429 Alert.
```
**🧪 Test Prompt**
```
Known and unknown email → same success panel; resend countdown works; back link works. Report.
```
**🔍 Bug-hunt Prompt**
```
Double submit, empty email, invalid email format, 429 handling. Report.
```
**✅ Done when:** clear, honest feedback with no enumeration.

### Step 2.3 Reset password (`/admin/reset-password/:token`)
**Sections:** heading, New Password, strength meter, Confirm Password, visibility toggles, Submit, invalid/expired token state, success state.
**Target:** Strength meter as a 4-segment bar + rule checklist (8+ chars, letter, number) that ticks live; confirm mismatch shown inline; expired token → full card state "This link has expired" + "Request a new link"; success → toast + redirect to login.

**🛠 Master Prompt**
```
Rebuild Reset.jsx + AuthReset.jsx as above using views/utils/password-strength.js; keep the API
call; map 400/expired to the expired state.
```
**🧪 Test Prompt**
```
Weak password blocked with checklist; mismatch inline; expired token page; success redirects to
login with toast. Report.
```
**🔍 Bug-hunt Prompt**
```
Paste into confirm field, toggle visibility on both, keyboard-only flow. Report.
```
**✅ Done when:** the three auth screens share one look.

### 🧪 Module 2 Gate
```
Full auth journey on mobile and desktop: login fail → forgot → reset (use a seeded token) → login.
Screens look like one family. Report.
```

---

# Module 3 — Dashboard home (`/admin/dashboard`)

### Step 3.1 Page header and layout grid
**Sections:** PageHeader ("Dashboard", subtitle "Overview of sales and orders"), date-range control (Today / 7 days / 30 days / This year — UI filter only if the existing stats endpoints accept a range; otherwise show "This month / This year" labels only), Refresh button, error Alert + Retry.
**Target:** 12-column grid: row 1 = 4 StatCards; row 2 = Revenue chart (8 cols) + Latest orders (4 cols); row 3 (optional) = Order status donut + Low stock list if data already exists in current endpoints.

**🛠 Master Prompt**
```
Rebuild views/dashboard/Default/index.jsx with PageContainer + PageHeader (Refresh = LoadingButton
that re-fetches and toasts "Dashboard updated") and the grid above. ErrorState replaces the Alert.
Use only the data already fetched (DashboardApi, order-trend). No new endpoints.
```
**🧪 Test Prompt**
```
Grid at 390 (1 column), 768 (2), 1440 (4). Refresh shows skeletons on cards only, not a page
blank. Stop backend → ErrorState with Retry; restart → Retry recovers. Report.
```
**🔍 Bug-hunt Prompt**
```
Check numbers equal the backend stats (services/stats.js): revenue = completed AND paid; compare
with a Mongo query. Report mismatches.
```
**✅ Done when:** a balanced, responsive overview layout.

### Step 3.2 Stat cards (Earning, Orders, Completed, Pending)
**Cards:** EarningCard (total earnings), TotalOrderLineChartCard (orders this month/year + Month/Year toggle + mini line chart), TotalIncomeDarkCard (completed orders), TotalIncomeLightCard ("Total Pending Order").
**Problem:** Template look (big purple/blue blobs, decorative circles), inconsistent sizes, label "Total Pending Order".
**Target:** Four identical `StatCard`s: icon in tinted square, label ("Revenue", "Orders", "Completed", "Pending"), value with MoneyText/number, small caption ("This month" / "All time"), sparkline where data exists, Month/Year segmented toggle on the Orders card, skeleton while loading. Pending card links to Orders filtered to pending.

**🛠 Master Prompt**
```
Replace EarningCard, TotalOrderLineChartCard, TotalIncomeDarkCard, TotalIncomeLightCard on the
dashboard with StatCard instances fed by the same values. Keep the files only if used elsewhere;
otherwise delete them and their skeleton variants. Orders card: ToggleButtonGroup Month/Year
switching between existing monthly/yearly numbers and line data. Each card clickable to its page
(Orders filtered) with a visible focus ring.
```
**🧪 Test Prompt**
```
Values match the old cards; toggle switches value and sparkline; click-through filters Orders;
skeleton then values; long numbers (1,234,567.89) fit at 390px. Report.
```
**🔍 Bug-hunt Prompt**
```
Look for zero/NaN/undefined display when stats are empty (fresh DB), and currency symbol
consistency. Report.
```
**✅ Done when:** four clean, equal-height cards.

### Step 3.3 Revenue & orders chart (TotalGrowthBarChart)
**Sections:** title "Completed orders & revenue by month", chart (two series), legend, empty state, skeleton.
**Target:** SectionCard with title + year selector; ApexCharts combo (bars = orders, line = revenue on a second axis), brand colours, gridlines light, tooltips formatted with formatMoney, no toolbar/download clutter, responsive height (320 desktop / 240 mobile), EmptyState "No completed orders yet".

**🛠 Master Prompt**
```
Restyle TotalGrowthBarChart with SectionCard + the chart spec above; use theme palette and Inter
font in Apex options; disable Apex toolbar; formatter uses formatMoney/formatNumber; handle empty
series with EmptyState.
```
**🧪 Test Prompt**
```
Fresh DB → empty state; with data → bars and line match /api/order-trend; tooltip formats money;
resize window → chart reflows. Report.
```
**🔍 Bug-hunt Prompt**
```
Check memory leak on route change (chart destroyed), axis labels overlap at 390px, timezone month
shift. Report.
```
**✅ Done when:** a readable, branded chart.

### Step 3.4 Latest orders (PopularCard)
**Sections:** title "Today Latest Order", menu (Today / This Month / This Year — currently does nothing), list rows (customer or "Deleted customer", amount, status), View All.
**Target:** "Latest orders" SectionCard; list of 5–6 rows: avatar initials, customer name, shortId, time ago, MoneyText, StatusChip; the period menu removed unless it filters (it currently only closes); "View all orders" link to Orders.

**🛠 Master Prompt**
```
Rebuild PopularCard as "Latest orders" with the target row design using existing data; remove the
non-functional Today/Month/Year menu; rows link to Orders with that order opened (?order=<id>
supported by Step 7.3).
```
**🧪 Test Prompt**
```
Rows match newest orders; deleted customer shows "Deleted customer" with neutral avatar; clicking
a row opens that order's details on Orders; empty state on fresh DB. Report.
```
**🔍 Bug-hunt Prompt**
```
Check long names truncate with tooltip; status chip colours match Orders page. Report.
```
**✅ Done when:** a useful, clickable latest-orders card with no dead menu.

### Step 3.5 Unused template cards
**Target:** Delete `BajajAreaChartCard.jsx`, its chart-data, and any skeleton/card not rendered anywhere (verify with grep first). Fewer files, no template leftovers.

**🛠 Master Prompt**
```
Grep for imports of BajajAreaChartCard, bajaj-area-chart, TotalIncomeDarkCard/LightCard, Skeleton/*
and chart-data/*; delete files with zero imports; build.
```
**🧪 Test Prompt**
```
npm run build passes; dashboard renders unchanged. Report deleted files.
```
**🔍 Bug-hunt Prompt**
```
Check no dynamic import strings reference deleted files. Report.
```
**✅ Done when:** no dead dashboard components remain.

### 🧪 Module 3 Gate
```
Dashboard at 5 widths, loading (Slow 3G), empty DB, error (backend down) and full data. Compare
every number with a Mongo query. Report a table.
```

---

# Module 4 — Products

### Step 4.1 All Products (`/admin/all-product`)
**Sections:** page header + "Add product" button, toolbar (Search by name, Category filter, Sort by Price, (new) Status filter Active/Inactive, Stock filter if supported by `/product/fetch`), table (No · Name · Category · Price · Final price · Active toggle · Featured · Stock · Discount · Rating · Actions), row actions (Edit, Delete), pagination, retry alert.
**Target:**
- Name cell = 40px rounded thumbnail + title + small muted category; remove the separate "No" column (use row index only if required — not needed).
- Price cell shows final price, with the base price struck through and a "-15%" chip when discounted (merge Price/Final price/Discount into one "Price" column).
- Stock cell = StatusChip (In stock N / Low N / Out).
- Active = Switch with busy state + toast ("Hidden from shop" / "Visible in shop"); Featured = star icon toggle if the API supports updating it inline, otherwise a read-only chip.
- Rating = star + `4.0 (12)` or "—".
- Row actions: Edit (icon), Delete (icon, red, confirm "Delete *Latte*?", disabled with tooltip for editors and for products in orders after a 409).
- Mobile: card list (thumbnail, name, price, stock chip, actions menu).
- Filters in the URL query so refresh/back keep them.

**🛠 Master Prompt**
```
Rebuild views/pages/product/allProduct.jsx with PageHeader (primary action "Add product" →
/admin/add-product), Toolbar (search debounced 400ms, Category select, Status select, Sort select),
DataTable with the column design above and mobileCard. Use useAction for toggle and delete with
the toasts/confirm text above. Keep every API call and permission check as today (can(role,
'product.delete')). Sync filters/page to the URL query.
```
**🧪 Test Prompt**
```
As admin/manager/editor: search, filter, sort, paginate (URL updates, back restores); toggle Active
→ toast and shop listing hides/shows the product; delete product in orders → 409 toast with server
message; delete unused product → confirm → row removed + toast; editor sees Delete disabled with
tooltip. 390px card list works. Report.
```
**🔍 Bug-hunt Prompt**
```
Check: image 404 shows placeholder; very long titles truncate; toggle double-click sends one
request; table keeps scroll position after a toggle; empty search result shows EmptyState with
"Clear filters"; page out of range after delete moves to previous page. Report.
```
**✅ Done when:** the product list is scannable, responsive and every action gives feedback.

### Step 4.2 Add Product (`/admin/add-product`)
**Sections:** General Information (Product Name, Description), Product Media (Upload Image), Category, Available Stock, Pricing (Base Price, Discount %), Additional Options (Featured / New release / Active), Save, Discard Changes.
**Target:** Two-column layout on ≥ lg: left (8 cols) General + Media + Pricing; right (4 cols) Status (Active switch), Organization (Category select with "Add category" link), Inventory (Stock), Options (Featured, New release). Live price preview "Customers pay $8.50". Description with character counter. ImageUpload drop zone with preview, 2 MB / type validation. Sticky FormActions bar (Discard → confirm if dirty; Save → LoadingButton). Inline field errors from the server `fields` object. Leave-page guard when dirty.

**🛠 Master Prompt**
```
Rebuild addProduct.jsx with FormSection/SectionCard/ImageUpload/FormActions in the two-column
layout above; keep validation rules and the API call; map server fields{} to helperText; useAction
for Save (toast "Product created" then navigate to the list with the new product highlighted);
Discard asks confirm when dirty; add a useBlocker/beforeunload guard when dirty.
```
**🧪 Test Prompt**
```
Empty submit → inline errors on required fields, focus first error; duplicate title → 409 shown on
Title; image > 2 MB → message, not uploaded; discount 15 on 10.00 → preview $8.50; success →
toast + list; navigate away with changes → confirm. 390px stacked layout. Report.
```
**🔍 Bug-hunt Prompt**
```
Double-click Save → one product; number inputs reject "e"/negative; Enter in a text field doesn't
submit half-filled form unexpectedly; the uploaded image is cleaned up when validation fails
(backend already deletes; check the UI doesn't keep a stale preview). Report.
```
**✅ Done when:** creating a product is guided, validated inline and impossible to double-submit.

### Step 4.3 Edit Product (`/admin/edit-product/:id`)
**Sections:** Back to products, same fields as Add + Remove image, Discard Changes, not-found state.
**Target:** Same layout as Add (shared `ProductForm` component), header shows product name + status chip + "View in shop" link (opens storefront `/product/:id` in a new tab), skeleton while loading, not-found EmptyState with "Back to products", Save disabled until something changes.

**🛠 Master Prompt**
```
Extract ProductForm from Add Product and use it in editProduct.jsx with initial values; header
actions: "View in shop" (VITE_SHOP_URL + /product/:id, new tab), Delete (same confirm as list).
Save enabled only when dirty; toast "Product updated".
```
**🧪 Test Prompt**
```
Load existing → values match; change discount → preview updates; remove image → placeholder;
Save → toast and values persist after reload; bad id → not-found state; editor can save but not
delete. Report.
```
**🔍 Bug-hunt Prompt**
```
Check stale data if two tabs edit the same product (last save wins — at least reload after save);
switching between two edit URLs resets the form. Report.
```
**✅ Done when:** add and edit look and behave identically.

### 🧪 Module 4 Gate
```
Create → edit → toggle → try delete (in order: blocked) → delete (unused). Every step had a busy
state and a toast. Shop reflects each change. Report.
```

---

# Module 5 — Categories

### Step 5.1 All Categories (`/admin/all-category`)
**Sections:** header, table (No · Category Name · Actions), Edit, Delete + confirm, (Cancel button in a template dialog).
**Target:** Card grid OR table (choose table for consistency) with columns: Category (image thumb + title), Description (truncated), Products (count, if available from existing data; else omit), Actions. Header "Add category" button. Search box (client-side filter of the loaded list). Delete confirm shows the server 409 message ("has N products") as a toast. EmptyState with "Add your first category".

Also: client-side **pagination** (10/25/50) and **sort** by name, because the page currently renders every category in one unsorted list.

**🛠 Master Prompt**
```
Rebuild allCategory.jsx with PageHeader/Toolbar/DataTable; client-side search, sort (name A–Z/Z–A)
and pagination (10/25/50); useAction delete with confirm "Delete category *X*?"; keep
can(role,'category.delete').
```
**🧪 Test Prompt**
```
Delete category with products → toast with count; delete empty one → removed; search filters;
editor delete disabled. 390px. Report.
```
**🔍 Bug-hunt Prompt**
```
Missing image placeholder; long descriptions; empty list state. Report.
```
**✅ Done when:** consistent with Products.

### Step 5.2 Add Category / Step 5.3 Edit Category
**Sections:** Category Details (Title, Description, Upload Image), Save, Discard.
**Target:** Single-column FormSection (max width 720) with ImageUpload, character counter, LoadingButton, inline errors (duplicate title 409 on the field), dirty guard; Edit shares a `CategoryForm` and shows skeleton/not-found states; "Clear description" works (already supported).

**🛠 Master Prompt**
```
Create CategoryForm used by addCategory.jsx and EditCategory.jsx with the target design; keep API
calls; toasts "Category created"/"Category updated".
```
**🧪 Test Prompt**
```
Create, duplicate title (case-insensitive) error inline, edit, clear description, image replace,
not-found id. Report.
```
**🔍 Bug-hunt Prompt**
```
Double submit, dirty guard, stale preview after replace. Report.
```
**✅ Done when:** all three category screens match the product screens.

### 🧪 Module 5 Gate
```
Category CRUD end to end with feedback at every step; the shop's category strip updates. Report.
```

---

# Module 6 — Inventory (`/admin/all-inventory`)

### Step 6.1 Inventory list and stock dialog
**Sections:** filters (Category, Search by name, Stock: all/low/out), Retry alert, product rows (stock number, badges No stock record / Out of stock / Low / Inactive, Restock button), "Update stock" dialog (Add / Remove / Set, quantity, Cancel, Save).
**Target:**
- Summary strip on top: 3 small StatCards (Total products, Low stock, Out of stock) computed from the loaded data or existing `stock=low|out` queries.
- Toolbar with segmented control **All / Low / Out**.
- DataTable: Product (thumb + name + category), Stock (big tabular number + StatusChip), Last updated (formatRelative), Status (Inactive chip if inactive), Action "Adjust stock".
- Adjust dialog: segmented Add / Remove / Set, number field with − / + steppers, live preview "12 → 17", reason note field only if the API stores it (otherwise omit), LoadingButton; toast "Stock updated: Latte 17"; row flashes briefly.

**🛠 Master Prompt**
```
Rebuild inventory.jsx with the target design; keep the existing /product/inventory/update/:id
{mode, quantity} call and validation (Remove can't go below 0, Set allows 0). Summary counts from
existing data/queries only.
```
**🧪 Test Prompt**
```
Add 5, Remove 3, Set 0 → values and chips update, toasts shown; Remove more than stock → inline
error, no request; Low/Out filters match backend; editor can adjust (role ALL). 390px. Report.
```
**🔍 Bug-hunt Prompt**
```
Double save, keyboard Enter in dialog, dialog keeps previous product's values, negative input via
typing. Report.
```
**✅ Done when:** stock is readable at a glance and every adjustment is confirmed by feedback.

### 🧪 Module 6 Gate
```
Adjust stock in the dashboard and verify the shop product page shows the new stock / out-of-stock
state. Report.
```

---

# Module 7 — Orders (`/admin/all-order`)

### Step 7.1 Orders list
**Sections:** search (order ID, customer, email), Status filter, Payment filter, Month, Year, Retry, table (Order ID · Customer Name · Email · Amount · Status · Payment (method, Refund due, Cancelled by) · Date · Actions), View, Edit status (disabled rules), pagination.
**Target:**
- Status tabs above the table: **All · Pending · Completed · Cancelled** with counts if available (else no counts).
- Toolbar: search + Payment select + date range (Month/Year combined into one "Period" select) + "Clear filters".
- Columns: Order (shortId + date below, muted), Customer (name + email below), Items (count), Total (MoneyText, right-aligned), Payment (method icon Card/COD + StatusChip paid/unpaid + "Refund due" red chip), Status (StatusChip + "by customer/admin/system" caption when cancelled), Actions (View, Update status).
- Row click opens the details drawer (Step 7.2). Filters and selected order in the URL (`?order=<id>`).
- Mobile card list.

**🛠 Master Prompt**
```
Rebuild the list part of allOrder.jsx with PageHeader, status Tabs, Toolbar and DataTable as above;
keep /order/fetch params and permission rules (update disabled for cancelled and completed+paid);
URL sync incl. ?order=.
```
**🧪 Test Prompt**
```
Tabs filter; search by shortId, name and email; payment filter; period; pagination; ?order=<id>
opens that order; Refund due and Cancelled by visible; manager can update, editor has no access
(Access Denied). Report.
```
**🔍 Bug-hunt Prompt**
```
Timezone of dates vs backend APP_TZ; amounts right-aligned with tabular numbers; very long emails;
empty results state with Clear filters. Report.
```
**✅ Done when:** orders are scannable by status and payment at a glance.

### Step 7.2 Order details (View)
**Sections (current dialog):** Order Details heading, customer, Products list, totals, discount, payment method, Stripe intent id, shipping address, cancelled by.
**Target:** Right-side Drawer (520px; full screen on mobile) with sections: header (shortId, StatusChip, created date, close), **Customer** card (name, email, phone), **Delivery** card (address block + copy button), **Items** table (title, qty, unit, line total; legacy/removed items labelled), **Summary** (subtotal, discount with code, total), **Payment** (method, status, Stripe intent id with copy, paid at if known), **Timeline** from `statusHistory` (who/when/what), footer actions (Update status, Close).

**🛠 Master Prompt**
```
Replace the View dialog with an OrderDetailsDrawer component using SectionCards as listed; copy
buttons use navigator.clipboard with toast "Copied"; timeline from statusHistory (byType label,
formatDateTime).
```
**🧪 Test Prompt**
```
Open card paid order, COD unpaid order, customer-cancelled order, legacy order without snapshots:
every section renders correctly; copy works; drawer closes with Esc and returns focus to the row.
Report.
```
**🔍 Bug-hunt Prompt**
```
Missing address (legacy), deleted product, deleted customer, very many items (scroll inside
drawer). Report.
```
**✅ Done when:** all order facts are visible in one readable panel.

### Step 7.3 Update status dialog
**Sections:** Edit Order Status title, Status select (Completed / Cancelled — returns stock), Payment select, Cancel, Update.
**Target:** Dialog shows current state chips → choose new status with radio cards ("Mark completed", "Cancel order — returns stock & frees discount code"), payment option only when allowed (R3: COD can be marked paid after completed; card can't be set by hand — show the reason text instead of a disabled select), danger styling for Cancel, LoadingButton "Updating…", toast "Order #A1B2C3 marked completed" / server 409 message.

**🛠 Master Prompt**
```
Rebuild the status dialog with radio cards, R3 explanations, useAction; keep /order/update-status
payload and the server's 409 messages.
```
**🧪 Test Prompt**
```
Pending COD → Completed → Paid; pending card → can't set paid (explained); cancel → stock restored
(check inventory) and toast; cancelled order → button disabled with tooltip "Cancelled orders can't
be changed". Report.
```
**🔍 Bug-hunt Prompt**
```
Concurrent update from two tabs → second gets 409 message; dialog resets between orders. Report.
```
**✅ Done when:** status changes are explained, safe and confirmed.

### Step 7.4 Order receipt (print) and quick actions
**Target:**
- **"Print receipt"** in the details drawer. It opens a print-styled view (`@media print`) of data already loaded: logo, order number, date, customer, delivery address, items, totals, payment method and status. No new endpoint.
- **Bulk actions** on the Orders list: "Mark completed" and "Mark paid (COD, completed only)". They use the existing update endpoint for each order, with a progress toast. Ineligible selected rows are skipped and listed in the summary toast.
- **Copy actions:** the order ID and the customer's email can be copied from the row menu.

**🛠 Master Prompt**
```
Add OrderReceipt (print stylesheet hides app chrome; A4 and 80mm thermal friendly) opened from the
drawer; enable DataTable selection + BulkBar on Orders with the two bulk actions respecting R3
client-side and server-side; row menu copy actions.
```
**🧪 Test Prompt**
```
Print preview of a card order and a COD order (Chrome print dialog → PDF) looks clean on one page;
bulk mark completed on 3 pending + 1 cancelled → 3 updated, 1 skipped with reason; stock unchanged.
Report.
```
**🔍 Bug-hunt Prompt**
```
Receipt with discount, with removed product, with long address; bulk action on 50 rows keeps UI
responsive and stops cleanly on session expiry. Report.
```
**✅ Done when:** admins can print receipts and process several orders at once safely.

### 🧪 Module 7 Gate
```
Process a COD order and a card order end to end in the dashboard with the shop open; every state
change visible in both; every action had busy + toast. Report.
```

---

# Module 8 — Users (`/admin/all-user`)

### Step 8.1 Users list and order history
**Sections:** Search Users, table (No · Name · Email · Phone · Created · Actions), History action, User Order History dialog (orders, status, payment, Refund due, lifetime spend), pagination.
**Target:** Table: Customer (initials avatar + name + email), Phone ("—"), Orders (count if in data), Joined (formatDate), Actions ("View history"). History becomes a Drawer: profile header (name, email, phone, joined), 3 mini stats (Orders, Lifetime spend (paid), Refund due count), orders list (shortId, date, total, status/payment chips, click → Orders ?order=). EmptyState for users with no orders.

**🛠 Master Prompt**
```
Rebuild allUser.jsx with DataTable + CustomerDrawer as above; keep /user/all, /user/search and
/order/history/:userId calls and can(role,'user.history').
```
**🧪 Test Prompt**
```
Search by name/email/phone; paginate; open history for a user with orders and with none; lifetime
spend equals sum of paid non-cancelled orders; Refund due shown. Report.
```
**🔍 Bug-hunt Prompt**
```
Search debounce one request; special characters in search; drawer focus; long emails. Report.
```
**✅ Done when:** customers and their history are one click apart and readable.

### 🧪 Module 8 Gate
```
Find a customer from an order, open their history, jump back to the order. Report.
```

---

# Module 9 — Roles & permissions (`/admin/all-permission`, admin only)

### Step 9.1 Admin list, add, edit role, reset link
**Sections:** Add Role button, table (No · Name · Email · Role · Actions), You/Root badges, Edit, Delete, Send reset link, Add New Permission dialog (Name, Email, Password, Role), Edit Role dialog (Select Role).
**Target:** Rename page to **"Team access"** with subtitle explaining roles. Top: 3 role cards (Admin / Manager / Editor) each listing what the role can do (generated from `permissions.js` so it never drifts) and member count. Table: Member (avatar, name, email, "You"/"Root" chips), Role (StatusChip colour per role), Actions menu (Change role, Send reset link, Remove). Protected rows (root, yourself, last admin) show disabled actions with explanatory tooltips. Add dialog: "Invite member" with password strength meter and role radio cards. Edit role: radio cards with the capability summary. All actions useAction with toasts ("Reset link sent to x@y" / honest mail error).

**🛠 Master Prompt**
```
Rebuild allPermission.jsx as above; capability lists derived from routeRoles/actionRoles in
src/config/permissions.js; keep all API calls and server protections.
```
**🧪 Test Prompt**
```
Add manager → appears; change to editor; try changing root/yourself/last admin → disabled with
tooltip (and server still rejects if forced); send reset link → toast; remove → confirm + toast.
Report.
```
**🔍 Bug-hunt Prompt**
```
Duplicate email inline error; weak password blocked; role cards counts update after changes.
Report.
```
**✅ Done when:** access management explains itself and can't be misused from the UI.

### 🧪 Module 9 Gate
```
Log in as the new manager in another browser: sidebar and pages match the capability card. Report.
```

---

# Module 10 — Discount codes (`/admin/discount-code`, admin only)

### Step 10.1 Codes list and add/edit dialog
**Sections:** Add button, table (No · Code · Percentage · Expired · Min Purchase · Max Uses (used/max) · Actions), Edit, Delete, dialog (Code, Discount Percentage, Expiry Date, Minimum Spending, Maximum Use Limit).
**Target:** Toolbar with search by code, a status filter (Active / Expired / Used up) and client-side pagination. Table: Code (monospace chip + copy button), Discount (`10%`), Usage (progress bar `3 / 5`), Min spend (MoneyText or "—"), Expires (date + "in 4 days" / red "Expired"), Status (Active / Expired / Used up / Inactive chip), Actions. Dialog: code field auto-uppercase with "Generate" button, percentage slider + input, date picker that blocks past dates, min spend, max uses ≥ used (inline error), preview sentence "10% off orders over $20, up to 5 uses, until 30 Nov".

**🛠 Master Prompt**
```
Rebuild discount.jsx as above; keep validation rules (1–100%, future date, maxUses ≥ 1 and ≥
used, minPurchase ≥ 0) client and server; duplicates 409 inline on Code.
```
**🧪 Test Prompt**
```
Create, duplicate (409 inline), edit max below used (blocked), expired code shows Expired chip,
copy code toast, delete confirm. Report.
```
**🔍 Bug-hunt Prompt**
```
Timezone of expiry (end of day), Generate collisions, usage bar at 0/0. Report.
```
**✅ Done when:** codes' state is obvious and creation can't produce invalid codes.

---

# Module 11 — Employees

### Step 11.1 Employee List (`/admin/employees/list`)
**Sections:** Department filter, search (name, CNIC, email), table (No · Name · CNIC · Email · Phone · Department · Job Title · Status · Actions), Edit, Delete (admin only).
**Target:** Table: Employee (avatar initials + name + job title), Contact (email + phone), CNIC (monospace, masked except last 4 with reveal on click for admin), Department (chip), Status (Active/Inactive), Hire date, Actions. Header "Add employee". Filter chips.

**🛠 Master Prompt**
```
Rebuild allEmployee.jsx with DataTable/Toolbar as above; keep permissions (delete admin only).
```
**🧪 Test Prompt**
```
Filter by department, search CNIC with/without dashes, delete as admin (confirm + toast), manager
sees delete disabled. Report.
```
**🔍 Bug-hunt Prompt**
```
CNIC formatting 12345-1234567-1, inactive employees styling, empty department. Report.
```
**✅ Done when:** employee list matches other lists.

### Step 11.2 Add Employee / Step 11.3 Edit Employee
**Sections:** Employee Info (Name, CNIC, Email, Phone, Address), Job Details (Position, Salary, Department, Hire Date), Status, Save, Discard, Back to employees, not-found.
**Target:** Shared `EmployeeForm`: FormSections "Personal", "Job", "Status"; CNIC input mask `#####-#######-#`; salary with currency adornment; date picker; department select with "Manage departments" link; sticky FormActions; dirty guard; not-found state on edit.

**🛠 Master Prompt**
```
Create EmployeeForm used by addEmployee.jsx and editEmployee.jsx with the target design; keep API
calls and validation; inactive stays inactive on save.
```
**🧪 Test Prompt**
```
Create, invalid CNIC inline, duplicate email/CNIC server error inline, edit and save, not-found id.
Report.
```
**🔍 Bug-hunt Prompt**
```
Mask with paste, salary decimals, date timezone. Report.
```
**✅ Done when:** employee forms match the product forms' quality.

---

# Module 12 — Departments (`/admin/departments`)

### Step 12.1 Departments list and dialog
**Sections:** Add, table (No · Name · Status · Employees · Actions), Edit, Delete, dialog (Name, Description, Active).
**Target:** Header search plus an Active/Inactive filter. Card grid (departments are few): each card shows name, description, employee count (click → Employees filtered), Active chip, actions menu. Or keep a table if > 12. Dialog with LoadingButton; delete blocked with server message when employees exist.

**🛠 Master Prompt**
```
Rebuild department.jsx as a responsive card grid (DataTable fallback above 12 items) with the
dialog; keep API calls and the "in use" 409.
```
**🧪 Test Prompt**
```
Add, edit, deactivate, delete in-use (toast message), delete empty, click count → filtered
employees. Report.
```
**🔍 Bug-hunt Prompt**
```
Grid at 390/768/1440, long descriptions, empty state. Report.
```
**✅ Done when:** departments are clear and consistent.

---

# Module 13 — Suppliers

### Step 13.1 Supplier List (`/admin/suppliers`)
**Sections:** filters (Supplies, Distributor, Show Only Active), table (No · Name · Email · Phone · Supplies · Distributor · Status · Actions), Edit, Delete.
**Target:** Table: Supplier (avatar + name), Contact (email + phone), Supplies (up to 3 chips + "+2"), Distributor (link chip), Status (Switch with busy + toast, sends `{isActive}` only), Actions. Header "Add supplier".

**🛠 Master Prompt**
```
Rebuild allSupplier.jsx as above; keep the {isActive}-only toggle and delete endpoint.
```
**🧪 Test Prompt**
```
Toggle active (toast), filters, delete (confirm + toast), 390px cards. Report.
```
**🔍 Bug-hunt Prompt**
```
Toggle race, many supplies chips overflow, no distributor. Report.
```
**✅ Done when:** suppliers match other lists.

### Step 13.2 Add Supplier / Step 13.3 Edit Supplier
**Sections:** Supplier Info (Name, Phone, Email, Address), Details (Supplies, Distributor optional), Status, Discard, Save Supplier, Back, not-found.
**Target:** Shared `SupplierForm` with FormSections, Supplies as an Autocomplete multi-select with chips, Distributor Autocomplete, sticky FormActions, dirty guard, not-found state.

**🛠 Master Prompt**
```
Create SupplierForm used by addSupplier.jsx and editSupplier.jsx; keep API calls.
```
**🧪 Test Prompt**
```
Create, validate email/phone inline, edit, not-found id. Report.
```
**🔍 Bug-hunt Prompt**
```
Autocomplete keyboard use, removing all supplies, double submit. Report.
```
**✅ Done when:** supplier forms match the rest.

---

# Module 14 — Distributors (`/admin/distributors`)

### Step 14.1 Distributors list and dialog
**Sections:** filters (Category, Search by name, Show Only Active), Add, table (No · Name · Contact Person · Email · Suppliers · Phone · Supply · Status · Actions), Edit, Delete, dialog (Name, Contact Person, Phone, Email, Address, Supply Categories, Active).
**Target:** Table: Distributor (name + contact person), Contact (email + phone), Supplies (chips), Suppliers (count, click → Suppliers filtered), Status chip, Actions. The add/edit dialog becomes a right Drawer form (many fields) with FormSections; delete blocked while suppliers exist (server message toast).

**🛠 Master Prompt**
```
Rebuild distributor.jsx with DataTable + DistributorDrawer form as above; keep API calls and the
in-use 409.
```
**🧪 Test Prompt**
```
Add, edit, filter, delete in-use (toast), delete unused, count click-through. Report.
```
**🔍 Bug-hunt Prompt**
```
Drawer focus/escape, long addresses, email validation. Report.
```
**✅ Done when:** distributors match suppliers.

### 🧪 Modules 10–14 Gate
```
Run UI-SMOKE on Discounts, Employees (3), Departments, Suppliers (3), Distributors as admin and
manager. Every create/edit/delete/toggle had busy + toast + (for delete) confirm. Report a table.
```

---

# Module 15 — Error and redirect pages

### Step 15.1 Not found (`*`) and Access denied (`/admin/access-denied`)
**Sections:** message, back-home button (role home).
**Target:** Centered EmptyState-style pages inside the shell (sidebar visible when logged in): large illustration/icon in a tinted circle, title ("Page not found" / "You don't have access to this page"), explanation (for access denied: the role name and who to ask), primary "Go to <role home>" and secondary "Go back". HomeRedirect and guards show the top progress bar, not a blank screen, while resolving the session.

**🛠 Master Prompt**
```
Restyle views/Error/NotFound.jsx and AccessDenied.jsx as above; ensure routes/AdminRoutes.jsx and
HomeRedirect show Loader while checking the session.
```
**🧪 Test Prompt**
```
Random URL logged in/out; editor opens /admin/all-order → Access denied with role text; buttons go
to the right home; no blank flash on hard refresh of any page. Report.
```
**🔍 Bug-hunt Prompt**
```
Redirect loops between login and access-denied; ErrorBoundary fallback styled the same (throw a
test error). Report.
```
**✅ Done when:** every dead end is friendly and leads somewhere.

### Step 15.2 ErrorBoundary fallback
**Target:** Crashes inside a page show a card "Something went wrong on this page" with "Reload page" and "Go to dashboard", inside the shell, and log the error to console.error only.

**🛠 Master Prompt**
```
Style routes/ErrorBoundary.jsx fallback with ErrorState inside PageContainer.
```
**🧪 Test Prompt**
```
Temporarily throw in a page component → fallback renders; navigation still works. Report.
```
**🔍 Bug-hunt Prompt**
```
Fallback resets when navigating to another page. Report.
```
**✅ Done when:** crashes never show a white screen.

---

# Module 16 — Global polish and final audit

### Step 16.1 Responsive pass
```
🛠 For every screen in the page checklist fix layout at 360, 390, 768, 1024, 1440, 1920: no page
horizontal scroll, tables scroll inside their container or switch to card list, dialogs become
full-screen below 600px, sticky FormActions don't cover the last field, touch targets ≥ 40px.
🧪 Produce a page × width PASS/FAIL table (Playwright: scrollWidth ≤ innerWidth, screenshot each).
🔍 Hunt overlapping toasts/drawers/header, iOS Safari 100vh issues in drawers, landscape phone.
```
**✅ Done when:** the table is all PASS.

### Step 16.2 Accessibility pass
```
🛠 Every icon button aria-label + Tooltip; every input has a label; dialogs/drawers trap and return
focus; tables have header scope; status chips not colour-only (text inside); skip-to-content link;
visible focus ring; reduced motion respected.
🧪 Run axe (via @axe-core/playwright in the test script, dev only) on every screen; Lighthouse
accessibility ≥ 95 on Dashboard, Products, Orders, Login.
🔍 Keyboard-only walkthrough of: login, add product, update order status, adjust stock. Report
every trap or invisible focus.
```
**✅ Done when:** axe has zero serious/critical issues on all screens.

### Step 16.3 Consistency audit
```
🛠 Grep views/ and layout/ for style={{ (target: 0 for colour/spacing/radius/font), raw hex colours,
@mui/icons-material imports, Snackbar, window.confirm, toFixed(, toLocaleString(, "Loading...",
CircularProgress used as a page loader. Replace each with the shared component/token.
🧪 Report counts before/after per file.
🔍 Visually compare page headers, toolbars, tables and forms across all 25 screens side by side;
list any spacing/size/title/button-position differences and fix them.
```
**✅ Done when:** counts are zero (or justified) and screens are indistinguishable in style.

### Step 16.4 Action-feedback audit
```
🛠 Build a list of every interactive control on every screen (buttons, switches, menu items, row
actions, dialog actions, uploads, copy buttons, filters). For each, verify: busy state, success
toast (or visible result for filters), error toast with the server message, confirm for destructive
ones, no double submit.
🧪 Produce the control × check matrix (expect ~150 controls) with PASS/FAIL.
🔍 Simulate failures for each action (stop backend, return 409/500 via DevTools request blocking)
and confirm the UI recovers (buttons re-enabled, state rolled back).
```
**✅ Done when:** the matrix is all PASS.

### Step 16.5 Performance and cleanup
```
🛠 Lazy-load each page (already Loadable) and the charts; remove /admin/ui-kit route; delete unused
template components, images and fonts; check bundle size (vite build report) and keep the main
chunk under ~300 kB gzip; images lazy with width/height.
🧪 Lighthouse (production build via vite preview) on Dashboard and Products: Performance ≥ 85,
Best practices ≥ 95.
🔍 List the largest bundle modules and any unused dependency (slick-carousel, lodash-es, swr…) to
remove if unused.
```
**✅ Done when:** fast production build with no template leftovers.

### Step 16.6 Final visual QA and sign-off
```
🧪 For each of the 25 screens capture desktop (1440) and mobile (390) screenshots in light (and
dark) mode into docs/dashboard/ui-screens/, then review them as a set against the Design direction
table: colour, type scale, spacing, radius, icon style, header pattern, empty/loading/error states.
🔍 Bug-hunt: anything that looks "template-default" or different from the others is a FAIL.
Update docs/PROGRESS.md with "Dashboard UI complete" and the list of screenshots.
```
**✅ Done when:** every screen passes the visual review and PROGRESS.md is updated.

---

### Step 16.7 Visual regression baseline
```
🛠 Add a Playwright visual suite (scratch or tests/visual, dev-only dependency already present in
the scratch pw folder) that logs in as admin, seeds a fixed dataset (fixed dates via a test clock),
and captures every screen in Appendix A at 390 and 1440, light (and dark), for states: loading
(network delayed), empty, data, error. Use toHaveScreenshot with maxDiffPixelRatio 0.01 and mask
relative times.
🧪 Run twice: second run has 0 diffs (stable). Change one token (e.g. radius) → diffs appear on
every screen (the suite catches it). Revert.
🔍 Find flaky screenshots (animations, charts, times) and stabilise them (disable animations,
mask, fixed data). Report.
```
**✅ Done when:** a stable baseline exists and any visual change is caught before release.

### Step 16.8 Release checklist
```
🛠/🧪 Before calling the dashboard "production ready", confirm and report each item:
1. All 51+ steps logged in docs/PROGRESS.md; no step marked partial.
2. Performance and quality budgets table: every row measured on `vite build && vite preview`.
3. Appendix C state matrix: every cell verified (link the test or screenshot).
4. Appendix E design review: every screen scores 30/30.
5. UI-SMOKE passes for admin, manager, editor.
6. Visual regression baseline committed and green.
7. No /admin/ui-kit route, no customizer, no console output in production build.
8. Backend regression (existing pw suites: roles, orders, products, inventory, lists, client,
   authui, home, menu, notfound) still green — UI work broke no behaviour.
🔍 Anything not green is listed with an owner and a fix step; release only when the list is empty.
```
**✅ Done when:** every item is green.

---

## Appendix A — Screen × element coverage checklist

Tick each element when its step is done. If something is missing from this list, add it before you sign off.

| Screen | Elements to redesign |
|---|---|
| Shell | sidebar groups, nav items, collapse rail, mobile drawer, user card, header, toggle, breadcrumbs, quick-jump, notifications bell/badge/panel/items/mark-all/empty/error, profile menu/items/logout, footer, customizer (removed), top loader, page fade |
| Login | brand panel, card, logo, heading, email, password, toggle, error alert, 429 alert, submit, forgot link, footer |
| Forgot | card, email, submit, success panel, resend countdown, back link |
| Reset | password, strength bar, checklist, confirm, toggles, expired state, success redirect |
| Dashboard | header, refresh, error state, Revenue card, Orders card + toggle + sparkline, Completed card, Pending card, revenue/orders chart, latest orders list, View all, empty states, skeletons |
| All Products | header + Add, search, category, status, sort, filter chips, table (product, price, stock, active switch, featured, rating, actions), mobile cards, pagination, empty, error |
| Add/Edit Product | general, media upload, pricing + preview, status, organization, inventory, options, sticky actions, dirty guard, not-found, View in shop, delete |
| Categories list | header + Add, search, table, actions, delete confirm, empty |
| Add/Edit Category | form, image, counter, actions, not-found |
| Inventory | summary cards, All/Low/Out control, search, category, table, adjust dialog (mode, stepper, preview), toasts |
| Orders | status tabs, search, payment, period, clear, table, mobile cards, details drawer (customer, delivery, items, summary, payment, timeline, copy), status dialog (radio cards, R3 text), pagination |
| Users | search, table, history drawer (profile, stats, orders), pagination |
| Team access | role cards, table, chips, actions menu, invite dialog, change role dialog, reset link |
| Discount codes | table (code copy, usage bar, status), add/edit dialog (generate, slider, date, preview) |
| Employees | list (masked CNIC, chips), add/edit form (mask, salary, date), not-found |
| Departments | card grid, dialog, count link |
| Suppliers | list (active switch, chips), add/edit form (autocomplete), not-found |
| Distributors | list, drawer form, count link |
| Errors | 404, access denied, error boundary, session loader |
| Global | session-expired toast + redirect, offline banner, shared dropdown loading/retry, browser tab titles, logo variants, favicon, base cards (MainCard/SubCard), unused template components removed |

## Appendix C — State matrix (every page and card must have every state)

L = loading skeleton · E = empty state · X = error state with Retry · B = busy state on actions · T = toast on success/error · C = confirm before destructive action · ✓ = required · — = not applicable

| Screen / card | L | E | X | B | T | C |
|---|---|---|---|---|---|---|
| Session check (any guarded page) | ✓ (top bar + logo) | — | ✓ (offline banner) | — | ✓ (session expired) | — |
| Sidebar user card | ✓ | — | — | — | — | — |
| Notifications panel | ✓ | ✓ "You're all caught up" | ✓ | ✓ mark all | ✓ | — |
| Profile menu: change password / logout | — | — | — | ✓ | ✓ | — |
| Login / Forgot / Reset | — | — | ✓ Alert | ✓ | ✓ | — |
| Dashboard header refresh | ✓ | — | ✓ | ✓ | ✓ | — |
| StatCard ×4 (Revenue, Orders, Completed, Pending) | ✓ | ✓ (0 values shown as 0, not "—") | ✓ (card-level) | — | — | — |
| Revenue & orders chart | ✓ | ✓ | ✓ | — | — | — |
| Latest orders card | ✓ | ✓ | ✓ | — | — | — |
| All Products table | ✓ | ✓ + Clear filters | ✓ | ✓ toggle/delete | ✓ | ✓ delete |
| Add / Edit Product form | ✓ (edit) | — | ✓ not-found | ✓ save/upload | ✓ | ✓ discard if dirty, delete |
| Categories table | ✓ | ✓ | ✓ | ✓ delete | ✓ | ✓ |
| Add / Edit Category | ✓ (edit) | — | ✓ not-found | ✓ | ✓ | ✓ discard if dirty |
| Inventory summary cards | ✓ | ✓ | ✓ | — | — | — |
| Inventory table + adjust dialog | ✓ | ✓ | ✓ | ✓ | ✓ | — (adjust shows preview instead) |
| Orders tabs/table | ✓ | ✓ | ✓ | — | — | — |
| Order details drawer | ✓ | — | ✓ | ✓ copy | ✓ copy | — |
| Order status dialog | — | — | ✓ 409 | ✓ | ✓ | ✓ cancel |
| Users table | ✓ | ✓ | ✓ | — | — | — |
| Customer history drawer | ✓ | ✓ no orders | ✓ | — | — | — |
| Team access role cards + table | ✓ | — | ✓ | ✓ | ✓ | ✓ remove |
| Invite / change role dialogs | — | — | ✓ inline | ✓ | ✓ | — |
| Send reset link | — | — | — | ✓ | ✓ (honest mail error) | — |
| Discount codes table + dialog | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ delete |
| Copy code | — | — | — | — | ✓ | — |
| Employees table | ✓ | ✓ | ✓ | ✓ delete | ✓ | ✓ |
| Add / Edit Employee | ✓ (edit) | — | ✓ not-found | ✓ | ✓ | ✓ discard if dirty |
| Departments grid + dialog | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ delete |
| Suppliers table (active switch) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ delete |
| Add / Edit Supplier | ✓ (edit) | — | ✓ not-found | ✓ | ✓ | ✓ discard if dirty |
| Distributors table + drawer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ delete |
| Shared dropdowns (categories, departments, distributors) | ✓ loading row | ✓ "No options" | ✓ Retry | — | — | — |
| 404 / Access denied / ErrorBoundary | — | — | ✓ (is the state) | — | — | — |

Step 16.4 verifies this matrix control by control.

## Appendix D — File coverage map (every file in `src`)

Each file is either covered by a step, or marked as having no UI.

| File(s) | Step |
|---|---|
| `App.jsx`, `index.jsx`, `config.js`, `store/constant.js`, `themes/index.jsx`, `themes/palette.jsx`, `themes/typography.jsx`, `themes/shadows.jsx`, `themes/compStyleOverride.jsx`, `themes/overrides/index.js`, `themes/overrides/Chip.jsx` | 0.1, 0.2 |
| `ui-component/app/**` (new), `hooks/useAction.js` (new) | 0.3, 0.4 |
| `contexts/NotifyContext.jsx` | 0.4 |
| `ui-component/Loader.jsx`, `ui-component/Loadable.jsx`, `layout/NavigationScroll.jsx` | 0.5, 1.5 |
| `utils/format.js` | 0.6 |
| `menu-items/index.js`, `dashboard.js`, `Products.js`, `Categories.js`, `inventory.js`, `Orders.js`, `User.js`, `Permissions.js`, `workforce.js`, `other.js` | 0.7, 1.1 |
| `contexts/ConfigContext.jsx`, `hooks/useConfig.js`, `hooks/useLocalStorage.js` | 0.8, 1.1 (collapse state), 1.5 |
| `ui-component/cards/MainCard.jsx`, `SubCard.jsx`, `CardSecondaryAction.jsx`, `extended/AnimateButton.jsx`, `extended/Transitions.jsx`, `extended/Avatar.jsx`, `extended/Breadcrumbs.jsx` | 0.9 |
| `extended/Accordion.jsx`, `extended/AppBar.jsx`, `extended/ImageList.jsx`, `extended/Form/FormControl.jsx`, `extended/Form/FormControlSelect.jsx`, `extended/Form/InputLabel.jsx` (unused) | 0.9 (delete) |
| `views/context/index.jsx`, `api/client.js`, `routes/AdminRoutes.jsx`, `routes/HomeRedirect.jsx` | 0.10, 15.1 |
| `layout/MainLayout/index.jsx`, `MainContentStyled.js`, `Sidebar/index.jsx`, `Sidebar/MiniDrawerStyled.jsx`, `MenuList/**`, `LogoSection/index.jsx` | 1.1, 1.6 |
| `layout/MainLayout/Header/index.jsx` | 1.2 |
| `Header/NotificationSection/index.jsx`, `NotificationList.jsx` | 1.3 |
| `Header/ProfileSection/index.jsx` | 1.4 |
| `layout/MainLayout/Footer.jsx`, `layout/Customization/index.jsx`, `layout/Customization/BorderRadius.jsx`, `layout/Customization/FontFamily.jsx` | 1.5 |
| `ui-component/Logo.jsx`, `public/favicon.svg`, new `hooks/useDocumentTitle.js` | 1.6 |
| `layout/MinimalLayout/index.jsx`, `authentication/AuthWrapper1.jsx`, `AuthCardWrapper.jsx`, `ui-component/cards/AuthFooter.jsx` | 2.0 |
| `authentication/Login.jsx`, `auth-forms/AuthLogin.jsx` | 2.1 |
| `authentication/Forget.jsx`, `auth-forms/AuthForget.jsx` | 2.2 |
| `authentication/Reset.jsx`, `auth-forms/AuthReset.jsx`, `views/utils/password-strength.js` | 2.3 |
| `dashboard/Default/index.jsx` | 3.1 |
| `EarningCard.jsx`, `TotalOrderLineChartCard.jsx`, `cards/TotalIncomeDarkCard.jsx`, `cards/TotalIncomeLightCard.jsx`, `cards/Skeleton/EarningCard.jsx`, `cards/Skeleton/PopularCard.jsx`, `cards/Skeleton/TotalGrowthBarChart.jsx`, `cards/Skeleton/TotalIncomeCard.jsx`, `chart-data/total-order-month-line-chart.jsx`, `chart-data/total-order-year-line-chart.jsx` | 3.2 |
| `TotalGrowthBarChart.jsx`, `chart-data/total-growth-bar-chart.jsx` | 3.3 |
| `PopularCard.jsx` | 3.4 |
| `BajajAreaChartCard.jsx`, `chart-data/bajaj-area-chart.jsx` | 3.5 (delete) |
| `pages/product/allProduct.jsx`, `addProduct.jsx`, `editProduct.jsx`, `views/utils/getImageUrl.js` | 4.1–4.3 |
| `pages/category/allCategory.jsx`, `addCategory.jsx`, `EditCategory.jsx` | 5.1–5.3 |
| `pages/inventory/inventory.jsx` | 6.1 |
| `pages/order/allOrder.jsx` | 7.1–7.3 |
| `pages/user/allUser.jsx` | 8.1 |
| `pages/permission/allPermission.jsx`, `config/permissions.js` (read only) | 9.1 |
| `pages/discountCode/discount.jsx` | 10.1 |
| `pages/employee/allEmployee.jsx`, `addEmployee.jsx`, `editEmployee.jsx` | 11.1–11.3 |
| `pages/department/department.jsx` | 12.1 |
| `pages/supplier/allSupplier.jsx`, `addSupplier.jsx`, `editSupplier.jsx` | 13.1–13.3 |
| `pages/distributor/distributor.jsx` | 14.1 |
| `views/Error/NotFound.jsx`, `AccessDenied.jsx`, `routes/ErrorBoundary.jsx` | 15.1, 15.2 |
| `routes/index.jsx`, `MainRoutes.jsx`, `AuthenticationRoutes.jsx`, `RequireRole.jsx`, `safeNext.js`, `api/menu.js` | Read-only (routing and guards stay as they are); checked in 1.1 and 15.1 |
| `hooks/useScriptRef.js`, `serviceWorker.jsx`, `reportWebVitals.js`, `vite-env.d.js` | No UI; 16.5 removes them if unused |

## Appendix E — Design review checklist (30 points per screen)

Score each screen in Step 16.6. Every point is pass or fail, and a screen ships only at 30/30.

**Layout**
1. Uses PageContainer + PageHeader (title, breadcrumb, primary action on the right)
2. 24px gaps between sections; aligned to the 8px grid (check with an overlay)
3. Content width rules respected (page 1440, form 960/720)
4. Nothing touches the screen edge at 360px (16px gutter)
5. No page-level horizontal scroll at any width

**Typography and colour**
6. Only token font sizes and weights
7. One h-level per hierarchy step (no skipped levels)
8. Numbers use tabular figures and are right-aligned in tables
9. Only palette colours; status colours match their meaning everywhere
10. Text contrast AA, including text on chips, buttons and disabled states

**Components**
11. Buttons follow variants and sizes; only one primary action per area
12. Inputs have labels above, helper/error text below, and units
13. Tables follow the table spec (header, row height, hover, alignment)
14. Chips are pills with text; no colour-only status
15. Icons are from Tabler, at the right size, with a tooltip on icon-only buttons

**States**
16. Loading skeleton matches the layout (CLS < 0.05)
17. Empty state has an icon, a sentence and an action
18. Error state has a message and Retry
19. Disabled controls explain why (tooltip)
20. Long text, big numbers and missing images are handled

**Feedback**
21. Every action has a busy state
22. Success and error toasts follow the microcopy rules
23. Destructive actions confirm and name the item
24. No double submit possible
25. Undo offered where the action is reversible

**Access and polish**
26. Keyboard: logical tab order, visible focus, Esc closes overlays
27. Screen reader: landmarks, labelled controls, toasts announced
28. Wording: sentence case, verb + object buttons, consistent vocabulary
29. Browser tab title correct; breadcrumb correct; sidebar item highlighted
30. Matches its neighbours in the visual-regression set (same header, toolbar and table look)

## Appendix B — Files touched per module

| Module | Main files |
|---|---|
| 0 | `src/themes/*`, `src/config.js`, `src/index.jsx`, `src/ui-component/app/*` (new), `src/contexts/NotifyContext.jsx`, `src/hooks/useAction.js` (new), `src/utils/format.js`, `src/ui-component/Loader.jsx` |
| 1 | `src/layout/MainLayout/**`, `src/menu-items/*`, `src/layout/Customization/*`, `src/layout/NavigationScroll.jsx` |
| 2 | `src/views/pages/authentication/*`, `src/views/pages/auth-forms/*`, `src/views/utils/password-strength.js` |
| 3 | `src/views/dashboard/Default/*`, `src/ui-component/cards/*` |
| 4 | `src/views/pages/product/*` |
| 5 | `src/views/pages/category/*` |
| 6 | `src/views/pages/inventory/inventory.jsx` |
| 7 | `src/views/pages/order/allOrder.jsx` (+ new drawer/dialog components) |
| 8 | `src/views/pages/user/allUser.jsx` |
| 9 | `src/views/pages/permission/allPermission.jsx` |
| 10 | `src/views/pages/discountCode/discount.jsx` |
| 11 | `src/views/pages/employee/*` |
| 12 | `src/views/pages/department/department.jsx` |
| 13 | `src/views/pages/supplier/*` |
| 14 | `src/views/pages/distributor/distributor.jsx` |
| 15 | `src/views/Error/*`, `src/routes/ErrorBoundary.jsx`, `src/routes/AdminRoutes.jsx`, `src/routes/HomeRedirect.jsx` |
| 16 | all of the above + test scripts |
