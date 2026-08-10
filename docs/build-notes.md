# Build notes — decisions and deferred items

Running notes that supplement the spec. Newest at the bottom.

## For step 7 (block system)

- **Workflow vs SOP chip hints (from step-2 review).** The two block types
  overlap in contributors' heads — Month-end close carries both. The block
  chip row in the editor must carry hint text distinguishing them:
  - *Workflow* — the order of operations: what happens first, then next.
  - *SOP* — the gate criteria: what must be true before proceeding.
  Keep both available in every section; the hint is what prevents misuse.

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
