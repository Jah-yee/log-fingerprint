# log-fingerprint

Collapse thousands of noisy log lines into a short, ranked list of error signatures you can paste straight into an incident ticket.

## The problem

During an incident, the on-call person opens a log file with 40,000 lines and has to answer "what is actually going wrong, and how often?" The same failure appears thousands of times with a different timestamp, request id or duration on every line, so `grep | sort | uniq -c` doesn't group anything. People end up scrolling, guessing, and pasting a random line into the ticket.

## Who it's for

On-call engineers, IT support staff and sysadmins who need a quick, honest summary of a log file — for an incident ticket, a hand-over note, or a message to the team that owns the failing service.

## What it does

- Masks the parts of a line that change between occurrences — timestamps, UUIDs, IP addresses, hex pointers, long ids, quoted values and numbers — so repeated failures share one **signature**.
- Groups lines by signature and ranks them by count, with the first and last line number of each group so you can jump back to the raw log.
- Filters by level (`WARN` and above by default; `ERROR`, or `ALL` to include stack-trace lines).
- Prints a Markdown table ready for a ticket or chat.

## Try it

Requires Node 18+. No install step, no dependencies.

```bash
node cli.js examples/app.log
node cli.js examples/app.log --level ERROR --top 3
cat examples/app.log | node cli.js -
node --test
```

The sample log has 14 lines; the summary shows 4 signatures, led by the payment gateway timeout that happened 4 times.

## Acceptance criteria

- Lines that differ only in timestamp, id, IP or numbers produce the same signature.
- Groups are ranked by count and report the first and last line number of each.
- `--level` filters lower-severity lines; `ALL` keeps lines with no level.
- Pipes inside a signature are escaped so the Markdown table never breaks.
- An empty or fully filtered log prints "No matching lines." instead of an empty table.

## How it's built

`src/fingerprint.js` is a set of small pure functions: `normalize` applies an ordered list of regex masks (timestamps before numbers, UUIDs before long ids), `group` builds a `Map` keyed by signature, and `toMarkdown` renders the table. `cli.js` only reads the file and parses flags, so everything worth testing is in the module.

## Limits and safety

- Logs often contain personal data and secrets. This tool runs locally and never sends anything anywhere, but masking only covers timestamps, UUIDs, IPs, hex values, long ids, quoted values and numbers. **Email addresses, user names, hostnames and unquoted tokens stay in the signatures it prints** — check the table before pasting it into a shared ticket.
- Masking is heuristic: an unusual id format may stay unmasked and split a group. That is safe (you see more groups, not fewer), just noisier.
- It reads the whole file into memory; very large logs (GBs) should be filtered first.

## Contribute

- Add `--since` / `--until` to summarise only an incident window.
- Read from stdin so it works in a pipe: `kubectl logs ... | node cli.js -`.
- Add a `--json` output for dashboards.

---

Scaffolded by an automated weekly pipeline, then refined by hand — see the factory repo for how it works.
