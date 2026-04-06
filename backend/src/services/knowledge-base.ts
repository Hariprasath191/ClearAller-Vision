import type { AllergyCategory, EducationalExplanation } from "@clearaller/shared";
import { normalizeIngredientToken } from "@clearaller/shared";
import { prisma } from "../lib/db.js";
import { fetchPubChemExplanation, fetchInciExplanation } from "../providers/knowledge-sources.js";
import { fetchFdaLabelMatches } from "../providers/fda.js";

const categorySignals: Record<AllergyCategory, string[]> = {
  dairy: ["milk", "casein", "whey", "lactose", "butter", "ghee", "cheese", "cream", "caseinate", "milk solids"],
  peanuts: ["peanut", "groundnut", "arachis", "peanut oil", "peanut flour"],
  gluten: ["wheat", "barley", "rye", "malt", "spelt", "semolina", "triticum", "farina", "bulgur"],
  soy: ["soy", "soya", "lecithin", "edamame", "miso", "tamari", "soy protein"],
  eggs: ["egg", "albumin", "ovalbumin", "lysozyme", "albumen"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "shellfish", "krill", "crustacean"],
  "tree-nuts": ["almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "argan", "brazil nut"],
  sesame: ["sesame", "tahini", "gingelly", "sesamum indicum"],
  fragrance: ["fragrance", "parfum", "linalool", "limonene", "citral", "geraniol", "hexyl cinnamal"],
  preservatives: ["benzoate", "sorbate", "phenoxyethanol", "formaldehyde", "bha", "bht", "sodium benzoate"],
  colorants: ["lake", "dye", "ci ", "red ", "yellow ", "blue ", "fd&c"],
  sulfates: ["sulfate", "sulphate", "sls", "sles", "sodium laureth sulfate"],
  parabens: ["paraben", "methylparaben", "propylparaben", "butylparaben", "ethylparaben"]
};

const commonCosmeticBaseDescriptions: Record<string, string> = {
  dimethicone: "A silicone-based emollient commonly used to smooth skin or hair and improve product texture.",
  "dimethicone crosspolymer": "A silicone elastomer used to create slip, blur texture, and improve spreadability in cosmetics.",
  "dimethicone vinyl dimethicone crosspolymer": "A crosslinked silicone texturizer commonly used in primers, serums, and creams.",
  dimethiconol: "A silicone conditioning ingredient often used in hair and skin products for smooth feel and shine.",
  polyacrylamide: "A synthetic polymer used to stabilize texture and form gels in cosmetic formulations.",
  "cetearyl olivate": "An olive-derived emulsifier used to help oil and water stay blended in skin-care products.",
  "sorbitan olivate": "An olive-derived emulsifier that supports cream and lotion texture.",
  "c13 14 isoparaffin": "A lightweight hydrocarbon emollient used to improve spreadability in personal care formulas.",
  "laureth 7": "An ethoxylated surfactant and emulsifier used to help ingredients mix evenly in a formula.",
  carbomer: "A polymer thickener used to give gels and serums their texture.",
  "sodium hyaluronate": "A hyaluronic acid salt used as a humectant to attract and hold moisture.",
  "ethylhexylglycerin": "A multifunctional cosmetic ingredient often used to support preservation and skin feel.",
  "c12 14 pareth 12": "An ethoxylated surfactant used to solubilize and stabilize cosmetic ingredients.",
  "sodium hydroxide": "A pH-adjusting ingredient commonly used in very small amounts to balance formulations."
};

function inferCategories(normalizedIngredient: string): AllergyCategory[] {
  return (Object.entries(categorySignals) as Array<[AllergyCategory, string[]]>)
    .filter(([, signals]) => signals.some((signal) => normalizedIngredient.includes(signal)))
    .map(([category]) => category);
}

async function buildExplanation(ingredient: string): Promise<EducationalExplanation | null> {
  const pubchem = await fetchPubChemExplanation(ingredient);
  if (pubchem) {
    return pubchem;
  }

  return fetchInciExplanation(ingredient);
}

async function buildKnowledgeSnapshot(ingredient: string, normalizedName: string) {
  const explanation = await buildExplanation(ingredient);
  const fdaMatches = await fetchFdaLabelMatches(ingredient);
  const inferredCategories = inferCategories(normalizedName);
  const derivedSynonyms = Array.from(
    new Set([normalizedName, ...fdaMatches.map((item) => normalizeIngredientToken(item))].filter(Boolean))
  );
  const fallbackDescription = commonCosmeticBaseDescriptions[normalizedName];

  return {
    explanation,
    inferredCategories,
    derivedSynonyms,
    fallbackDescription
  };
}

export async function getOrCreateIngredientKnowledge(ingredient: string) {
  const normalizedName = normalizeIngredientToken(ingredient);
  const existing = await prisma.ingredientKnowledge.findFirst({
    where: {
      OR: [
        { normalizedName },
        { canonicalName: { equals: ingredient, mode: "insensitive" } },
        { synonyms: { has: normalizedName } },
        { derivatives: { has: normalizedName } }
      ]
    }
  });

  if (existing) {
    const snapshot = await buildKnowledgeSnapshot(ingredient, normalizedName);
    const mergedSynonyms = Array.from(new Set([...(existing.synonyms ?? []), ...(existing.derivatives ?? []), ...snapshot.derivedSynonyms]));
    const mergedCategories = Array.from(
      new Set([
        ...(existing.categories ?? []),
        ...snapshot.inferredCategories.map((category) => category.replace("-", "_"))
      ])
    );
    const mergedSources = Array.from(
      new Set([...(existing.sourceList ?? []), "FDA", "heuristic", snapshot.explanation?.source, snapshot.fallbackDescription ? "cosmetic-base" : undefined].filter((value): value is string => Boolean(value)))
    );

    const needsUpdate =
      mergedSynonyms.length > (existing.synonyms?.length ?? 0) ||
      mergedCategories.length > (existing.categories?.length ?? 0) ||
      ((!existing.description || existing.description.length < 12) && Boolean(snapshot.explanation?.description ?? snapshot.fallbackDescription));

    if (!needsUpdate) {
      return existing;
    }

    return prisma.ingredientKnowledge.update({
      where: { id: existing.id },
      data: {
        canonicalName: existing.canonicalName || ingredient,
        normalizedName,
        synonyms: mergedSynonyms,
        derivatives: mergedSynonyms,
        categories: mergedCategories as never,
        sourceList: mergedSources,
        description: existing.description || snapshot.explanation?.description || snapshot.fallbackDescription,
        lastVerifiedAt: new Date()
      }
    });
  }

  const snapshot = await buildKnowledgeSnapshot(ingredient, normalizedName);

  return prisma.ingredientKnowledge.create({
    data: {
      canonicalName: ingredient,
      normalizedName,
      synonyms: snapshot.derivedSynonyms,
      derivatives: snapshot.derivedSynonyms,
      categories: snapshot.inferredCategories.map((category) => category.replace("-", "_") as never),
      sourceList: ["PubChem", "FDA", snapshot.explanation?.source ?? "heuristic", snapshot.fallbackDescription ? "cosmetic-base" : undefined].filter(Boolean) as string[],
      scientificName: ingredient,
      description: snapshot.explanation?.description ?? snapshot.fallbackDescription,
      lastVerifiedAt: new Date()
    }
  });
}

export async function hydrateIngredientKnowledge(ingredients: string[]) {
  const results = [];
  for (const ingredient of ingredients) {
    results.push(await getOrCreateIngredientKnowledge(ingredient));
  }
  return results;
}
