# SPEC — internal knowledge base portal

This file is the build contract. It has two layers:

1. **Status and amendments** (this top section) — where the build stands
   and every place review decisions overrode the original text.
2. **The original spec, verbatim** — below the divider, exactly as it was
   given at the start of the project.

A fresh session should read this file top to bottom, then
`docs/build-notes.md` for the working orientation (environment, gotchas,
verification workflow) and the full decision log. The rhythm throughout:
**build one numbered step, verify it in a browser, push to `main`, stop
for review** — never run ahead into the next step.

## Where the build stands

Build order (§9 below), all pushed to `main`:

- [x] 1. Scaffold, tokens, Tailwind, dark mode, auth, `components/ui/` (`/kitchen-sink`)
- [x] 2. Prisma schema, migrations, seed — plus the full search infrastructure
- [x] 3. Taxonomy admin, category and subcategory pages
- [x] 4. Landing browse with filters *(later superseded — amendment A3)*
- [x] 5. Search (front door on `/`, results in place)
- [x] 6. Editor shell (title, destination, five sections, autosave, publish)
- [x] 7. Block system (union, row primitive, block editors)
- [x] 8. Skills: editor, player with chapters, deep links, transcript search
- [x] 9. Read view with rail and all renderers
- [x] 10. Revisions, history, diffs, review cadence — including the
  deferred items: ownership transfer, restore-from-delete UI, resolving
  "Suggest an edit" comments, and the notifications no-op seam.
- [ ] **11. Accessibility and polish pass — NEXT.** Accumulated notes live
  in `docs/build-notes.md` under "Open items for step 11".

Built beyond the numbered steps, by review request:

- **Soft delete** for entries (`deletedAt`, recoverable; owner or
  `ADMIN_EMAILS` admins; confirmation names the entry).
- **Claude assistance in the editor** — four quiet actions that never
  draft content (Tighten this, What's missing?, Suggest title and
  summary, Find related). Requires `ANTHROPIC_API_KEY`; the editor is
  fully functional without it. This does not touch §11's "AI-assisted
  drafting stays out of scope" — assist only ever operates on what the
  author already wrote.
- **Creatable destination picker** — new categories and modules are
  created inline from `/new` and the editor; taxonomy admin is for tidying
  up, never a prerequisite for contributing.

## Amendments — where review decisions override the text below

- **A1 — Drafts are excluded from search entirely** (step-2 review).
  §6's scope reads as if everything is indexed; in fact drafts have no
  SearchDocs at all (a half-written thought found in search gets acted
  on regardless of a badge). Archived entries keep their docs but are
  filtered out at query time, so un-archiving is instant.
- **A2 — The design was reworked twice, and §3/§8's pixel sizes are
  superseded.** Before step 6: Inter via next/font, hero page titles,
  borderless content blocks, whitespace over lines. After step 9, two
  reversals of the "quiet" direction by review: **buttons are real
  controls again** (filled primary/danger, bordered secondary, real
  padding) and the **type scale was raised twice** (body is now 16px,
  metadata 14, card titles 20, section heads 24, page titles 42). The
  binding version of the design direction lives in
  `docs/build-notes.md`; §3's principles (one accent, no decoration,
  two font weights) still hold.
- **A3 — Browse was restructured ("Google, not Yahoo")** after step 6.
  The landing is nearly empty: product name, one ~520px pill search
  input, two quiet doors (Browse software / Browse departments), one
  counts line. Search results render in place on `/`. Browse is
  progressive disclosure: `/browse/software` and `/browse/departments`
  (category tiles) → `/c/[category]` (modules/areas only) →
  `/c/[category]/[subcategory]` (the only level showing entries, with
  the section-completeness bars on each row). §8.1's card grid and
  filter chips and §8.2's per-module entry tiles are superseded;
  "Add knowledge" lives in the top bar.
- **A4 — Workflow vs SOP hint text** (step-2 review). The two block
  types overlap in contributors' heads, so the editor's chips and forms
  carry the distinction: *Workflow — the order of operations: what
  happens first, then next. SOP — the gate criteria: what must be true
  before proceeding.*
- **A5 — Auth ships with a dev fallback.** The Entra app registration
  doesn't exist yet, so a dev-only credentials provider
  ("Continue as dev user", dev@caizenhomes.com) is active in
  development builds only. The tenant-locked Entra config activates
  itself once the `AUTH_MICROSOFT_ENTRA_ID_*` variables are set.
  `trustHost: true` is set for self-hosted production.
