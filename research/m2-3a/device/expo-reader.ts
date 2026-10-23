import { Directory, File, Paths } from "expo-file-system";
import type { AssetReader } from "../runtime/assets";

/**
 * The device implementation of the asset reader.
 *
 * It is the same interface the Node harness uses, so the runtime code that is
 * measured is the same code. Only the file system underneath is different.
 *
 * The catalogue is **not** bundled. It is imported once into the app's own
 * directory and read from there, which is what the shipping app would do,
 * and what keeps a research build from carrying a licence-encumbered dataset
 * inside it.
 *
 * **The folder is the app's own, and nothing else.** Expo Go gives an
 * experience a project-scoped directory, and `expo-file-system` will not
 * address a path outside it: constructing a `Directory` for
 * `/sdcard/Android/data/<package>/files` throws from the native module, and
 * the app's external files directory is not readable through this API. So
 * the assets are imported into `Paths.document` and read from there.
 */
const CATALOGUE_FOLDER = "catalogue";

export function expoReader(): AssetReader {
  let base: Directory | null = null;
  const findBase = (): Directory => {
    if (base) return base;
    const candidate = new Directory(Paths.document, CATALOGUE_FOLDER);
    console.log(`M2-3A step: the catalogue folder is ${candidate.uri} (exists: ${candidate.exists})`);
    if (!candidate.exists)
      throw new Error(
        `the catalogue is not on the device: ${candidate.uri} does not exist, so the assets were never imported`,
      );
    base = candidate;
    return candidate;
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
      const handle = file.open("r" as any);
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
