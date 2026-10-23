import { ByteCache } from "./cache";
import type { AssetReader, DetailHeader, DetailRecord, SearchIndexFile } from "./assets";
import { marketOf, sourceOf, type LabelledResult, type Market, type RecordSource } from "./types";
import { resolveIngredient, type AliasRegistry } from "../../../src/core/ingredient-aliases";

/**
 * Where a market's records live.
 *
 * Two shapes, and they are the two architectures under test:
 *
 *   bundle  one file per market, holding the search index and the nutrient
 *           detail together. Loading a market parses the whole file.
 *   split   a small search index and a keyed detail store, apart. Loading a
 *           market parses the index and the store's header; a food's detail
 *           is read when the food is opened.
 */
export interface MarketStore {
  readonly market: Market;
  readonly source: RecordSource;
  /** Load the search index. */
  loadIndex(): Promise<SearchIndexFile>;
  /** Load one food's detail, or undefined when there is none. */
  loadDetail(id: string): Promise<DetailRecord | undefined>;
}

/** A file that holds a market's index and its detail together. */
export class BundleStore implements MarketStore {
  constructor(
    readonly market: Market,
    readonly source: RecordSource,
    private readonly reader: AssetReader,
    private readonly path: string,
  ) {}

  async loadIndex(): Promise<SearchIndexFile> {
    const bytes = await this.reader.readBytes(this.path);
    if (!bytes) throw new Error(`the catalogue file ${this.path} is not there`);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SearchIndexFile & {
      details: Record<string, DetailRecord>;
    };
    // The bundle keeps its detail beside the index, so it is all in memory.
    this.details = parsed.details ?? {};
    return { version: parsed.version, market: parsed.market, source: parsed.source, records: parsed.records };
  }

  private details: Record<string, DetailRecord> = {};

  async loadDetail(id: string): Promise<DetailRecord | undefined> {
    return this.details[id];
  }
}

/** A small index, and a keyed detail store read one food at a time. */
export class SplitStore implements MarketStore {
  private header: DetailHeader | null = null;

  constructor(
    readonly market: Market,
    readonly source: RecordSource,
    private readonly reader: AssetReader,
    private readonly indexPath: string,
    private readonly headerPath: string,
    private readonly packPath: string,
  ) {}

  async loadIndex(): Promise<SearchIndexFile> {
    const bytes = await this.reader.readBytes(this.indexPath);
    if (!bytes) throw new Error(`the search index ${this.indexPath} is not there`);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SearchIndexFile;
    const header = await this.reader.readBytes(this.headerPath);
    if (!header) throw new Error(`the detail store's header ${this.headerPath} is not there`);
    this.header = JSON.parse(new TextDecoder().decode(header)) as DetailHeader;
    return parsed;
  }

  async loadDetail(id: string): Promise<DetailRecord | undefined> {
    if (!this.header) return undefined;
    const place = this.header.offsets[id];
    if (!place) return undefined;
    const bytes = await this.reader.readBytes(this.packPath, place[0], place[1]);
    if (!bytes) return undefined;
    return JSON.parse(new TextDecoder().decode(bytes)) as DetailRecord;
  }
}

/** How a market was opened. */
export interface OpenResult {
  ok: boolean;
  market: Market;
  /** The milliseconds the open took. */
  ms: number;
  /** How many foods the market holds. */
  records: number;
  /** Why it failed, when it failed. */
  reason?: string;
}

/** The runtime's own counters, for the benchmark. */
export interface RuntimeStats {
  searches: number;
  detailsRequested: number;
  detailsFromCache: number;
  detailsFromStore: number;
  cacheBytes: number;
  cacheEntries: number;
  evictions: number;
}

const tokenise = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .split(" ")
    .filter(Boolean);

/**
 * The prototype runtime.
 *
 * It is deliberately small and deliberately isolated: it knows about markets,
 * sources, labels and caches, and it knows nothing about the app's screens,
 * its targets or its meal plan. It is a measurement rig, not a feature.
 */
export class CatalogueRuntime {
  readonly cache: ByteCache<DetailRecord>;
  private readonly indexes = new Map<Market, SearchIndexFile>();
  private readonly stores = new Map<Market, MarketStore>();
  private readonly counters = { searches: 0, detailsRequested: 0, detailsFromCache: 0, detailsFromStore: 0, evictions: 0 };

