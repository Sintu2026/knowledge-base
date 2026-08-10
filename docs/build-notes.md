# Build notes — decisions and deferred items

Running notes that supplement the spec. Newest at the bottom.

## Design direction (reworked before step 6) — applies to every later step

The spec's §3 minimalism, taken further: spacious, large type, minimal
chrome, Apple-adjacent. Structure was right; furniture was wrong.

- **Typeface: Inter**, loaded via next/font (`--font-inter` → `--font-sans`).
  Never system-ui.
- **Type scale with real contrast**, carried by tokens in globals.css (each
  size utility bundles its weight and tracking):
  - `text-page-title` — 34px / 500 / -0.025em. Every page opens on a hero
    title with generous space; never straight into controls.
  - `text-card-title` — 17px / 500 / -0.015em. The page title owns the
    scale; card titles never compete with the hero.
  - `text-section-head` — 20px / 500 / -0.015em (subcategory headings).
  - body 14px; `text-meta` — 12px for metadata, in `ink-faint`.
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
- **Primary and danger actions are coloured text** — no fill, no border.
  Weight comes from colour and placement, not saturation.
- **Motion**: under 200ms, eased, opacity and transform only. Cards lift
  -2px on hover (`duration-150 ease-out`); titles shift to accent.
- **Whitespace**: page shell `py-10/14`, heroes with `mt-8`+, section rows
  `py-10`, grids as above. When in doubt, add space rather than a line.

This rework resolved three step-4 polish notes (Add-knowledge weight, badge
placement, dashed add-tile prominence — now a plain text link) and the
step-3 draft-badge note (tiles show meta and badge together).

## For step 7 (block system)

- **Workflow vs SOP chip hints (from step-2 review).** The two block types
  overlap in contributors' heads — Month-end close carries both. The block
  chip row in the editor must carry hint text distinguishing them:
  - *Workflow* — the order of operations: what happens first, then next.
  - *SOP* — the gate criteria: what must be true before proceeding.
  Keep both available in every section; the hint is what prevents misuse.

## For step 11 (polish pass) — from step-3 review

- **Add-tile prominence.** The dashed "Add a feature here" tile competes with
  real content in single-feature modules. When a module row has fewer than
  three entries, shrink it — narrower tile or a plain text link.
- **Draft badge replaces tile meta.** Draft entries show the badge *instead
  of* the skill count line. Show both so tiles stay uniform.
- **Does difficulty earn its place?** Nearly every tile reads Beginner, which
  is noise. Watch it; consider dropping difficulty from tiles (keep it in the
  reader) if the distribution stays this flat.

## For step 11 (polish pass) — from step-4 review

- **Add knowledge weight.** The solid accent button dominates the monochrome
  landing. Make it outlined — accent text and border, transparent fill —
  still the page's single primary action, less weight.
- **Badge placement on cards.** Draft / Review overdue sit inside the pill
  row and push a pill to a second line, making those cards taller. Move the
  badge to the footer row or give it its own line.
- **Empty card footers.** Cards with no skill/workflow/document counts leave
  the footer half-empty; consider dropping the footer row when there are no
  counts.

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
