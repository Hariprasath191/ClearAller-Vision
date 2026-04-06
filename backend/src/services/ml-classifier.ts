import type { AllergyCategory } from "@clearaller/shared";
import { normalizeIngredientToken } from "@clearaller/shared";
import { prisma } from "../lib/db.js";

export type ClassifierSignal = {
  ingredient: string;
  categories: AllergyCategory[];
  confidence: number;
  source: "classifier";
};

type ClassifierState = {
  trainedAt: number;
  tokenWeights: Record<AllergyCategory, Record<string, number>>;
};

const CACHE_TTL_MS = 1000 * 60 * 5;
let cachedState: ClassifierState | null = null;

const seedWeights: Record<AllergyCategory, string[]> = {
  dairy: ["milk", "casein", "whey", "butter", "cream", "lactose", "cheese", "ghee"],
  peanuts: ["peanut", "groundnut", "arachis"],
  gluten: ["wheat", "barley", "rye", "malt", "spelt", "semolina", "triticum"],
  soy: ["soy", "soya", "lecithin", "miso", "tamari", "tofu"],
  eggs: ["egg", "albumin", "ovalbumin", "lysozyme"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "krill"],
  "tree-nuts": ["almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "argan"],
  sesame: ["sesame", "tahini", "gingelly"],
  fragrance: ["fragrance", "parfum", "linalool", "limonene", "citral", "geraniol"],
  preservatives: ["benzoate", "sorbate", "phenoxyethanol", "bha", "bht", "formaldehyde"],
  colorants: ["lake", "dye", "pigment", "color", "ci"],
  sulfates: ["sulfate", "sulphate", "sls", "sles"],
  parabens: ["paraben", "methylparaben", "propylparaben", "butylparaben"]
};

function createEmptyWeights(): Record<AllergyCategory, Record<string, number>> {
  return {
    dairy: {},
    peanuts: {},
    gluten: {},
    soy: {},
    eggs: {},
    shellfish: {},
    "tree-nuts": {},
    sesame: {},
    fragrance: {},
    preservatives: {},
    colorants: {},
    sulfates: {},
    parabens: {}
  };
}

function categoryFromPrisma(value: string): AllergyCategory {
  return value === "tree_nuts" ? "tree-nuts" : (value as AllergyCategory);
}

function tokensForValue(value: string): string[] {
  const normalized = normalizeIngredientToken(value);
  return normalized.split(/\s+/g).filter((token) => token.length >= 2);
}

async function trainClassifier(): Promise<ClassifierState> {
  const weights = createEmptyWeights();

  for (const [category, features] of Object.entries(seedWeights) as Array<[AllergyCategory, string[]]>) {
    for (const feature of features) {
      weights[category][feature] = (weights[category][feature] ?? 0) + 1.3;
    }
  }

  const knowledgeEntries = await prisma.ingredientKnowledge.findMany({
    select: {
      normalizedName: true,
      synonyms: true,
      derivatives: true,
      categories: true
    }
  });

  for (const entry of knowledgeEntries) {
    const categories = entry.categories.map((category) => categoryFromPrisma(category));
    const values = [entry.normalizedName, ...entry.synonyms, ...entry.derivatives];

    for (const category of categories) {
      for (const value of values) {
        for (const token of tokensForValue(value)) {
          weights[category][token] = (weights[category][token] ?? 0) + 0.9;
        }
      }
    }
  }

  return {
    trainedAt: Date.now(),
    tokenWeights: weights
  };
}

async function getClassifierState(): Promise<ClassifierState> {
  if (cachedState && Date.now() - cachedState.trainedAt < CACHE_TTL_MS) {
    return cachedState;
  }

  cachedState = await trainClassifier();
  return cachedState;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export async function inferMlSignals(ingredients: string[]): Promise<ClassifierSignal[]> {
  const classifier = await getClassifierState();
  const signals: ClassifierSignal[] = [];

  for (const ingredient of ingredients) {
    const tokens = tokensForValue(ingredient);
    const categories: AllergyCategory[] = [];
    let strongest = 0;

    for (const [category, tokenMap] of Object.entries(classifier.tokenWeights) as Array<[
      AllergyCategory,
      Record<string, number>
    ]>) {
      const rawScore = tokens.reduce((score, token) => score + (tokenMap[token] ?? 0), 0);
      if (rawScore >= 1.25) {
        categories.push(category);
        strongest = Math.max(strongest, sigmoid(rawScore / 2.4));
      }
    }

    if (categories.length) {
      signals.push({
        ingredient,
        categories,
        confidence: Number(strongest.toFixed(2)),
        source: "classifier"
      });
    }
  }

  return signals;
}
