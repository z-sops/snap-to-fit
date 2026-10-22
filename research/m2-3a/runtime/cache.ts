/**
 * A cache with a byte budget, and the eviction that goes with it.
 *
 * The prototype's answer to "what happens when the device is full of food":
 * the least recently used detail is dropped, and the budget is never
 * exceeded. Nothing here decides what a user sees; it only decides what the
 * app holds.
 */
export interface CacheEntry<T> {
  value: T;
  /** The size of the entry in bytes, as the caller measured it. */
  bytes: number;
}

export class ByteCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private used = 0;

  constructor(
    readonly budgetBytes: number,
    private readonly sizeOf: (value: T) => number,
  ) {}

  /** The bytes the cache is holding. */
  get bytes(): number {
    return this.used;
  }

  /** How many entries the cache is holding. */
  get size(): number {
    return this.entries.size;
  }

  /** True when the value is in the cache. */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** The value, if it is in the cache. It counts as a use. */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // A read is a use: the entry goes to the back of the queue.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Put a value in, and evict until the budget is respected. */
  set(key: string, value: T): void {
    const bytes = this.sizeOf(value);
    const existing = this.entries.get(key);
    if (existing) {
      this.used -= existing.bytes;
      this.entries.delete(key);
    }
    // A value that is bigger than the whole budget is not cached at all.
    if (bytes > this.budgetBytes) return;
    this.entries.set(key, { value, bytes });
    this.used += bytes;
    while (this.used > this.budgetBytes) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      const entry = this.entries.get(oldest.value)!;
      this.entries.delete(oldest.value);
      this.used -= entry.bytes;
    }
  }

  /** Empty the cache. */
  clear(): void {
    this.entries.clear();
    this.used = 0;
  }
}
