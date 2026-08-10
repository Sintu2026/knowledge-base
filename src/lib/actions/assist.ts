"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/format";

/*
 * Claude assistance for the editor. The hard rule, enforced by prompt and
 * by shape: Claude never drafts section content from scratch. Every action
 * reads what the author already wrote — tightening it, questioning it, or
 * searching around it — and nothing lands in a field without an explicit
 * accept in the UI. Without ANTHROPIC_API_KEY the actions refuse quietly
 * and the editor never shows them.
 */

const MODEL = "claude-opus-5";

const SYSTEM =
  "You help Caizen Homes staff refine entries in their internal knowledge " +
  "base, which documents how the team uses its software and runs its " +
  "processes. Accuracy is critical: never invent facts, steps, tool names, " +
  "amounts, dates, or people. Work only with what the author wrote.";

export type TightenResult =
  | { ok: true; text: string }
  | { ok: false; error: string };
export type QuestionsResult =
  | { ok: true; questions: string[] }
  | { ok: false; error: string };
export type TitleSummaryResult =
  | { ok: true; title: string; summary: string }
  | { ok: false; error: string };
export type RelatedEntry = { id: string; title: string; breadcrumb: string };
export type RelatedResult =
  | { ok: true; related: RelatedEntry[] }
  | { ok: false; error: string };

type Failure = { ok: false; error: string };

function fail(error: string): Failure {
  return { ok: false, error };
}

