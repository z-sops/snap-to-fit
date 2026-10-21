import fs from "node:fs";

/**
 * A small RFC 4180 reader.
 *
 * The published CSVs are UTF-8 with a byte-order mark, comma separated, with
 * quoted fields. Rows are returned as arrays rather than objects, because the
 * largest file has half a million rows and an object per row would cost
 * several times the memory.
 */
export interface CsvTable {
  header: string[];
  rows: string[][];
  /** The index of each header column. */
  index: Map<string, number>;
}

export function readCsv(file: string): CsvTable {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() ?? [];
  const index = new Map<string, number>();
  header.forEach((h, i) => index.set(h, i));
  return { header, rows, index };
}

/** The value of a column in a row, or undefined when the column is absent. */
export function cell(row: string[], index: Map<string, number>, name: string): string | undefined {
  const at = index.get(name);
  return at === undefined ? undefined : row[at];
}
