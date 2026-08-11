import type { ReactNode } from "react";

/*
 * The markdown subset a plain-textarea editor actually produces: blank-line
 * paragraphs, `- ` and `1. ` lists, **bold**, and `inline code`. Rendered
 * straight to React nodes — no HTML strings, so nothing to sanitise. When
 * the editor grows a richer surface, this is the one file to swap for a
 * real pipeline.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **bold** and `code` spans, keeping the delimiters' content.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={key} className="font-medium text-ink">
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded-control bg-sunken px-1 py-0.5 text-[13px]">
          {part.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(part);
    }
  });
  return nodes;
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (ul) {
      if (last?.kind === "ul") last.items.push(ul[1]);
      else blocks.push({ kind: "ul", items: [ul[1]] });
    } else if (ol) {
      if (last?.kind === "ol") last.items.push(ol[1]);
      else blocks.push({ kind: "ol", items: [ol[1]] });
    } else {
      // Every plain line is its own paragraph — that is what Enter means
      // in a textarea.
      blocks.push({ kind: "p", text: line });
    }
  }
  return blocks;
}

export function Markdown({ body }: { body: string }) {
  const blocks = parse(body);
  if (blocks.length === 0) return null;
  return (
    <div className="flex max-w-2xl flex-col gap-3 text-sm leading-relaxed text-ink-muted">
      {blocks.map((block, i) =>
        block.kind === "p" ? (
          <p key={i}>{inline(block.text, `p${i}`)}</p>
        ) : block.kind === "ul" ? (
          <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-faint">
            {block.items.map((item, j) => (
              <li key={j}>{inline(item, `u${i}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-ink-faint">
            {block.items.map((item, j) => (
              <li key={j}>{inline(item, `o${i}-${j}`)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
