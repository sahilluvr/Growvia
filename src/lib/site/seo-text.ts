// Keeps <title> and meta descriptions inside what Google shows (≈60 / ≈155 characters) without changing on-page headings.

const SUFFIX = " · Growvia";

/** A search title ≤ 60 characters. Long headlines lose a trailing "(…)", then the part after a colon or dash. */
export function seoTitle(title: string, max = 60): { absolute: string } {
  const fits = (s: string) => s.length + SUFFIX.length <= max;
  let t = title.trim();
  if (fits(t)) return { absolute: t + SUFFIX };
  t = t.replace(/\s*\([^)]*\)\s*$/, "").trim(); // "… (2026 Edition)"
  if (fits(t)) return { absolute: t + SUFFIX };
  if (t.length <= max) return { absolute: t };
  const parts = t.split(/:\s+|\s+[—–-]\s+/);
  if (parts.length > 1) {
    const head = parts[0].trim();
    if (head.length >= 25 && fits(head)) return { absolute: head + SUFFIX };
    if (head.length >= 25 && head.length <= max) return { absolute: head };
  }
  // Last resort: cut at a word boundary, never ending on a joining word ("and", "for", "in"…).
  return { absolute: tidy(t.slice(0, max).replace(/\s+\S*$/, "")) };
}

/** A meta description of 120–155 characters where possible: whole sentences first, then a clean word cut. */
export function metaDescription(text: string, max = 155): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);
  let out = "";
  for (const s of sentences) { if ((out + " " + s).trim().length > max) break; out = (out + " " + s).trim(); }
  if (out.length >= 100) return out;
  // End at the last clause break (comma, dash, "and") that keeps it informative.
  const head = t.slice(0, max);
  const at = Math.max(head.lastIndexOf(", "), head.lastIndexOf(" — "), head.lastIndexOf(" and "));
  if (at >= 100) return tidy(head.slice(0, at)) + ".";
  return tidy(head.slice(0, max - 1).replace(/\s+\S*$/, "")) + "…";
}

const JOINERS = /\s+(and|or|for|in|of|to|the|a|an|with|by|on|from|at|your|&|vs|without)$/i;
function tidy(s: string) {
  let t = s.replace(/[\s,:;—–-]+$/, "");
  while (JOINERS.test(t)) t = t.replace(JOINERS, "").replace(/[\s,:;—–-]+$/, "");
  return t;
}
