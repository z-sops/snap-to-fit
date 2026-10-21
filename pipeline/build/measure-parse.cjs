// Measures the cost of loading one catalogue file, on its own.
//
// The measurement runs in its own process, because the point of the number is
// what the application would hold: the catalogue file and nothing else. It is
// run as:
//
//   node --expose-gc pipeline/build/measure-parse.cjs <file> <records>
//
// and it prints one line of JSON.
const fs = require("fs");

const file = process.argv[2];
const records = Number(process.argv[3] ?? 0);

global.gc();
const before = process.memoryUsage().heapUsed;
const started = process.hrtime.bigint();
const text = fs.readFileSync(file, "utf8");
const parsed = JSON.parse(text);
const parse_ms = Number(process.hrtime.bigint() - started) / 1e6;
global.gc();
const after = process.memoryUsage().heapUsed;

process.stdout.write(
  JSON.stringify({
    parse_ms,
    heap_mb: (after - before) / (1024 * 1024),
    bytes: Buffer.byteLength(text, "utf8"),
    records: Array.isArray(parsed) ? parsed.length : records,
  }),
);
