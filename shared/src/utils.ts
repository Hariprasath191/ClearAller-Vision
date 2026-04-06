import type { SeverityLevel } from "./types.js";

export const severityWeight: Record<SeverityLevel, number> = {
  low: 0.35,
  medium: 0.58,
  high: 0.78,
  critical: 0.95
};

const stopPhrases = [
  "contains",
  "may contain",
  "allergen",
  "allergens",
  "warning",
  "distributed by",
  "imported by",
  "nutrition",
  "product description",
  "how to use",
  "description",
  "ingredients",
  "directions",
  "usage"
];

export function normalizeIngredientToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeIngredient(value: string): boolean {
  if (!value || value.length < 3 || value.length > 80) {
    return false;
  }

  if (stopPhrases.some((phrase) => value.includes(phrase))) {
    return false;
  }

  if (value.split(" ").length > 8) {
    return false;
  }

  if (/\b(vitamin|mineral|daily value|serving|calorie|product|description|directions)\b/.test(value)) {
    return false;
  }

  return true;
}

export function splitIngredients(text: string): string[] {
  return text
    .split(/[,.;\n]+/g)
    .map((item) => normalizeIngredientToken(item))
    .filter((item) => looksLikeIngredient(item));
}