  constructor(
    private readonly storesByMarket: Map<Market, MarketStore>,
    private readonly registry: AliasRegistry,
    readonly cacheBudgetBytes: number,
  ) {
    this.cache = new ByteCache<DetailRecord>(cacheBudgetBytes, (value) => JSON.stringify(value).length);
    for (const [market, store] of storesByMarket) this.stores.set(market, store);
  }

  /** Open a market: load its search index. */
  async open(market: Market): Promise<OpenResult> {
    const started = Date.now();
    const store = this.stores.get(market);
    if (!store) return { ok: false, market, ms: 0, records: 0, reason: `there is no catalogue for ${market}` };
    try {
      const index = await store.loadIndex();
      this.indexes.set(market, index);
      return { ok: true, market, ms: Date.now() - started, records: index.records.length };
    } catch (error) {
      return {
        ok: false,
        market,
        ms: Date.now() - started,
        records: 0,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** True when the market's index is open. */
  isOpen(market: Market): boolean {
    return this.indexes.has(market);
  }

  /**
   * Search a market.
   *
   * The market's own records come first. The other market's records follow,
   * every one of them marked as a cross-market result, because a user has to
   * know whose numbers they are looking at.
   */
  async search(query: string, market: Market, limit = 20): Promise<LabelledResult[]> {
    this.counters.searches += 1;
    const wanted = tokenise(query);
    if (!wanted.length) return [];
    const found: LabelledResult[] = [];
    for (const [indexMarket, index] of this.indexes) {
      for (const record of index.records) {
        if (!wanted.every((word) => record.tokens.some((token) => token.startsWith(word)))) continue;
        const cross = indexMarket !== market;
        found.push({
          id: record.id,
          name: record.name,
          source: index.source,
          region: indexMarket,
          cross_market: cross,
          source_market: indexMarket,
        });
      }
    }
    // The market that was asked for first, then the other one.
    found.sort((a, b) => {
      if (a.cross_market !== b.cross_market) return a.cross_market ? 1 : -1;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      return a.id < b.id ? -1 : 1;
    });
    return found.slice(0, limit);
  }

  /**
   * The detail of one food.
   *
   * The cache is checked first, then the market that owns the record, and the
   * result is cached. A record that is not there is undefined, and nothing is
   * invented in its place.
   */
  async detail(id: string): Promise<DetailRecord | undefined> {
    this.counters.detailsRequested += 1;
    const cached = this.cache.get(id);
    if (cached) {
      this.counters.detailsFromCache += 1;
      return cached;
    }
    const market = marketOf(id);
    if (!market) return undefined;
    const store = this.stores.get(market);
    if (!store) return undefined;
    const record = await store.loadDetail(id);
    if (!record) return undefined;
    this.counters.detailsFromStore += 1;
    const before = this.cache.size;
    this.cache.set(id, record);
    if (this.cache.size < before) this.counters.evictions += 1;
    return record;
  }

  /**
   * Resolve canonical ingredient keys for a market, and load their details.
   *
   * The resolution is the M2-4 contract: a key that cannot be resolved is
   * reported, never substituted, and the outcome says which market each
   * record came from.
   */
  async ingredients(
    keys: string[],
    market: Market,
  ): Promise<{ key: string; id?: string; outcome: string; source_market?: Market; cross_market: boolean }[]> {
    const out: { key: string; id?: string; outcome: string; source_market?: Market; cross_market: boolean }[] = [];
    for (const key of keys) {
      const result = resolveIngredient(key, market, this.registry);
      if (result.outcome === "unavailable" || !result.id) {
        out.push({ key, outcome: result.outcome, cross_market: false });
        continue;
      }
      const record = await this.detail(result.id);
      out.push({
        key,
        id: result.id,
        outcome: result.outcome,
        source_market: result.source_market as "US" | "CA" | undefined,
        cross_market: result.cross_market,
      });
      void record;
    }
    return out;
  }

  /** The runtime's counters. */
  stats(): RuntimeStats {
    return {
      ...this.counters,
      cacheBytes: this.cache.bytes,
      cacheEntries: this.cache.size,
      evictions: this.counters.evictions,
    };
  }

  /** Empty the detail cache. */
  clearCache(): void {
    this.cache.clear();
  }
}

/** The market a source belongs to, for the store constructors. */
export function marketForSource(source: RecordSource): Market {
  return source === "usda" ? "US" : "CA";
}

/** The namespace check, for the harness. */
export function assertKnownNamespace(id: string): boolean {
  return sourceOf(id) !== null;
}
