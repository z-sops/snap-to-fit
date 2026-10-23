import { fetch } from "expo/fetch";
import {
  type BenchmarkTaskContract,
  validateTaskContract,
} from "../runtime/contract";

/**
 * Reads and strictly validates the immutable benchmark task contract from the asset server.
 *
 * If the server is unreachable, returns an error status, or returns a malformed
 * or mismatched contract, this function throws immediately. It NEVER silently falls
 * back to B-bundle x 1 or any default.
 */
export async function readTask(): Promise<BenchmarkTaskContract> {
  const source = process.env.EXPO_PUBLIC_CATALOGUE_SOURCE ?? "http://127.0.0.1:8082";
  const url = `${source}/task`;

  console.log(`M2-3A step: requesting benchmark task contract from ${url}`);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });
  } catch (netErr) {
    const msg = netErr instanceof Error ? netErr.message : String(netErr);
    throw new Error(`M2-3A task fetch failed: cannot reach asset server at ${url}: ${msg}`);
  }

  if (!response.ok) {
    throw new Error(`M2-3A task fetch failed: server returned HTTP ${response.status} ${response.statusText}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (jsonErr) {
    const msg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
    throw new Error(`M2-3A task fetch failed: malformed JSON response from ${url}: ${msg}`);
  }

  const contract = validateTaskContract(data);
  console.log(
    `M2-3A step: benchmark task contract validated: runId=${contract.runId}, arch=${contract.architecture}, iter=${contract.iterations}`,
  );
  return contract;
}
