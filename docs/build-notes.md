# Build notes — orientation, decisions, and deferred items

Read `SPEC.md` first (contract, status, amendments). This file is the
working knowledge: how to run and verify the project, the gotchas that
cost time once already, and every decision that isn't obvious from the
code. Sections are grouped by topic, not strictly chronological.

## Orientation for a fresh session

**Workflow.** Work directly on `main` (no PRs — the branch
`claude/docker-to-postgres-migration-dzphln` on the remote is dead
history; ignore it). Build one step from SPEC.md's build order, verify it
in a real browser, push, and stop for Manpreet's review. Verification
style so far: headless-Chromium drive scripts (playwright-core) that
click through the actual flows and assert outcomes — publish lands in
search, deep links seek the video to the right second, failures render
visibly. Lint (`npm run lint`) and a production build (`npm run build`)
gate every push.

**Environment.** Local dev is a native PostgreSQL install — no Docker
(Manpreet's machine runs PostgreSQL 18 on Windows; docker was abandoned
because the WSL backend wouldn't start). Connection strings live in
`.env` (`DATABASE_URL` for the app pool, `DIRECT_URL` for the Prisma
CLI); `.env.example` documents everything including the optional
`ANTHROPIC_API_KEY` (Claude assist) and `ADMIN_EMAILS` (who may delete
any entry). `npm run db:check` is the connection doctor — it also warns
when `.env.local` disagrees with `.env`, which once caused an opaque
sign-in failure (Auth.js wraps DB errors in CallbackRouteError).

**Commands.** `npm run dev` · `npm run db:migrate` (prisma migrate dev) ·
`npm run db:seed` (wipe-and-recreate; 20 realistic entries, 12 skills
with transcripts/segments/chapters, users, placeholder PDFs in
`uploads/`) · `npm run db:check` · `npm run search:bench` (seeds 10k
entries + 1k skills with controlled term frequencies, asserts search
p95 < 100ms; last run's worst p95 was 88.6ms).

**Prisma 7 gotchas (each cost real time once):**
- The driver adapter is mandatory: `src/lib/db.ts` uses
  `@prisma/adapter-pg`; a bare PrismaClient throws at init.
- `prisma.config.ts` replaces package.json config *and* .env autoload
  (it imports dotenv itself). The CLI migrates over `DIRECT_URL`.
- `migrate dev` does **not** regenerate the client — run
  `npx prisma generate` (postinstall covers fresh installs).
- Hand-written indexes must also be declared in `schema.prisma` (the
  three GIN indexes carry `map:` names matching the SQL) or
  `migrate dev` detects drift and silently hangs on an interactive
  prompt when run through a pipe.
- Nullable Json columns clear via `Prisma.DbNull`, not plain `null`.

**Search architecture (the part no ORM shows).** `SearchDoc.tsv` is
maintained entirely by Postgres triggers written by hand in the init
migration (functions `kb_refresh_entry_doc`, `kb_refresh_skill_doc`,
`kb_block_text`; six triggers over Entry/Section/Block/Skill/EntryTag/
Tag). Weights: A = titles, B = summary + tags + chapter labels,
C = section bodies, D = block text + transcripts. Drafts and
soft-deleted entries have no docs at all; archived keeps docs, filtered
by `status = 'published'` at query time. Queries (`src/lib/search.ts`)
merge FTS with pg_trgm title similarity for typo tolerance and take the
top N on rank *before* joining taxonomy or computing ts_headline —
that ordering is what keeps p95 under 100ms. Snippets use «» as
highlight delimiters; skill hits resolve a transcript timestamp so
search can deep-link `?skill=&t=`. The soft-delete migration
re-created both refresh functions; any future change to them must keep
the `deletedAt` handling.

**Files.** Uploads live in `uploads/` (gitignored), served by
`/api/files/[id]` — auth-gated, with byte-range support (video
scrubbing; Safari refuses media without it). Server actions accept up
to 250mb bodies (`next.config.ts`) because screen recordings upload
through one. `lib/storage.ts` is the S3 seam; `lib/transcribe.ts` is
the transcription seam (returns null → manual paste field is the path).

**Per-viewer state** stays in localStorage, never the server (§11: no
analytics): `kb-watched` (skill Watched badges), `kb-sop:<blockId>`
(SOP checklist ticks), theme. `lib/use-local-json.ts` is the
hydration-safe hook (useSyncExternalStore; same-tab writes re-render
via a custom event — the react-hooks lint forbids setState-in-effect
patterns, see below).

**React 19 / Next 16 lint rules that shaped the code:** the
`react-hooks` rules `set-state-in-effect` and `refs` are enforced —
server-data-into-state adoption happens at render time via the
`prevKey` comparison pattern (see `use-drag-order.ts`, `InlineName`),
and refs like the editor's `latest` mirror are only ever written inside
event handlers. Next 16 notes: middleware is `proxy.ts`, page
params/searchParams are Promises, `PageProps<"/route">`/`RouteContext`
are global typed helpers, and the bundled docs at
`node_modules/next/dist/docs/` are authoritative (per AGENTS.md).

**Auth.** Entra ID, tenant-locked via the issuer, activates when the
`AUTH_MICROSOFT_ENTRA_ID_*` env vars exist; until then a dev-only
credentials provider signs in as dev@caizenhomes.com (development
builds only — production has no sign-in path until Entra is
registered). The jwt callback upserts the User row on sign-in;
`session.user.id` is always a DB cuid (or resolved lazily).
`trustHost: true` for self-hosted production.

## Open items for step 11 (polish pass)

- **Difficulty as noise**: nearly everything reads Beginner; decide
  whether difficulty earns its place on subcategory rows (keep it in the
  reader regardless). *(The other step-3/4 review notes — add-tile
  prominence, badge placement, empty card footers — died with the card
  grid in the browse restructure.)*
- Unify the skills Watched store onto `lib/use-local-json.ts`.
- FILE block type has schemas but no chip (Document covers uploads);
  decide whether it earns one.
- The skill form attaches existing SOPs only; creating an SOP inline
  from the skill form was deferred.
- Resolving "Suggest an edit" comments (or folding that into step 10).
- Quality bar sweep from the spec: 360px layouts, full keyboard
  reachability, reduced-motion.

## Design direction (reworked before step 6) — applies to every later step

The spec's §3 minimalism, taken further: spacious, large type, minimal
chrome, Apple-adjacent. Structure was right; furniture was wrong.

- **Typeface: Inter**, loaded via next/font (`--font-inter` → `--font-sans`).
  Never system-ui.
- **Type scale with real contrast**, carried by tokens in globals.css (each
  size utility bundles its weight and tracking). Current values — after
  two post-step-9 raises from the original 14px baseline:
  - `text-page-title` — 42px / 500 / -0.025em. Every page opens on a hero
    title with generous space; never straight into controls.
  - `text-card-title` — 20px / 500 / -0.015em. The page title owns the
    scale; card titles never compete with the hero.
  - `text-section-head` — 24px / 500 / -0.015em (subcategory headings).
  - body and `text-sm` 16px; `text-meta` — 14px for metadata, in
    `ink-faint`; `.section-label` 13px uppercase. Inputs are h-9 to fit.
- **Borders are earned.** Only genuinely interactive containers keep them
  (inputs, secondary buttons, modals, bordered row lists). Entry cards and
  tiles are borderless content blocks — no background, no radius —
  separated by whitespace: 48px vertical, 28px horizontal grid gaps —
  vertical space is what stops a grid reading as a table.
- **Section completeness = five bars**, 16×3px, 5px apart, rounded ends,
  sitting 16px clear of the title so they read as a separate signal.
  Filled accent, empty `hairline-strong`. Status badges sit beside the bar
  row, never inside it. An sr-only summary carries the signal non-visually.
- **Badges are muted text** — no fill, no outline (`text-meta`; Draft in
  `ink-faint`, Review overdue in `warning`). A badge annotates; it never
  competes with content.
- **Filter chips are text links** — active is full-weight ink, no pill.
- **Buttons are real controls** *(amended after the step-9 review — the
  text-only direction went too far)*: primary and danger are filled
  (`bg-accent`/`bg-danger` with their contrast tokens), secondary is
  bordered on `hairline-strong`, all at h-9/h-8 with real padding.
  Actions look like actions; the page around them stays calm, and colour
  still only lands on controls. Quiet text actions remain for tertiary
  things (assist, block chips, tags).
- **Type scale raised twice** *(both post-step-9 reviews — the first bump
  wasn't enough)*: now body/text-sm 16px, meta 14px, card-title 20px,
  section-head 24px, page-title 42px, section-label 13px; inputs at h-9 to
  fit. Hierarchy unchanged; entries read comfortably without leaning in.
- **The destination picker is creatable** *(second review — the important
  one)*: typing an unmatched name offers "Create …" inline for both
  levels. A new module asks which category; a new category asks its kind
  (software/department) and a first module, because entries live at the
  subcategory level. `createDestination` in actions/taxonomy.ts returns
  the id to select, unlike the admin actions. Taxonomy admin is for
  tidying up later — never a prerequisite for contributing.
- **Rail scrolls programmatically** *(same review)*: native hash
  navigation refuses to re-scroll when the hash hasn't changed, so repeat
  clicks silently did nothing. Anchor clicks now preventDefault,
  scrollIntoView, and replaceState the hash — every click scrolls.
- **Motion**: under 200ms, eased, opacity and transform only. Cards lift
  -2px on hover (`duration-150 ease-out`); titles shift to accent.
- **Whitespace**: page shell `py-10/14`, heroes with `mt-8`+, section rows
  `py-10`, grids as above. When in doubt, add space rather than a line.

This rework resolved three step-4 polish notes (Add-knowledge weight, badge
placement, dashed add-tile prominence — now a plain text link) and the
step-3 draft-badge note (tiles show meta and badge together).

## Browse restructure (after step 6) — Google, not Yahoo

The landing dumped twenty cards; now it is search-first and nearly empty,
with browsing as progressive disclosure. Each level shows one kind of
choice, so a product with twenty modules stays a clean list.

- **/** — vertically centred: product name, one ~520px rounded pill search
  input, two quiet doors (Browse software / Browse departments), one muted
  counts line at the bottom. Nothing else. A query still renders grouped
  results in place on this page (top-anchored, like a search engine).
- **/browse/software** and **/browse/departments** — only the categories of
  that kind, as small borderless tiles with module/area + entry counts.
  "Departments" is the browse-facing word for PROCESS categories.
- **/c/[category]** — only the modules or areas, as a plain bordered row
  list with entry counts. No entries, no filter chips at this level.
- **/c/[category]/[subcategory]** — the only level where entries appear.
  The section-completeness bars moved here (onto each entry row), keeping
  §8.1's "most important signal" alive at the moment of choosing an entry.
- Breadcrumbs on every level: Home › Software|Departments › Category ›
  Module. "Add knowledge" moved into the top bar, since the landing no
  longer hosts it; "Your entries" renders as a quiet row list on /.
- Superseded by this: §8.1's landing card grid and filter chips, and
  §8.2's per-module entry tiles. EntryCard/EntryTile/filter-chip
  components were deleted; SectionBars lives on in its own component.

## Decisions made in step 6 (editor shell)

- **Summary is editable under the title.** §8.3 never places Entry.summary;
  browse cards depend on it, so the editor puts a quiet one-line input
  directly beneath the title rather than hiding the field.
- **Publishing writes a Revision now.** Full history/diffs are step 10, but
  §2's "every change writes a Revision" starts mattering the moment content
  goes live — publish records an attributable snapshot and bumps version.
- **Template and owner are display-only in the editor.** Template is chosen
  at /new (defaulted from the destination category's kind, changeable
  there); ownership transfer can ride along with step 10's history work.
- **Setting a review cadence stamps reviewedAt.** Otherwise an entry becomes
  "overdue" the moment a cadence is chosen.
- **Section rail state** (accent when filled) considers body text only until
  step 7 adds blocks; the reader's completeness logic already counts blocks
  and skills.

## Soft delete + Claude assistance + blocks (after step 6)

- **Delete is soft.** `Entry.deletedAt` — never row removal, so it stays
  recoverable. The search refresh functions treat a set `deletedAt` exactly
  like draft (docs removed, skill docs included), so deletion drops out of
  search the moment it commits; every browse/count query filters
  `deletedAt: null`. Clearing the column rebuilds docs instantly — restore
  UI can ride along with step 10's history work; until then it's one
  `UPDATE` away for an admin.
- **Who deletes: owner or admin.** Admins are the emails in `ADMIN_EMAILS`
  (.env) — no role system, and `src/lib/access.ts` stays the entire
  permission model. The action is a quiet danger text link at the editor's
  foot, behind a dialog naming the entry.
- **Taxonomy admin counts still include soft-deleted entries** on purpose:
  those rows genuinely block subcategory deletion (FK) and move with
  archive flows, so hiding them from admin counts would lie to the person
  doing the moving.
- **Claude never drafts.** All four assist actions
  (`src/lib/actions/assist.ts`, model `claude-opus-5`) operate on what the
  author wrote: tighten a filled section, list a newcomer's open questions,
  derive title+summary once What has content, distill search phrases and
  let our own FTS find overlaps. Quiet meta-text actions; every suggestion
  sits in a read-only pane until explicitly accepted; nothing writes
  otherwise. Without `ANTHROPIC_API_KEY` the actions never render and the
  editor is fully functional.
- **Blocks (step 7 pulled forward).** Chip row — Video, Workflow, SOP,
  Document, Link — under "Add to this section", only when a section is
  open. Workflow/SOP carry the step-2 hint distinction on the chips
  (tooltips) and as the open form's descriptor line. Existing blocks render
  as compact rows (icon, title, muted meta, remove). Payload shapes are the
  seed's, validated by the Zod discriminated union in
  `src/lib/schemas/blocks.ts`. FILE stays a schema-level type with no chip
  for now; SOP items are all `required: true` until the reader needs the
  distinction. A section with blocks counts as content for the editor rail
  and stays expanded.

## Decisions made in step 8 (skills)

- **The read page hosts the player early.** §8.4's full read view is step 9,
  but deep links (`?skill=&t=`) target `/entry/[id]`, so the skills list and
  player render there now; step 9 builds the rail and section renderers
  around them. The deep link seeks after `loadedmetadata` and attempts
  play — when autoplay policy declines, the player sits paused at the right
  second, which is the promise "Jump to 0:52" actually makes.
- **Timestamped transcript paste becomes segments.** Lines like
  "0:12 Open the job…" parse into `transcriptSegments`, so manual
  transcripts get search jump targets, not just imported ones. Mixed or
  un-timestamped text stays plain — half-timed segments would produce
  wrong jumps. Saving is a full overwrite: pasting plain text over a
  segmented transcript drops the stale timings.
- **Duration and poster are measured client-side** at upload (metadata +
  canvas frame), including the MediaRecorder Infinity-duration workaround.
  URL-sourced videos get duration best-effort and no poster (canvas would
  taint); rows fall back to an icon.
- **`/api/files` serves byte ranges** (206/`Content-Range`) — scrubbing
  needs it and Safari refuses media without it. Server-action uploads are
  capped at 200 MB with `bodySizeLimit: 250mb` in next.config (the 1 MB
  default would have broken document blocks too).
- **SOP attach picks from existing SOP blocks** anywhere on the entry
  (`sopBlockId` is unique per skill — a second skill naming the same SOP is
  told which recording holds it). Creating an SOP inline from the skill
  form is deferred; features can add one via any other section's chips.
- **Watched is per-viewer localStorage** via `useSyncExternalStore`
  (server snapshot empty, same-tab writes re-render through a custom
  event). Nothing is tracked server-side (§11: no analytics).
- **Transcription stays a seam.** `lib/transcribe.ts` returns null;
  the editor's paste field is the path until a service is configured.

## Decisions made in step 9 (read view)

- **Markdown is a subset, rendered to React nodes.** The editor is a plain
  textarea, so `components/entry/Markdown.tsx` covers what one produces:
  blank-line paragraphs (every plain newline breaks — that's what Enter
  means in a textarea), `- `/`1. ` lists, **bold**, inline code. No HTML
  strings, nothing to sanitise; it's the one file to swap for a real
  pipeline if the editor ever grows one.
- **Rail active-state**: IntersectionObserver triggers recomputation, but
  active = the last section whose top passed the reading line (upper
  third), with a bottom-of-page override — "topmost visible" kept a tall
  How section active after jumping to When. Below 900px the rail is a
  horizontal strip pinned under the header; the Reviewed line shows in the
  column layout only (the metadata line carries it on small screens).
- **"Suggest an edit" writes a Comment**; unresolved comments render as a
  quiet Suggestions list at the page foot. Resolving them (and section-
  scoped suggestions) rides with step 10's history work.
- **Empty sections stay in the rail, not the page** — the rail is the
  what's-missing signal; rendering empty section shells would just be
  scaffolding. WHO renders assignments after its body; WHEN's cadence
  already lives in the rail/meta line.
- **Mark reviewed stamps reviewedAt only** — it's an attestation, not a
  content change, so no Revision is written (§2 covers content changes).
- **Per-viewer SOP state** generalised into `lib/use-local-json.ts`
  (useSyncExternalStore over localStorage with a same-tab change event);
  step 11 can migrate the skills Watched store onto it.

## Decisions made in step 3

- **Taxonomy archiving needs a flag the §5 data model lacks.** §8.5 requires
  archiving categories and subcategories; added `archivedAt DateTime?` to both
  (migration `taxonomy_archive`). Archived nodes disappear from browse and
  category pages but stay in admin with a restore action.
- **Archiving a subcategory** requires choosing a destination subcategory for
  its entries (per §8.5). **Archiving a category** requires its subcategories
  to be empty or archived first — entries move at the subcategory level, so
  the category-level flow stays one decision instead of a mapping table.
- **Browse counts include drafts, exclude archived entries.** Drafts are
  visible work-in-progress on browse surfaces (search is where they are
  excluded); archived entries are reachable from links and history only.
