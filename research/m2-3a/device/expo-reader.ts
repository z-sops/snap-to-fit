import { Directory, File, Paths } from "expo-file-system";
import type { AssetReader } from "../runtime/assets";

/**
 * The device implementation of the asset reader.
 *
 * It is the same interface the Node harness uses, so the runtime code that is
 * measured is the same code. Only the file system underneath is different.
 *
 * The catalogue is **not** bundled. It is pushed onto the device and read
 * from the app's own storage, which is what the shipping app would do, and
 * what keeps a research build from carrying a licence-encumbered dataset
 * inside it.
 *
 * The base folder is found by looking: the app's own document directory
 * first, then the app's external files directory, which is where a pushed
 * catalogue lands.
 */
const BASE_FOLDERS = [
  () => new Directory(Paths.document, "catalogue"),
  // The app-specific external directory: `/sdcard/Android/data/<package>/files`.
  () => new Directory("/sdcard/Android/data/host.exp.exponent/files", "catalogue"),
];

export function expoReader(): AssetReader {
  let base: Directory | null = null;
  const findBase = (): Directory => {
    if (base) return base;
    for (const make of BASE_FOLDERS) {
      const candidate = make();
      console.log(`M2-3A step: looking for the catalogue in ${candidate.uri} (exists: ${candidate.exists})`);
      if (candidate.exists) {
        base = candidate;
        console.log(`M2-3A step: the catalogue is at ${candidate.uri}`);
        return candidate;
      }
    }
    throw new Error("the catalogue is not on the device: no folder holds it");
  };
  const at = (name: string) => new File(findBase(), name);
  return {
    async readBytes(name: string, offset?: number, length?: number) {
      const file = at(name);
      if (!file.exists) {
        console.log(`M2-3A step: the asset ${name} is not there`);
        return undefined;
      }
      if (offset === undefined) {
        const bytes = await file.bytes();
        console.log(`M2-3A step: read ${name} (${bytes.length} bytes)`);
        return bytes;
      }
      // A random read: the keyed detail store is read one record at a time.
      const handle = file.open("r");
      try {
        handle.offset = offset;
        const size = length ?? Math.max(0, file.size - offset);
        return handle.readBytes(size);
      } finally {
        handle.close();
      }
    },
    async size(name: string) {
      const file = at(name);
      return file.exists ? file.size : undefined;
    },
    async exists(name: string) {
      return at(name).exists;
    },
  };
}
