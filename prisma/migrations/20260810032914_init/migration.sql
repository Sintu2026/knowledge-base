-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('PROCESS', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "EntryTemplate" AS ENUM ('PROCESS', 'FEATURE');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('WHAT', 'WHY', 'HOW', 'WHO', 'WHEN');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('DOCUMENT', 'WORKFLOW', 'VIDEO', 'SOP', 'LINK', 'FILE');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('OWNER', 'APPROVER', 'CONTACT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatarInitials" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "order" INTEGER NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "template" "EntryTemplate" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'draft',
    "difficulty" "Difficulty",
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewedAt" TIMESTAMP(3),
    "reviewIntervalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "kind" "SectionKind" NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "type" "BlockType" NOT NULL,
    "order" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "videoFileId" TEXT,
    "videoUrl" TEXT,
    "durationSeconds" INTEGER,
    "posterFileId" TEXT,
    "transcript" TEXT,
    "transcriptSegments" JSONB,
    "chapters" JSONB,
    "sopBlockId" TEXT,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryTag" (
    "entryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "EntryTag_pkey" PRIMARY KEY ("entryId","tagId")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sectionId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchDoc" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "skillId" TEXT,
    "tsv" tsvector NOT NULL,

    CONSTRAINT "SearchDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_categoryId_slug_key" ON "Subcategory"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "Entry_categoryId_status_idx" ON "Entry"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Entry_subcategoryId_status_idx" ON "Entry"("subcategoryId", "status");

-- CreateIndex
CREATE INDEX "Entry_ownerId_idx" ON "Entry"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_entryId_kind_key" ON "Section"("entryId", "kind");

-- CreateIndex
CREATE INDEX "Block_sectionId_idx" ON "Block"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_sopBlockId_key" ON "Skill"("sopBlockId");

-- CreateIndex
CREATE INDEX "Skill_entryId_idx" ON "Skill"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_label_key" ON "Tag"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_entryId_userId_role_key" ON "Assignment"("entryId", "userId", "role");

-- CreateIndex
CREATE INDEX "Revision_entryId_createdAt_idx" ON "Revision"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_entryId_idx" ON "Comment"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDoc_skillId_key" ON "SearchDoc"("skillId");

-- CreateIndex
CREATE INDEX "SearchDoc_entryId_idx" ON "SearchDoc"("entryId");

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_sopBlockId_fkey" FOREIGN KEY ("sopBlockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryTag" ADD CONSTRAINT "EntryTag_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryTag" ADD CONSTRAINT "EntryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDoc" ADD CONSTRAINT "SearchDoc_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDoc" ADD CONSTRAINT "SearchDoc_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Hand-written search infrastructure (see docs: spec §6, §10).
-- SearchDoc is maintained entirely by the triggers below so the
-- index is correct for every writer and query time computes
-- nothing. Drafts are not indexed. Archived entries keep their
-- docs and are filtered out at query time, so un-archiving is
-- instantly searchable.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- difficulty is FEATURE-only
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_difficulty_feature_only_check"
CHECK ("template" = 'FEATURE' OR "difficulty" IS NULL);

-- One doc per entry. A plain unique on ("entryId", "skillId") would not do it:
-- Postgres treats NULLs as distinct, so entry docs (skillId NULL) need a
-- partial unique index. It doubles as the ON CONFLICT target below.
CREATE UNIQUE INDEX "SearchDoc_entry_doc_key" ON "SearchDoc"("entryId") WHERE "skillId" IS NULL;

-- Full-text and typo-tolerance indexes
CREATE INDEX "SearchDoc_tsv_idx" ON "SearchDoc" USING GIN ("tsv");
CREATE INDEX "Entry_title_trgm_idx" ON "Entry" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Skill_title_trgm_idx" ON "Skill" USING GIN ("title" gin_trgm_ops);

-- Searchable text inside a block payload, by type.
CREATE OR REPLACE FUNCTION kb_block_text(btype "BlockType", payload jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE btype
    WHEN 'DOCUMENT' THEN payload->>'filename'
    WHEN 'FILE'     THEN payload->>'filename'
    WHEN 'VIDEO'    THEN payload->>'title'
    WHEN 'LINK'     THEN concat_ws(' ', payload->>'title', payload->>'description')
    WHEN 'WORKFLOW' THEN (SELECT string_agg(concat_ws(' ', s->>'label', s->>'description'), ' ')
                          FROM jsonb_array_elements(coalesce(payload->'steps', '[]'::jsonb)) s)
    WHEN 'SOP'      THEN (SELECT string_agg(i->>'text', ' ')
                          FROM jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) i)
  END
$$;

-- Rebuild the doc for one skill.
-- Weights: A title, B chapter labels, D transcript — transcripts are long and
-- noisy, so they match but never outrank a title hit.
CREATE OR REPLACE FUNCTION kb_refresh_skill_doc(sid text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  eid text;
  est "EntryStatus";
BEGIN
  SELECT sk."entryId", e."status" INTO eid, est
  FROM "Skill" sk JOIN "Entry" e ON e."id" = sk."entryId"
  WHERE sk."id" = sid;

  IF eid IS NULL THEN
    RETURN; -- skill deleted; its doc went with it via FK cascade
  END IF;
  IF est = 'draft' THEN
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

-- Rebuild the docs for one entry and all of its skills.
-- Weights: A title, B summary + tag labels, C section bodies, D block text
-- (workflow step labels/descriptions, SOP item text, link titles/descriptions,
-- attachment filenames, video block titles).
CREATE OR REPLACE FUNCTION kb_refresh_entry_doc(eid text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  est "EntryStatus";
BEGIN
  SELECT "status" INTO est FROM "Entry" WHERE "id" = eid;

  IF est IS NULL THEN
    RETURN; -- entry deleted; docs went with it via FK cascade
  END IF;
  IF est = 'draft' THEN
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

-- Triggers. Row-level is fine at this scale: each refresh is one upsert
-- aggregating a few dozen rows, and entry creation fires it a handful of times.

CREATE OR REPLACE FUNCTION kb_trg_entry_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM kb_refresh_entry_doc(NEW."id");
  RETURN NULL;
END
$$;
CREATE TRIGGER "Entry_searchdoc_trg"
AFTER INSERT OR UPDATE OF "title", "summary", "status" ON "Entry"
FOR EACH ROW EXECUTE FUNCTION kb_trg_entry_changed();

CREATE OR REPLACE FUNCTION kb_trg_section_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM kb_refresh_entry_doc(COALESCE(NEW."entryId", OLD."entryId"));
  RETURN NULL;
END
$$;
CREATE TRIGGER "Section_searchdoc_trg"
AFTER INSERT OR DELETE OR UPDATE OF "body" ON "Section"
FOR EACH ROW EXECUTE FUNCTION kb_trg_section_changed();

CREATE OR REPLACE FUNCTION kb_trg_block_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  eid text;
BEGIN
  SELECT "entryId" INTO eid FROM "Section" WHERE "id" = COALESCE(NEW."sectionId", OLD."sectionId");
  IF eid IS NOT NULL THEN
    PERFORM kb_refresh_entry_doc(eid);
  END IF;
  RETURN NULL;
END
$$;
CREATE TRIGGER "Block_searchdoc_trg"
AFTER INSERT OR DELETE OR UPDATE OF "type", "payload" ON "Block"
FOR EACH ROW EXECUTE FUNCTION kb_trg_block_changed();

CREATE OR REPLACE FUNCTION kb_trg_skill_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM kb_refresh_skill_doc(NEW."id");
  RETURN NULL;
END
$$;
CREATE TRIGGER "Skill_searchdoc_trg"
AFTER INSERT OR UPDATE OF "title", "transcript", "chapters" ON "Skill"
FOR EACH ROW EXECUTE FUNCTION kb_trg_skill_changed();

CREATE OR REPLACE FUNCTION kb_trg_entrytag_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM kb_refresh_entry_doc(COALESCE(NEW."entryId", OLD."entryId"));
  RETURN NULL;
END
$$;
CREATE TRIGGER "EntryTag_searchdoc_trg"
AFTER INSERT OR DELETE ON "EntryTag"
FOR EACH ROW EXECUTE FUNCTION kb_trg_entrytag_changed();

CREATE OR REPLACE FUNCTION kb_trg_tag_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM kb_refresh_entry_doc(et."entryId") FROM "EntryTag" et WHERE et."tagId" = NEW."id";
  RETURN NULL;
END
$$;
CREATE TRIGGER "Tag_searchdoc_trg"
AFTER UPDATE OF "label" ON "Tag"
FOR EACH ROW EXECUTE FUNCTION kb_trg_tag_changed();
