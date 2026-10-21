// Extracts the text of a PDF, for reading the publisher's own documentation.
//
//   node pipeline/read-pdf.cjs <file.pdf> [search]
//
// The PDFs the Canadian Nutrient File ships with are simple: FlateDecode
// content streams, one text-showing operator per line. This reads them
// without a dependency, so the documentation can be quoted from the archive
// that is pinned in the manifest.
const fs = require("fs");
const zlib = require("zlib");

const file = process.argv[2];
const search = process.argv[3] ? process.argv[3].toLowerCase() : "";
const buffer = fs.readFileSync(file);

// The streams, in the order they appear.
const streams = [];
const marker = Buffer.from("stream");
let at = 0;
while (at < buffer.length) {
  const found = buffer.indexOf(marker, at);
  if (found < 0) break;
  let start = found + marker.length;
  if (buffer[start] === 0x0d) start += 1;
  if (buffer[start] === 0x0a) start += 1;
  const end = buffer.indexOf(marker, start);
  if (end < 0) break;
  const raw = buffer.slice(start, end);
  at = end + marker.length;
  try {
    streams.push(zlib.inflateSync(raw).toString("latin1"));
  } catch {
    // Not a deflate stream, or not a text stream.
  }
}

const text = streams
  .filter((stream) => /\bTj|\bTJ/.test(stream))
  .map((stream) => {
    const parts = [];
    const pattern = /\((?:\\.|[^\\()])*\)|\bTJ\b|\bTj\b|\bTd\b|\bTD\b|\bT\*\b|\bET\b/g;
    let match;
    while ((match = pattern.exec(stream))) {
      const token = match[0];
      if (token === "Td" || token === "TD" || token === "T*" || token === "ET") parts.push("\n");
      else if (token === "TJ" || token === "Tj") parts.push("");
      else parts.push(token.slice(1, -1).replace(/\\([()\\])/g, "$1"));
    }
    return parts.join("");
  })
  .join("\n")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{3,}/g, "\n\n");

if (!search) {
  process.stdout.write(text);
} else {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].toLowerCase().includes(search)) continue;
    const from = Math.max(0, i - 3);
    const to = Math.min(lines.length, i + 6);
    process.stdout.write(`--- line ${i}\n${lines.slice(from, to).join("\n")}\n`);
  }
}
