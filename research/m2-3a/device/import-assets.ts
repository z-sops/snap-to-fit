import { Directory, File, Paths } from "expo-file-system";
import { fetch } from "expo/fetch";
import manifest from "./app/catalogue-manifest.json";

/**
 * Imports the benchmark catalogue into the device, once.
 *
 * The assets are read from the development machine's loopback and written
 * into the app's own directory. After this the app never needs the network
 * again, which is the point: the catalogue is something the app brings in,
 * not something it fetches on every launch.
 *
 * Every file's size is checked against the manifest that the build produced.
 * A file that is short, or that is missing, is an error, and the benchmark
 * does not run on a partial catalogue: a smaller file must never stand in
 * for the real one.
 */
const CATALOGUE_FOLDER = "catalogue";
/** Where the development machine serves the assets from. */
const SOURCE = process.env.EXPO_PUBLIC_CATALOGUE_SOURCE ?? "http://127.0.0.1:8082";

/** What the import did. */
export interface ImportReport {
  imported: { name: string; bytes: number; ok: boolean; reason?: string }[];
  total_bytes: number;
  ok: boolean;
}

/** Import the catalogue into the app's own directory. */
export async function importCatalogue(): Promise<ImportReport> {
  const folder = new Directory(Paths.document, CATALOGUE_FOLDER);
  if (!folder.exists) folder.create();
  console.log(`M2-3A step: importing the catalogue into ${folder.uri}`);

  const imported: ImportReport["imported"] = [];
  let total = 0;
  for (const entry of manifest.files) {
    const target = new File(folder, entry.name);
    if (target.exists && target.size === entry.bytes) {
      console.log(`M2-3A step: ${entry.name} is already there (${target.size} bytes)`);
      imported.push({ name: entry.name, bytes: target.size, ok: true });
      total += target.size;
      continue;
    }
    const response = await fetch(`${SOURCE}/${entry.name}`);
    if (!response.ok) {
      const reason = `the download failed with ${response.status}`;
      console.log(`M2-3A step: ${entry.name}: ${reason}`);
      imported.push({ name: entry.name, bytes: 0, ok: false, reason });
      continue;
    }
    const bytes = await response.bytes();
    if (bytes.length !== entry.bytes) {
      const reason = `the download was ${bytes.length} bytes, the manifest says ${entry.bytes}`;
      console.log(`M2-3A step: ${entry.name}: ${reason}`);
      imported.push({ name: entry.name, bytes: bytes.length, ok: false, reason });
      continue;
    }
    target.create({ overwrite: true });
    target.write(bytes);
    console.log(`M2-3A step: imported ${entry.name} (${bytes.length} bytes)`);
    imported.push({ name: entry.name, bytes: bytes.length, ok: true });
    total += bytes.length;
  }

  const ok = imported.every((entry) => entry.ok);
  console.log(`M2-3A step: the import is ${ok ? "complete" : "INCOMPLETE"} (${total} bytes)`);
  return { imported, total_bytes: total, ok };
}