- **A6 — Two-level taxonomy vocabulary in browse**: PROCESS categories
  surface as "Departments" with "areas"; SOFTWARE categories hold
  "modules" of "features" (§8.2's wording, applied everywhere).

---

*The original spec follows, verbatim.*

# Build prompt — internal knowledge base portal
Paste this whole file into Claude Code as the opening message. It is written as instructions to the agent.
---
## 1. What you are building
An internal knowledge base web app. Employees capture the things the team keeps re-explaining, and every entry answers the same five questions in the same order: **what, why, how, who, when**.
There are two kinds of entry, sharing one spine:
- **Process entries** — a way of working. Sections read as What / Why / How / Who / When.
- **Feature entries** — how to do one specific thing in a piece of software. Same five sections, relabelled, and the How section is an ordered list of **skill recordings** rather than free text.
Do not build two separate editors. One entry model, one editor, one reader; a `template` field swaps section labels and swaps what the How section renders. Two parallel UIs is exactly the clutter this product is trying to avoid.
Everything lives under a two-level taxonomy of **category → subcategory**. For a software product, the category is the product and the subcategories are its modules.
Primary user: a subject-matter expert with fifteen minutes, who will abandon the form if it feels like paperwork.
Secondary user: a colleague six months later trying to unblock themselves in under a minute.
## 2. Access model
Every authenticated employee can read everything and create or edit anything. There are no private spaces, no per-category permissions, no request-access flow. Build it open.
Two guardrails that do not compromise that:
- Every change writes a `Revision` with an author. Open editing is safe when it is reversible and attributable.
- `Entry.ownerId` is a name on the page, not a lock. Anyone can edit; the owner is who to ask and who gets the review reminder.
Keep the permission check itself in one file (`lib/access.ts`) exporting `canRead`, `canEdit`, `canDelete`. Right now they return `true` for any signed-in user. When the company later wants a restricted category, that is one file to change rather than an audit of every route.
## 3. Design direction — read this before writing UI code
Minimal and modern in the strict sense: very few elements, precise spacing, one accent colour, nothing decorative.
- Neutral canvas, white cards, hairline borders, generous whitespace.
- One accent colour, used only for the primary action, the active nav item, and a filled-section state. Nothing else is coloured. Category colours, per-module palettes, and type-badge rainbows are all forbidden — they are the fastest route to clutter.
- No gradients, no drop shadows except focus rings, no glassmorphism, no illustrations, no emoji.
- Type: one sans family, two weights (400 and 500). Never 600 or 700. Sentence case everywhere including buttons and headings. Section labels in the reader are the one exception — small uppercase with letter-spacing.
- Icons: `lucide-react`, outline only, 16–20px.
- Radius: 8px on controls, 12px on cards. No other values.
- Section rail: a 2px left border marks each of the five sections — accent when filled, muted when empty. No rounded corners on single-sided borders.
- Density: prefer bordered rows to rounded cards for any list longer than four items. Cards are for browsing, rows are for scanning.
- Copy: verb-first buttons, no "please", no "successfully", no exclamation marks. Errors say what happened and what to do. Empty states are an invitation, not an apology.
Put design tokens in one CSS file as custom properties and reference them everywhere. No hardcoded hex in components. Light and dark mode from the start, via `data-theme` on `<html>`.
## 4. Stack
- Next.js (App Router) + TypeScript, strict mode
- Tailwind CSS with the token palette mapped into `tailwind.config.ts` so utilities read the CSS variables
- Postgres via Prisma. Use Postgres from day one, not SQLite — full-text search depends on it.
- File uploads behind a storage interface (`saveFile`, `getFileUrl`, `deleteFile`), local disk in dev, S3-compatible later
- Zod for all input validation, shared client and server
- No component library. Build the primitives in `components/ui/`: `Button`, `Input`, `Textarea`, `Select`, `Combobox`, `Badge`, `Card`, `Row`, `Modal`, `Toast`, `Tabs`, `Avatar`, `Breadcrumbs`, `EmptyState`.
Authentication: wire a single provider (email magic link or the company SSO) so that "every employee has access" is real. Everything downstream reads `getCurrentUser()`.
## 5. Data model
```
User          id, name, email, avatarInitials, createdAt
Category      id, name, slug, kind (PROCESS | SOFTWARE), description, icon, order
Subcategory   id, categoryId, name, slug, description, order
              // for a SOFTWARE category, a subcategory is a module
Entry         id, title, summary, template (PROCESS | FEATURE),
              categoryId, subcategoryId, ownerId,
              status (draft | published | archived),
              difficulty (BEGINNER | INTERMEDIATE | ADVANCED)?,   // FEATURE only
              version, reviewedAt, reviewIntervalDays, createdAt, updatedAt
Section       id, entryId, kind (WHAT | WHY | HOW | WHO | WHEN), body (markdown), order
Block         id, sectionId, type, order, payload (JSON)
Skill         id, entryId, title, order, videoFileId?, videoUrl?, durationSeconds?,
              posterFileId?, transcript (text)?, chapters (JSON)?, sopBlockId?
Tag           id, label
EntryTag      entryId, tagId
Assignment    id, entryId, userId, role (OWNER | APPROVER | CONTACT)
Revision      id, entryId, authorId, createdAt, snapshot (JSON)
Comment       id, entryId, sectionId?, authorId, body, resolved, createdAt
SearchDoc     entryId, skillId?, tsv (tsvector), GIN indexed
```
Every entry is created with all five section rows immediately, in fixed order. Sections are never deleted, only left empty — this keeps the reader's rail stable and makes "what's missing" a trivial query.
Taxonomy is exactly two levels. Resist any request to nest deeper: three levels of category is where knowledge bases go to die, and a tag can express anything the third level would have.
`Block.payload` is a discriminated union on `type`, with a Zod schema each:
- `DOCUMENT` — `{ fileId, filename, mimeType, sizeBytes }`
- `WORKFLOW` — `{ steps: [{ id, label, description?, ownerId?, durationHint? }] }`
- `VIDEO` — `{ source: "upload" | "url", fileId?, url?, title, durationSeconds?, posterFileId? }`
- `SOP` — `{ items: [{ id, text, required: boolean }] }`
- `LINK` — `{ url, title, description? }`
- `FILE` — `{ fileId, filename, mimeType, sizeBytes }` for anything else
Validate payload against the matching schema on write. Never trust the client's `type` alone.
A `Skill` is a first-class row rather than a block because it needs to be searchable, linkable, and orderable on its own. A skill is a short screen recording — typically under three minutes — that shows one thing being done, optionally paired with an SOP block for the written version.
### Section labels by template
| Section | PROCESS | FEATURE |
|---|---|---|
| WHAT | What | What it does |
| WHY | Why | Why it matters |
| HOW | How | Skills — how to do it |
| WHO | Who | Who uses it |
| WHEN | When | When to use it |
Hints under each label, also template-dependent:
- PROCESS — "The thing itself, in one paragraph" / "The reason it exists and what breaks without it" / "The steps, in order" / "Owner, approvers, and who to ask" / "Triggers, deadlines, and review cadence"
- FEATURE — "What this feature is for" / "What goes wrong without it" / "Record yourself doing it, one skill per recording" / "Roles and teams who need this" / "The moment in the workflow where this happens"
## 6. Search
Search is the product's front door, so it lives on the landing page and results render **in place on that same page** — no separate results route, no modal, no navigating away. The URL updates to `/?q=...` so a search is shareable and back returns to browsing.
Scope: the entire database. Indexed into `SearchDoc` are entry titles, summaries, all five section bodies, workflow step labels, SOP item text, link titles, attachment filenames, skill titles, and skill transcripts.
Behaviour:
- Postgres full-text search with `ts_rank_cd`, plus trigram similarity for typo tolerance on titles.
- Debounce 200ms, search as the user types, cancel in-flight requests.
- Results group under three quiet uppercase headings, in this order: **Categories**, **Entries**, **Skill recordings**. Omit a group entirely when it has no hits — never render an empty group.
- Each entry result shows title, a type badge, its `Category › Subcategory` breadcrumb, and a one-line snippet naming which section matched, with the matched term highlighted in a warning tint.
- Each skill result shows title, duration, its breadcrumb, and — when the hit was in the transcript — the timestamp, with a `Jump to 0:52` action that deep-links to `/entry/[id]?skill=[skillId]&t=52` and starts the player there.
- A result count line above the groups: "14 results across 5 categories".
- Clearing the input restores the browse view exactly as it was, including active filters.
- No results: one line stating nothing matched, then a `Add this to the knowledge base` button that opens the editor with the query pre-filled as the title. A failed search is the best possible moment to catch a contribution.
Keyboard: `/` focuses the search input from anywhere. Arrow keys move through results, Enter opens, Escape clears.
## 7. Routes
| Route | Purpose |
|---|---|
| `/` | Landing — browse, and search results in place |
| `/c/[category]` | Category page — subcategory sections with their entries |
| `/c/[category]/[subcategory]` | Subcategory page — full entry list |
| `/new` | Create entry: pick template and destination, then redirect to edit |
| `/entry/[id]` | Read view |
| `/entry/[id]/edit` | Editor |
| `/entry/[id]/history` | Revisions and diffs |
| `/admin/taxonomy` | Manage categories and subcategories |
## 8. Screen specs
### 8.1 Landing — `/`
Top bar: product mark and name left; `Browse`, `Your entries`, avatar right. Bottom hairline. No sidebar — the taxonomy lives in the page body, not in permanent chrome.
One row beneath: full-width search input, then the `Add knowledge` button as the single accent action on the page.
Default (no query) shows browse: a chip row of filters (`All`, plus each category, plus `Has recording` and `Needs review`), then the entry card grid at `repeat(auto-fit, minmax(280px, 1fr))`, 12px gap. Each card carries:
- Five small pills — What, Why, How, Who, When — filled in accent tint when that section has content, neutral when empty. This completeness signal is the most important thing on the card.
- Title, two-line clamped summary.
- Footer: `Category › Subcategory`, and counts of skills, workflows, and documents with icons.
With a query, the chip row and grid are replaced by the grouped results described in section 6. Same page, same input position — the input must not move or resize between the two states.
Below either state, a dashed prompt card: "Add what your team keeps re-explaining" with the add button. When the database is empty this is the whole page, larger, with a second action to set up the first category.
### 8.2 Category page — `/c/[category]`
Breadcrumbs, then the category name at 22px/500 and a counts line — "6 modules · 38 features · 91 skill recordings" for a software category, "4 areas · 22 processes" for a process one.
Then one section per subcategory, separated by hairlines rather than boxed in cards:
- Subcategory name at 16px/500, an entry count beside it in muted text, and an `Open module` (or `Open area`) link pushed right.
- A grid of compact entry tiles: title, then a muted line with skill count and difficulty.
- The last tile in each grid is a dashed `+ Add a feature here` that opens the editor pre-scoped to that subcategory. Contribution should always be one click from where the gap is visible.
- A subcategory with no entries collapses to a single muted row with `Add the first one`. Do not hide it — a visible gap is the prompt.
A filter chip row above: `All modules`, difficulty levels, `Has recording`, `Needs review`.
### 8.3 Editor — `/entry/[id]/edit`
Autosave 800ms after typing stops, with a quiet `Draft saved` label — never a toast.
Header: `Back` left; save indicator, `Save draft`, and accent `Publish` right. Publishing requires only a title, a destination subcategory, and a non-empty What. Everything else can come later and shows as partial. Do not put up a validation wall.
Title is a borderless 20px/500 input. Beneath it a chip row: category and subcategory picker (a single combobox searching both levels), template badge, owner chip, `+ Add tag`.
Then the five sections in fixed order, all rendered by one `SectionEditor` component that takes the template to resolve its label and hint. Each has:
- The 2px rail, accent when filled.
- A markdown textarea, borderless until focus, growing with content.
- Existing blocks as compact rows: type icon, label, muted metadata, remove control.
- A block-type chip row: Document, Workflow, Video, SOP, Link. Every section offers every type.
- When entirely empty: a dashed placeholder with a one-line prompt and a `Write this section` button that expands the full surface. This keeps first load short and unintimidating.
Template-specific behaviour in HOW:
- PROCESS — as above.
- FEATURE — the block chips are replaced by a skills list. Each row is a numbered drag-handle, a thumbnail, a title input, and duration. `+ Add a skill recording` opens the skill editor: upload a video or paste a URL, title it, optionally add chapters as `timestamp — label` lines, and optionally attach an SOP as the written fallback. Auto-generate a transcript on upload if a transcription service is configured; leave the seam (`lib/transcribe.ts`) and a manual paste field if not. The free-text body stays available above the list for context, but it is optional and collapsed by default.
WHO additionally renders an assignment picker writing to `Assignment`. WHEN additionally renders the review cadence select writing to `reviewIntervalDays`.
Keyboard: `Cmd/Ctrl+S` saves, `Cmd/Ctrl+Enter` publishes, tab order strictly top to bottom.
### 8.4 Read view — `/entry/[id]`
Breadcrumbs at the top: `Category › Subcategory › Entry`.
Two columns: a 120px sticky rail listing the five section names as anchors, active one in accent, driven by an intersection observer; content on the right. Below 900px the rail becomes a horizontal strip pinned under the header.
Under a hairline in the rail: `Reviewed` and a relative timestamp, switching to the warning token and `Review overdue` when past cadence.
Content: title at 22px/500, then a muted metadata line — template badge, difficulty for features, owner, review date. Archived entries get a full-width muted banner instead.
Each section renders as a small uppercase muted label, the markdown body, then its blocks. Documents as rows with size and download; videos as a poster row that expands to an inline player in place; workflows as a read-only step chain; SOPs as a checklist with per-viewer state in `localStorage` and a `3 of 7 done` counter; links as title over hostname.
For a FEATURE entry, HOW renders the skills list: numbered, thumbnail, title, duration, chapter count, and a per-viewer `Watched` badge. Playing expands the player in place with a chapter list. If the URL carries `?skill=&t=`, scroll to that skill, expand it, and seek.
Footer actions above a hairline: `Add a skill recording` (features), `Edit`, `Suggest an edit`, `Mark reviewed`, `Copy link`. Because access is open, `Edit` goes straight to the editor for everyone — no request flow.
### 8.5 Taxonomy admin — `/admin/taxonomy`
A plain two-level list. Add, rename, reorder by drag, and archive categories and subcategories. Archiving requires choosing where existing entries move. Deleting a subcategory with entries is blocked with a message naming the count.
## 9. Build order
Stop after each for review:
1. Scaffold, tokens, Tailwind config, dark mode, auth, and `components/ui/` on a `/kitchen-sink` page.
2. Prisma schema, migrations, and seed: two software categories with modules, two process categories, twenty entries at varying completeness, and a dozen skills with transcripts.
3. Taxonomy admin, category and subcategory pages.
4. Landing browse view with filters.
5. Search: `SearchDoc`, triggers to keep it current, the API, and the in-place grouped results.
6. Editor shell: title, destination, five sections, autosave, publish.
7. Block system: the union, the row primitive, then the six block editors.
8. Skills: model, editor, player with chapters, deep links, transcript search.
9. Read view with rail and all renderers.
10. Revisions, history, diffs, review cadence.
11. Accessibility and polish pass.
## 10. Quality bar
- Responsive from 360px. Test the editor at 360px specifically — the workflow chain and chip rows break there first.
- Search must feel instant. Index on write via a Postgres trigger, never compute at query time. Target sub-100ms on 10,000 entries; seed that many in a load-test script and prove it.
- Every interactive element keyboard-reachable with a visible focus ring; modals trap and restore focus.
- Colour is never the only signal — section pills carry a filled/outline distinction as well as a colour change.
- `prefers-reduced-motion` respected; transitions under 200ms, opacity and transform only.
- Server components by default; `"use client"` only where interaction requires it.
- No `any`. Zod schemas are the source of truth — infer types, never duplicate them.
- Seed data must read like a real company's knowledge base. Write plausible finance, procurement, and software-training content, not `Lorem ipsum`.
## 11. Out of scope for now
Per-category permissions, approval workflows before publish, notifications, AI-assisted drafting, Slack or email integration, analytics, in-app screen recording. Leave clean seams — a `lib/notifications.ts` of no-ops is enough — but build none of it. Screen recordings are uploaded from whatever tool the recorder already uses.
## 12. Before you start
Read this whole spec, then reply with:
1. Your proposed file and folder structure.
2. The token palette, as named hex values for both modes.
3. Your search indexing approach, concretely — which triggers, which columns, which weights.
4. Anywhere this spec is ambiguous or where you would push back.
Wait for my confirmation before writing code.