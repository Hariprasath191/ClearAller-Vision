import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AllergyCategory } from "@clearaller/shared";

const execFileAsync = promisify(execFile);

export type PythonMlSignal = {
  ingredient: string;
  categories: AllergyCategory[];
  confidence: number;
  source: "classifier";
};

function resolvePythonPath() {
  return process.env.ML_PYTHON_PATH || "C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\python\\python.exe";
}

function resolvePredictScript() {
  return resolve(process.cwd(), "ml", "src", "predict.py");
}

function resolveModelPath() {
  return resolve(process.cwd(), "ml", "artifacts", "random_forest_model.joblib");
}

export function hasPythonMlModel() {
  return existsSync(resolvePythonPath()) && existsSync(resolvePredictScript()) && existsSync(resolveModelPath());
}

export async function inferPythonMlSignals(ingredients: string[]): Promise<PythonMlSignal[]> {
  if (!hasPythonMlModel()) {
    return [];
  }

  const payload = JSON.stringify({ ingredients, model_path: resolveModelPath() });
  const { stdout } = await execFileAsync(resolvePythonPath(), [resolvePredictScript(), payload], {
    maxBuffer: 1024 * 1024,
    encoding: "utf8"
  });

  const parsed = JSON.parse(stdout) as { signals?: PythonMlSignal[]; status?: string };
  return parsed.signals ?? [];
}
