import { fetch } from "expo/fetch";

/**
 * Reads the benchmark task from the asset server.
 *
 * The server returns a JSON object like:
 *   { "architecture": "B-bundle", "iterations": 30 }
 *
 * If the server is unreachable or the response is malformed, the app
 * falls back to a single B-bundle run so that manual testing still works.
 */
export interface Task {
  architecture: "B-bundle" | "C-split";
  iterations: number;
}

export async function readTask(): Promise<{ architecture: "B-bundle" | "C-split"; iterations: number }> {
  const base = process.env.EXPO_PUBLIC_CATALOGUE_SOURCE ?? "http://127.0.0.1:8082";
  try {
    const response = await fetch(`${SOURCE}/task`);
    if (!response.ok) throw new Error(`task fetch failed with ${response.status}`);
    const task = await response.json() as Task;
    if (!task.architecture || !task.iterations) throw new Error("malformed task response");
    return { architecture: task.architecture, iterations: Math.max(1, Math.floor(task.iterations)) };
  } catch (error) {
    console.log(`M2-3A step: task fetch failed (${error instanceof Error ? error.message : String(error)}), using fallback B-bundle x 1`);
    return { architecture: "B-bundle", iterations: 1 };
  }
}

const SOURCE = process.env.EXPO_PUBLIC_CATALOGUE_SOURCE ?? "http://127.0.0.1:8082";