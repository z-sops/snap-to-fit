/**
 * Device instrumentation for the benchmark harness.
 *
 * The code here has to run inside **Hermes**, on a phone, with no
 * dependency and no native module, so it uses only what Hermes has:
 * `performance.now()` for the clock, `console.log` for the output, and the
 * file system for the report.
 *
 * The numbers it produces are the ones a device run has to report:
 *
 *   - the time to open a market's search index;
 *   - the time to the first usable food result;
 *   - the time of a cold and a warm search;
 *   - the time of a cold and a warm detail load;
 *   - the time to resolve the recipe ingredients;
 *   - the peak and the retained heap, when the runtime exposes them.
 *
 * **The heap is not always available.** Hermes does not expose a JavaScript
 * heap size, so the module asks for it and says so when it cannot get it:
 * the memory figure then has to come from the platform, with `adb shell
 * dumpsys meminfo` on Android and the Instruments allocations template on
 * iOS. It is never guessed.
 */

/** One measurement. */
export interface Mark {
  name: string;
  /** The milliseconds the marked work took. */
  ms: number;
  /** How many times the marked work ran. */
  iterations?: number;
  /** Anything the measurement wants to say about itself. */
  note?: string;
}

/** The report the device run produces. */
export interface DeviceReport {
  /** What the run was. */
  device: {
    platform: string;
    /** The engine the code ran on. */
    engine: string;
    /** Whatever the caller knows about the device. */
    model?: string;
    os_version?: string;
    /** The app's own version, if it knows. */
    app_version?: string;
  };
  /** The marks, in the order they were taken. */
  marks: Mark[];
  /** The memory the runtime could report, when it could. */
  memory?: {
    heap_used_mb?: number;
    heap_limit_mb?: number;
    /** True when the platform has to be asked instead. */
    platform_required: boolean;
    note: string;
  };
  /** The workload's own counts. */
  counts?: Record<string, number>;
  /** The note that goes with the whole report. */
  note: string;
}

/** The clock, when there is one. */
function now(): number {
  const performance = (globalThis as { performance?: { now?: () => number } }).performance;
  if (performance?.now) return performance.now();
  return Date.now();
}

/**
 * The heap, when the runtime exposes one.
 *
 * Hermes does not, and the report says so rather than inventing a figure.
 */
function heap(): { heap_used_mb?: number; heap_limit_mb?: number; platform_required: boolean; note: string } {
  const performance = (globalThis as { performance?: { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } } })
    .performance;
  const memory = performance?.memory;
  if (memory?.usedJSHeapSize !== undefined)
    return {
      heap_used_mb: Math.round((memory.usedJSHeapSize / (1024 * 1024)) * 100) / 100,
      heap_limit_mb: memory.jsHeapSizeLimit ? Math.round((memory.jsHeapSizeLimit / (1024 * 1024)) * 100) / 100 : undefined,
      platform_required: false,
      note: "the JavaScript heap, as the runtime reports it",
    };
  return {
    platform_required: true,
    note:
      "this runtime does not expose a JavaScript heap size. The memory figure has to come from the platform: `adb shell dumpsys meminfo <package>` on Android, or the Instruments allocations template on iOS.",
  };
}

/** Collects the marks of one run. */
export class Instrument {
  readonly marks: Mark[] = [];
  private readonly started = now();

  /** The time since the run started, in milliseconds. */
  get elapsed(): number {
    return now() - this.started;
  }

  /** Time some work, and record it. */
  async time<T>(name: string, work: () => Promise<T> | T, note?: string): Promise<T> {
    const start = now();
    const value = await work();
    this.marks.push({ name, ms: Math.round((now() - start) * 1000) / 1000, note });
    return value;
  }

  /** Time some work that runs many times, and record the mean. */
  async repeat<T>(name: string, iterations: number, work: (index: number) => Promise<T> | T): Promise<T[]> {
    const start = now();
    const results: T[] = [];
    for (let i = 0; i < iterations; i++) results.push(await work(i));
    const total = now() - start;
    this.marks.push({
      name,
      ms: Math.round((total / iterations) * 1000) / 1000,
      iterations,
      note: "the mean of the iterations",
    });
    return results;
  }

  /** Record a mark that was measured elsewhere. */
  mark(name: string, ms: number, note?: string): void {
    this.marks.push({ name, ms: Math.round(ms * 1000) / 1000, note });
  }

  /** The report of the run. */
  report(device: DeviceReport["device"], counts?: Record<string, number>): DeviceReport {
    return {
      device,
      marks: this.marks,
      memory: heap(),
      counts,
      note:
        "These are figures from a physical device. The memory figure comes from the platform unless the runtime reports the JavaScript heap itself, and it says which.",
    };
  }
}

/** The device the report is about, as far as the caller knows it. */
export function deviceDescription(input: {
  platform: string;
  engine: string;
  model?: string;
  os_version?: string;
  app_version?: string;
}): DeviceReport["device"] {
  return input;
}
