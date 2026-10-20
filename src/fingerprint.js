// Turns raw log lines into stable "signatures" by masking the parts that
// change between occurrences (timestamps, ids, numbers), so 4,000 lines of
// the same failure collapse into one row with a count.

// Order matters: timestamps and UUIDs must be masked before bare numbers.
const MASKS = [
  [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "<time>"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "<ip>"],
  [/\b0x[0-9a-f]+\b/gi, "<hex>"],
  [/\b(?=[0-9a-f]*\d)[0-9a-f]{12,}\b/gi, "<id>"],
  [/"[^"]*"/g, '"<str>"'],
  [/\b\d+(?:\.\d+)?(ms|s|kb|mb|gb)?\b/gi, "<n>$1"],
];

const LEVELS = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 };
const ALIASES = { WARNING: "WARN", CRITICAL: "FATAL", ERR: "ERROR" };

function levelOf(line) {
  const m = line.match(/\b(TRACE|DEBUG|INFO|WARNING|WARN|ERROR|ERR|FATAL|CRITICAL)\b/i);
  if (!m) return null;
  const word = m[1].toUpperCase();
  return ALIASES[word] || word;
}

function normalize(line) {
  let out = line.trim();
  for (const [re, replacement] of MASKS) out = out.replace(re, replacement);
  return out.replace(/\s+/g, " ");
}

// minLevel: "WARN" (default), "ERROR", ... or "ALL" to include lines with no
// recognisable level (stack-trace continuations, plain output).
function group(lines, { minLevel = "WARN" } = {}) {
  const wanted = String(minLevel).toUpperCase();
  const floor = wanted === "ALL" ? -1 : LEVELS[ALIASES[wanted] || wanted] ?? LEVELS.WARN;
  const groups = new Map();

  lines.forEach((raw, i) => {
    if (!raw || !raw.trim()) return;
    const level = levelOf(raw);
    const rank = level ? LEVELS[level] : -1;
    if (rank < floor) return;
    const signature = normalize(raw);
    const g = groups.get(signature);
    if (g) {
      g.count++;
      g.lastLine = i + 1;
    } else {
      groups.set(signature, {
        signature,
        level: level || "-",
        count: 1,
        firstLine: i + 1,
        lastLine: i + 1,
        example: raw.trim().slice(0, 200),
      });
    }
  });

  return [...groups.values()].sort((a, b) => b.count - a.count || a.firstLine - b.firstLine);
}

const cell = (s) => String(s).replace(/\|/g, "\\|");

function toMarkdown(groups, { top = 10 } = {}) {
  if (groups.length === 0) return "## Log summary\n\nNo matching lines.";
  const total = groups.reduce((n, g) => n + g.count, 0);
  const shown = groups.slice(0, top);
  const rows = shown.map(
    (g, i) =>
      `| ${i + 1} | ${g.level} | ${g.count} | ${g.firstLine}–${g.lastLine} | \`${cell(g.signature)}\` |`
  );
  return [
    "## Log summary",
    "",
    `${total} matching line(s) collapsed into ${groups.length} signature(s); showing the top ${shown.length}.`,
    "",
    "| # | Level | Count | Lines | Signature |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

module.exports = { normalize, levelOf, group, toMarkdown };
