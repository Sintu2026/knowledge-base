/*
 * Word-level diff for revision history — no dependency, tokens are words
 * with their trailing whitespace so joins reproduce the text exactly.
 * Standard LCS dynamic programming; inputs beyond the cell budget fall
 * back to a whole-text replace, which for a 20k-char section body only
 * happens when nearly everything changed anyway.
 */

export type DiffPart = { type: "same" | "add" | "del"; text: string };

const MAX_CELLS = 4_000_000;

function tokenize(text: string): string[] {
  // Words keep their following whitespace: "a b" → ["a ", "b"].
  return text.match(/\S+\s*|\s+/g) ?? [];
}

export function diffWords(oldText: string, newText: string): DiffPart[] {
  if (oldText === newText) {
    return oldText ? [{ type: "same", text: oldText }] : [];
  }
  const a = tokenize(oldText);
  const b = tokenize(newText);
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...(oldText ? [{ type: "del", text: oldText } as const] : []),
      ...(newText ? [{ type: "add", text: newText } as const] : []),
    ];
  }

  // LCS table, one flat Uint32Array row-major: lcs[i][j] = longest common
  // subsequence of a[i..] and b[j..].
  const w = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * w + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
      push("del", a[i]);
      i++;
    } else {
      push("add", b[j]);
      j++;
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return parts;
}
