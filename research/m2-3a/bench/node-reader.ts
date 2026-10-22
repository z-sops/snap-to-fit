import fs from "node:fs";
import path from "node:path";
import type { AssetReader } from "../runtime/assets";

/**
 * The Node implementation of the asset reader.
 *
 * It is the same interface the device uses, so the harness and the phone run
 * the same runtime code. The only difference is that this one reads from the
 * file system.
 */
export function nodeReader(folder: string): AssetReader {
  const at = (file: string) => path.join(folder, file);
  return {
    async readBytes(file: string, offset?: number, length?: number) {
      const full = at(file);
      if (!fs.existsSync(full)) return undefined;
      if (offset === undefined) return new Uint8Array(fs.readFileSync(full));
      const handle = fs.openSync(full, "r");
      try {
        const size = length ?? fs.statSync(full).size - offset;
        const buffer = Buffer.alloc(size);
        fs.readSync(handle, buffer, 0, size, offset);
        return new Uint8Array(buffer);
      } finally {
        fs.closeSync(handle);
      }
    },
    async size(file: string) {
      const full = at(file);
      if (!fs.existsSync(full)) return undefined;
      return fs.statSync(full).size;
    },
    async exists(file: string) {
      return fs.existsSync(at(file));
    },
  };
}

/** The memory the process is using, in megabytes. */
export function memory() {
  const usage = process.memoryUsage();
  return {
    rss_mb: round(usage.rss / (1024 * 1024)),
    heap_used_mb: round(usage.heapUsed / (1024 * 1024)),
    heap_total_mb: round(usage.heapTotal / (1024 * 1024)),
    external_mb: round(usage.external / (1024 * 1024)),
  };
}

/** The peak RSS the process has reached. */
export function peakRssMb(): number {
  return round(process.resourceUsage().maxRSS / 1024);
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
