import type { Market, RecordSource } from "./types";

/**
 * Reading a catalogue file, wherever it happens to be.
 *
 * The prototype is written against this one interface, so the **same code**
 * runs on a phone and in the Node harness. Only the implementation changes:
 * `expo-file-system` on a device, `node:fs` in the harness.
 */
export interface AssetReader {
  /** The bytes of a file, or undefined when it is not there. */
  readBytes(path: string, offset?: number, length?: number): Promise<Uint8Array | undefined>;
  /** The size of a file in bytes, or undefined when it is not there. */
  size(path: string): Promise<number | undefined>;
  /** True when the file is there. */
  exists(path: string): Promise<boolean>;
}

/** A catalogue's search index: names and tokens, and nothing else. */
export interface SearchIndexFile {
  version: number;
  market: Market;
  source: RecordSource;
  /** The records, in a deterministic order. */
  records: { id: string; name: string; tokens: string[] }[];
}

/** A catalogue's nutrient detail, in the keyed store's own format. */
export interface DetailHeader {
  version: number;
  market: Market;
  source: RecordSource;
  /** Where each record sits in the pack file, and how long it is. */
  offsets: Record<string, [number, number]>;
}

/** The detail of one food, as it is stored. */
export interface DetailRecord {
  id: string;
  name: string;
  group: string;
  per100: Record<string, number>;
  servings: { label: string; grams: number }[];
  nutrients: Record<string, { quality: string; sourceCode: string; observations?: number }>;
}
