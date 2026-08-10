-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- Soft-deleted entries leave search immediately. Both refresh functions now
-- treat a set deletedAt exactly like draft: docs are removed rather than
-- rebuilt (the entry-level DELETE also removes the entry's skill docs, which
-- carry entryId). Clearing deletedAt fires the trigger and rebuilds the docs,
-- so restore is instant — same shape as the archive decision.

CREATE OR REPLACE FUNCTION kb_refresh_skill_doc(sid text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  eid text;
  est "EntryStatus";
  edel timestamp;
BEGIN
  SELECT sk."entryId", e."status", e."deletedAt" INTO eid, est, edel
  FROM "Skill" sk JOIN "Entry" e ON e."id" = sk."entryId"
  WHERE sk."id" = sid;

  IF eid IS NULL THEN
    RETURN; -- skill deleted; its doc went with it via FK cascade
  END IF;
  IF est = 'draft' OR edel IS NOT NULL THEN
    DELETE FROM "SearchDoc" WHERE "skillId" = sid;
    RETURN;
  END IF;

  INSERT INTO "SearchDoc" ("id", "entryId", "skillId", "tsv")
  SELECT sid, eid, sid,
       setweight(to_tsvector('english', sk."title"), 'A')
    || setweight(to_tsvector('english', coalesce(ch.txt, '')), 'B')
    || setweight(to_tsvector('english', coalesce(sk."transcript", '')), 'D')
  FROM "Skill" sk
  LEFT JOIN LATERAL (
    SELECT string_agg(c->>'label', ' ') AS txt
    FROM jsonb_array_elements(coalesce(sk."chapters", '[]'::jsonb)) c
  ) ch ON true
  WHERE sk."id" = sid
  ON CONFLICT ("id") DO UPDATE SET "entryId" = EXCLUDED."entryId", "tsv" = EXCLUDED."tsv";
END
$$;

CREATE OR REPLACE FUNCTION kb_refresh_entry_doc(eid text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  est "EntryStatus";
  edel timestamp;
BEGIN
  SELECT "status", "deletedAt" INTO est, edel FROM "Entry" WHERE "id" = eid;

  IF est IS NULL THEN
    RETURN; -- entry deleted; docs went with it via FK cascade
  END IF;
  IF est = 'draft' OR edel IS NOT NULL THEN
    DELETE FROM "SearchDoc" WHERE "entryId" = eid;
    RETURN;
  END IF;

  INSERT INTO "SearchDoc" ("id", "entryId", "skillId", "tsv")
  SELECT e."id", e."id", NULL,
       setweight(to_tsvector('english', e."title"), 'A')
    || setweight(to_tsvector('english', coalesce(e."summary", '')), 'B')
    || setweight(to_tsvector('english', coalesce(tg.txt, '')), 'B')
    || setweight(to_tsvector('english', coalesce(se.txt, '')), 'C')
    || setweight(to_tsvector('english', coalesce(bl.txt, '')), 'D')
  FROM "Entry" e
  LEFT JOIN LATERAL (
    SELECT string_agg(t."label", ' ') AS txt
    FROM "EntryTag" et JOIN "Tag" t ON t."id" = et."tagId"
    WHERE et."entryId" = e."id"
  ) tg ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(s."body", ' ') AS txt
    FROM "Section" s WHERE s."entryId" = e."id"
  ) se ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(kb_block_text(b."type", b."payload"), ' ') AS txt
    FROM "Block" b JOIN "Section" s ON s."id" = b."sectionId"
    WHERE s."entryId" = e."id"
  ) bl ON true
  WHERE e."id" = eid
  ON CONFLICT ("entryId") WHERE "skillId" IS NULL
    DO UPDATE SET "tsv" = EXCLUDED."tsv";

  PERFORM kb_refresh_skill_doc(sk."id") FROM "Skill" sk WHERE sk."entryId" = eid;
END
$$;

-- The entry trigger must also fire on deletedAt flips (delete and restore).
DROP TRIGGER "Entry_searchdoc_trg" ON "Entry";
CREATE TRIGGER "Entry_searchdoc_trg"
AFTER INSERT OR UPDATE OF "title", "summary", "status", "deletedAt" ON "Entry"
FOR EACH ROW EXECUTE FUNCTION kb_trg_entry_changed();
