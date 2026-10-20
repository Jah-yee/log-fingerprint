#!/usr/bin/env node
// Usage: node cli.js <logfile> [--top 10] [--level WARN|ERROR|ALL]
const fs = require("fs");
const { group, toMarkdown } = require("./src/fingerprint");

function parseArgs(argv) {
  const args = { file: null, top: 10, level: "WARN" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--top") args.top = Number(argv[++i]) || 10;
    else if (argv[i] === "--level") args.level = argv[++i] || "WARN";
    else args.file = argv[i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error("Usage: node cli.js <logfile> [--top 10] [--level WARN|ERROR|ALL]");
  process.exit(2);
}

const lines = fs.readFileSync(args.file, "utf8").split(/\r?\n/);
console.log(toMarkdown(group(lines, { minLevel: args.level }), { top: args.top }));
