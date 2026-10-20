const test = require("node:test");
const assert = require("node:assert");
const { normalize, levelOf, group, toMarkdown } = require("../src/fingerprint");

test("lines that differ only in time, id and numbers share a signature", () => {
  const a = normalize("2026-10-08T09:14:06.991Z ERROR payment 7f3c2a9e-1b44-4c1e-9a71-0d5e8c2f4b10 failed after 30s");
  const b = normalize("2026-10-09 22:01:00,004 ERROR payment 0a91d6c3-5e27-4f08-b3a2-9c4e71d08f55 failed after 31s");
  assert.strictEqual(a, b);
  assert.match(a, /<time> ERROR payment <uuid> failed after <n>s/);
});

test("ip addresses, hex and long ids are masked", () => {
  assert.strictEqual(normalize("cache 10.0.3.40:6379 ptr 0xdeadbeef req 5f2a9c81b7e04d3a"), "cache <ip> ptr <hex> req <id>");
});

// Documents the privacy limit stated in the README: if masking changes, the
// README's "Limits and safety" section must change with it.
test("signatures keep emails and names (documented privacy limit); output never prints the raw line", () => {
  const raw = "2026-10-08T09:14:02Z ERROR login failed for jane.doe@example.com from 10.0.0.5 req 7f3c2a9e-1b44-4c1e-9a71-0d5e8c2f4b10";
  assert.strictEqual(normalize(raw), "<time> ERROR login failed for jane.doe@example.com from <ip> req <uuid>");
  const md = toMarkdown(group([raw]));
  assert.ok(md.includes("jane.doe@example.com"), "README warns that emails appear in signatures");
  assert.ok(!md.includes("10.0.0.5") && !md.includes("7f3c2a9e"), "the raw example line is never printed");
});

test("level aliases are normalised", () => {
  assert.strictEqual(levelOf("WARNING disk 91% full"), "WARN");
  assert.strictEqual(levelOf("[critical] out of memory"), "FATAL");
  assert.strictEqual(levelOf("plain output"), null);
});

test("groups are counted, ranked by count, and keep first/last line numbers", () => {
  const lines = [
    "ERROR db timeout after 30s",
    "INFO ok",
    "WARN slow 120ms",
    "ERROR db timeout after 31s",
    "ERROR db timeout after 29s",
  ];
  const groups = group(lines);
  assert.strictEqual(groups.length, 2);
  assert.deepStrictEqual(
    { count: groups[0].count, first: groups[0].firstLine, last: groups[0].lastLine },
    { count: 3, first: 1, last: 5 }
  );
  assert.strictEqual(groups[1].level, "WARN");
});

test("minLevel filters, and ALL keeps level-less lines", () => {
  const lines = ["INFO started", "ERROR boom", "    at handler (app.js:10:5)"];
  assert.strictEqual(group(lines, { minLevel: "ERROR" }).length, 1);
  assert.strictEqual(group(lines, { minLevel: "ALL" }).length, 3);
});

test("markdown output escapes pipes and respects --top", () => {
  const md = toMarkdown(group(["ERROR a | b", "ERROR c", "ERROR c"]), { top: 1 });
  assert.match(md, /3 matching line\(s\) collapsed into 2 signature\(s\); showing the top 1/);
  assert.ok(!md.includes("a | b"), "pipe inside a signature must be escaped");
  assert.strictEqual(toMarkdown([]), "## Log summary\n\nNo matching lines.");
});
