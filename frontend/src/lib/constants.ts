import type { AllergyCategory } from "@clearaller/shared";

export const allergyOptions: AllergyCategory[] = [
  "dairy",
  "peanuts",
  "gluten",
  "soy",
  "eggs",
  "shellfish",
  "tree-nuts",
  "sesame",
  "fragrance",
  "preservatives",
  "colorants",
  "sulfates",
  "parabens"
];

export const severityOptions = ["low", "medium", "high", "critical"] as const;

export const productLensOptions = ["packaged-food", "cosmetic"] as const;
export const genderOptions = ["female", "male"] as const;
export const skinTypeOptions = ["normal", "dry", "oily", "combination", "sensitive"] as const;
export const hairTypeOptions = ["straight", "wavy", "curly", "coily", "dry", "oily", "damaged"] as const;
export const cosmeticConcernOptions = ["none", "acne-prone", "dandruff", "frizz", "hydration", "color-treated"] as const;
