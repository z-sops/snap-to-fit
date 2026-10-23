import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { assetsDir } from "./build-assets";

/**
 * Serves the benchmark assets to the device, over the development machine's
 * own loopback.
 *
 * The device imports the catalogue once, into its own directory, and then
 * works without the network. That is the shape the shipping app would have:
 * the catalogue is an asset the app brings in, not something it fetches on
 * every launch.
 *
 *   node --import tsx research/m2-3a/bench/serve-assets.ts [port]
 */
const port = Number(process.argv[2] ?? 8082);
const folder = assetsDir();

const types: Record<string, string> = {
  ".json": "application/json",
  ".pack": "application/octet-stream",
};

const server = http.createServer((request, response) => {
  const name = (request.url ?? "/").replace(/^\//, "").split("?")[0];
  if (!name || name.includes("..")) {
    response.writeHead(400).end("bad request");
    return;
  }
  if (name === "task") {
    // The task configuration: which architecture and how many iterations.
    // For now, alternate between B and C, 30 iterations each.
    const task = {
      architecture: "C-split",
      iterations: 30,
    };
    const payload = JSON.stringify(task);
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(payload),
    });
    response.end(payload);
    return;
  }
  if (name === "manifest") {
    const manifestPath = path.join(folder, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      response.writeHead(404).end("not found: manifest");
      return;
    }
    response.writeHead(200, {
      "content-type": "application/json",
      "content-length": fs.statSync(manifestPath).size,
      "cache-control": "no-store",
    });
    fs.createReadStream(manifestPath).pipe(response);
    return;
  }
  const file = path.join(folder, name);
  if (!fs.existsSync(file)) {
    response.writeHead(404).end(`not found: ${name}`);
    return;
  }
  response.writeHead(200, {
    "content-type": types[path.extname(file)] ?? "application/octet-stream",
    "content-length": fs.statSync(file).size,
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving ${folder} on http://127.0.0.1:${port}`);
});