// The editor hides assist entirely when the key is absent; this guard is
// for anyone calling the action directly.
function claude(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

function apiFail(error: unknown): Failure {
  if (error instanceof Anthropic.AuthenticationError) {
    return fail("The Anthropic API key was rejected — check ANTHROPIC_API_KEY.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return fail("Claude is rate-limited right now. Try again in a minute.");
  }
  if (error instanceof Anthropic.APIError) {
    return fail("Claude is unreachable right now. Your writing is unaffected.");
  }
  throw error;
}

async function assistUser() {
  const user = await getCurrentUser();
  return canEdit(user) ? user : null;
}

const tightenInput = z.object({
  entryId: z.string().min(1),
  kind: z.enum(["WHAT", "WHY", "HOW", "WHO", "WHEN"]),
  body: z
    .string()
    .trim()
    .min(
      60,
      "Write a little more first — a few sentences give Claude something to tighten.",
    )
    .max(20000),
});

const entryInput = z.object({ entryId: z.string().min(1) });

// Non-empty text of the assistant's reply (thinking blocks filtered out).
function responseText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

async function loadEntryDoc(entryId: string) {
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: {
      sections: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  });
  if (!entry || entry.deletedAt) return null;

  const filled = entry.sections.filter((s) => s.body.trim() !== "");
  const doc = [
    `Title: ${entry.title || "(untitled)"}`,
    entry.summary.trim() ? `Summary: ${entry.summary}` : null,
    entry.tags.length
      ? `Tags: ${entry.tags.map((t) => t.tag.label).join(", ")}`
      : null,
    ...filled.map(
      (s) => `## ${sectionLabel(entry.template, s.kind)}\n${s.body}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { entry, filled, doc };
}

/*
 * "Tighten this" — a shorter, clearer version of one filled section. The
 * body comes from the client so it matches what is on screen, ahead of any
 * pending autosave.
 */
export async function tightenSection(input: unknown): Promise<TightenResult> {
  if (!(await assistUser())) return fail("Sign in to use Claude assistance.");
  const parsed = tightenInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const client = claude();
  if (!client) return fail("Claude assistance isn't set up on this server.");

  const entry = await db.entry.findUnique({
    where: { id: parsed.data.entryId },
    select: { title: true, template: true, deletedAt: true },
  });
  if (!entry || entry.deletedAt) return fail("This entry no longer exists.");

  const label = sectionLabel(entry.template, parsed.data.kind);
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `An entry titled "${entry.title || "Untitled"}" has a "${label}" section. ` +
            "Rewrite it to be shorter and clearer. Keep every fact, name, number and step. " +
            "Cut filler, hedging and repetition; prefer short sentences and the author's own terms. " +
            "Do not add anything that is not already there. " +
            "Reply with only the rewritten section body as plain text — no preamble, no markdown headings.\n\n" +
            `Section body:\n"""\n${parsed.data.body}\n"""`,
        },
      ],
    });
    const text = responseText(message);
    if (!text) return fail("Claude returned nothing usable. Try again.");
    return { ok: true, text };
  } catch (error) {
    return apiFail(error);
  }
}

/*
 * "What's missing?" — the questions a newcomer would still have. A quiet
 * list; nothing is ever written into a section from here.
 */
const questionsFormat = z.object({
  questions: z
    .array(z.string().describe("One question, one sentence."))
    .min(3)
    .max(4),
});

export async function whatsMissing(input: unknown): Promise<QuestionsResult> {
  if (!(await assistUser())) return fail("Sign in to use Claude assistance.");
  const parsed = entryInput.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");

  const client = claude();
  if (!client) return fail("Claude assistance isn't set up on this server.");

  const loaded = await loadEntryDoc(parsed.data.entryId);
  if (!loaded) return fail("This entry no longer exists.");
  if (loaded.filled.length === 0) {
    return fail("Write something first — Claude reads the entry, it doesn't draft it.");
  }

  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "A newcomer at Caizen Homes reads this internal knowledge-base entry. " +
            "List the 3-4 most important questions they would still have afterwards. " +
            "Ask about gaps in the content — missing steps, undefined terms, unstated " +
            "owners, amounts or timing — never about writing style. One sentence per question.\n\n" +
            loaded.doc,
        },
      ],
      output_config: { format: zodOutputFormat(questionsFormat) },
    });
    const parsedOutput = message.parsed_output;
    if (!parsedOutput) return fail("Claude returned nothing usable. Try again.");
    return { ok: true, questions: parsedOutput.questions };
  } catch (error) {
    return apiFail(error);
  }
}

/*
 * "Suggest title and summary" — from the filled sections, once What has
 * content. Accepting fills the two fields through the normal editing path.
 */
const titleSummaryFormat = z.object({
  title: z
    .string()
    .describe("Plain language, under 70 characters, no trailing period."),
  summary: z
    .string()
    .describe("One sentence under 160 characters; this is what browse rows show."),
});

export async function suggestTitleSummary(
  input: unknown,
): Promise<TitleSummaryResult> {
  if (!(await assistUser())) return fail("Sign in to use Claude assistance.");
  const parsed = entryInput.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");

  const client = claude();
  if (!client) return fail("Claude assistance isn't set up on this server.");

  const loaded = await loadEntryDoc(parsed.data.entryId);
  if (!loaded) return fail("This entry no longer exists.");
  const what = loaded.entry.sections.find((s) => s.kind === "WHAT");
  if (!what || !what.body.trim()) {
    return fail("Fill the What section first — the title comes from it.");
  }

  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Suggest a title and a one-line summary for this internal knowledge-base " +
            "entry, drawn only from its content. The title names the task or feature in " +
            "the team's own words; the summary tells a colleague what they'll find here.\n\n" +
            loaded.doc,
        },
      ],
      output_config: { format: zodOutputFormat(titleSummaryFormat) },
    });
    const parsedOutput = message.parsed_output;
    if (!parsedOutput) return fail("Claude returned nothing usable. Try again.");
    return {
      ok: true,
      // Clamp to the entry schema's own limits.
      title: parsedOutput.title.trim().slice(0, 200),
      summary: parsedOutput.summary.trim().slice(0, 500),
    };
  } catch (error) {
    return apiFail(error);
  }
}

/*
 * "Find related" — Claude distills what the entry is about into search
 * phrases; the existing full-text index does the actual finding. Surfaces
 * overlap before it becomes a duplicate.
 */
const searchTermsFormat = z.object({
  terms: z
    .array(
      z
        .string()
        .describe("A short search phrase of 2-4 words naming one distinct topic."),
    )
    .min(1)
    .max(4),
});

type RelatedRow = {
  id: string;
  title: string;
  category: string;
  subcategory: string;
};

export async function findRelated(input: unknown): Promise<RelatedResult> {
  if (!(await assistUser())) return fail("Sign in to use Claude assistance.");
  const parsed = entryInput.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");

  const client = claude();
  if (!client) return fail("Claude assistance isn't set up on this server.");

  const loaded = await loadEntryDoc(parsed.data.entryId);
  if (!loaded) return fail("This entry no longer exists.");
  if (loaded.filled.length === 0 && !loaded.entry.title.trim()) {
    return fail("Write something first so Claude knows what to look for.");
  }

  let terms: string[];
  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Extract 2-4 short search phrases from this internal knowledge-base entry, " +
            "each naming one distinct topic it covers, suitable for full-text search " +
            "to find overlapping documentation.\n\n" +
            loaded.doc,
        },
      ],
      output_config: { format: zodOutputFormat(searchTermsFormat) },
    });
    const parsedOutput = message.parsed_output;
    if (!parsedOutput) return fail("Claude returned nothing usable. Try again.");
    terms = parsedOutput.terms;
  } catch (error) {
    return apiFail(error);
  }

  const rows = await db.$queryRaw<RelatedRow[]>(Prisma.sql`
    WITH terms AS (
      SELECT websearch_to_tsquery('english', t.term) AS q
      FROM unnest(${terms}::text[]) AS t(term)
    ),
    hits AS (
      SELECT d."entryId" AS id, max(ts_rank_cd(d.tsv, t.q)) AS rank
      FROM "SearchDoc" d
      JOIN terms t ON d.tsv @@ t.q
      WHERE d."skillId" IS NULL AND d."entryId" <> ${parsed.data.entryId}
      GROUP BY d."entryId"
    )
    SELECT e.id, e.title, c.name AS category, s.name AS subcategory
    FROM hits h
    JOIN "Entry" e ON e.id = h.id
    JOIN "Category" c ON c.id = e."categoryId"
    JOIN "Subcategory" s ON s.id = e."subcategoryId"
    WHERE e.status = 'published' AND e."deletedAt" IS NULL
    ORDER BY h.rank DESC
    LIMIT 5
  `);

  return {
    ok: true,
    related: rows.map((row) => ({
      id: row.id,
      title: row.title,
      breadcrumb: `${row.category} › ${row.subcategory}`,
    })),
  };
}
