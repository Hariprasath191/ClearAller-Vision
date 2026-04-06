import { Prisma } from "@prisma/client";
import type { AllergyCategory, AllergyProfileInput, RiskHit, SafetyPrediction, SeverityLevel } from "@clearaller/shared";
import { normalizeIngredientToken, severityWeight, splitIngredients } from "@clearaller/shared";
import { prisma } from "../lib/db.js";
import { hydrateIngredientKnowledge } from "./knowledge-base.js";
import { inferMlSignals, type ClassifierSignal } from "./ml-classifier.js";
import { hasPythonMlModel, inferPythonMlSignals, type PythonMlSignal } from "./python-ml.js";

type ProfileRecord = {
  id: string;
  name: string;
  age: number;
  medicalConditions: unknown;
  allergySettings: Array<{ category: string; severity: SeverityLevel }>;
};

type KnowledgeRecord = {
  canonicalName: string;
  synonyms: string[];
  description: string | null;
  sourceList: string[];
  categories: string[];
};

type ConfidenceBand = "Low Evidence" | "Moderate Evidence" | "Strong Evidence";

type RiskHitWithSource = RiskHit & {
  detectedBy?: "rules" | "ml" | "hybrid";
};

type SafetyPredictionWithSignals = SafetyPrediction & {
  confidenceBand: ConfidenceBand;
  unknownIngredients: string[];
  mlSignals?: ClassifierSignal[];
};

const prismaCategoryMap: Record<string, AllergyCategory> = {
  dairy: "dairy",
  peanuts: "peanuts",
  gluten: "gluten",
  soy: "soy",
  eggs: "eggs",
  shellfish: "shellfish",
  tree_nuts: "tree-nuts",
  sesame: "sesame",
  fragrance: "fragrance",
  preservatives: "preservatives",
  colorants: "colorants",
  sulfates: "sulfates",
  parabens: "parabens"
};

function findSeverity(profile: AllergyProfileInput, categories: AllergyCategory[]): SeverityLevel | null {
  const severities = profile.allergySettings
    .filter((entry) => categories.includes(entry.category))
    .map((entry) => entry.severity);

  return severities.sort((left, right) => severityWeight[right] - severityWeight[left])[0] ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function uniqueCategories(values: AllergyCategory[]) {
  return Array.from(new Set(values));
}

function severityBonus(severity: SeverityLevel) {
  if (severity === "critical") {
    return 0.18;
  }

  if (severity === "high") {
    return 0.1;
  }

  if (severity === "medium") {
    return 0.04;
  }

  return 0;
}

function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.74) {
    return "Strong Evidence";
  }

  if (confidence >= 0.48) {
    return "Moderate Evidence";
  }

  return "Low Evidence";
}

function mergeSignals(localSignals: ClassifierSignal[], pythonSignals: PythonMlSignal[]): ClassifierSignal[] {
  const merged = new Map<string, ClassifierSignal>();

  for (const signal of [...localSignals, ...pythonSignals]) {
    const key = signal.ingredient;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ingredient: signal.ingredient,
        categories: [...signal.categories],
        confidence: signal.confidence,
        source: "classifier"
      });
      continue;
    }

    existing.categories = uniqueCategories([...existing.categories, ...signal.categories]);
    existing.confidence = Number(Math.max(existing.confidence, signal.confidence).toFixed(2));
    merged.set(key, existing);
  }

  return Array.from(merged.values());
}

function mergeRuleAndMlHits(ruleHits: RiskHitWithSource[], mlSignals: ClassifierSignal[], profile: AllergyProfileInput): RiskHitWithSource[] {
  const merged = new Map<string, RiskHitWithSource>();

  for (const hit of ruleHits) {
    merged.set(hit.ingredient, hit);
  }

  for (const signal of mlSignals) {
    if (signal.confidence < 0.58) {
      continue;
    }

    const severity = findSeverity(profile, signal.categories);
    if (!severity) {
      continue;
    }

    const existing = merged.get(signal.ingredient);
    if (existing) {
      existing.probability = Number(clamp(existing.probability * 0.82 + signal.confidence * 0.12, 0.08, 0.91).toFixed(2));
      existing.detectedBy = "hybrid";
      existing.categories = uniqueCategories([...existing.categories, ...signal.categories]);
      merged.set(signal.ingredient, existing);
      continue;
    }

    merged.set(signal.ingredient, {
      ingredient: signal.ingredient,
      matchedName: signal.ingredient,
      categories: signal.categories,
      probability: Number(clamp(severityWeight[severity] * 0.28 + signal.confidence * 0.16, 0.08, 0.62).toFixed(2)),
      severity,
      detectedBy: "ml"
    });
  }

  return Array.from(merged.values()).sort((left, right) => right.probability - left.probability);
}

export async function analyzeIngredients(params: {
  userId: string;
  profileIds?: string[];
  scope: "selected" | "all";
  extractedText: string;
  productQuery?: string;
  persistHistory?: boolean;
}) {
  const normalizedIngredients = splitIngredients(params.extractedText);
  const knowledgeEntries = (await hydrateIngredientKnowledge(normalizedIngredients)) as KnowledgeRecord[];
  const localMlSignals = await inferMlSignals(normalizedIngredients);
  const pythonMlSignals = hasPythonMlModel() ? await inferPythonMlSignals(normalizedIngredients) : [];
  const mlSignals = mergeSignals(localMlSignals, pythonMlSignals);

  const profiles = (await prisma.allergyProfile.findMany({
    where: {
      userId: params.userId,
      ...(params.scope === "selected" && params.profileIds?.length ? { id: { in: params.profileIds } } : {})
    },
    include: {
      allergySettings: true
    }
  })) as ProfileRecord[];

  const knownIngredientNames = new Set(
    knowledgeEntries
      .filter((entry) => entry.categories.length > 0 || Boolean(entry.description) || entry.synonyms.length > 1)
      .map((entry) => normalizeIngredientToken(entry.canonicalName))
  );

  const predictions: SafetyPredictionWithSignals[] = profiles.map((profile: ProfileRecord) => {
    const profileInput: AllergyProfileInput = {
      name: profile.name,
      age: profile.age,
      allergySettings: profile.allergySettings.map((item) => ({
        category: prismaCategoryMap[item.category],
        severity: item.severity
      })),
      medicalConditions: (profile.medicalConditions as Array<{ name: string; note?: string }> | null) ?? undefined
    };

    const ruleHits = knowledgeEntries
      .filter((entry) => entry.categories.length > 0)
      .map((entry) => {
        const categories = entry.categories.map((category: string) => prismaCategoryMap[category]).filter(Boolean);
        const severity = findSeverity(profileInput, categories);

        if (!severity) {
          return null;
        }

        const evidenceBoost = (entry.synonyms.length > 2 ? 0.06 : 0.02) + (entry.description ? 0.06 : 0);
        const probability = clamp(severityWeight[severity] * 0.62 + evidenceBoost + severityBonus(severity), 0.08, 0.94);

        return {
          ingredient: normalizeIngredientToken(entry.canonicalName),
          matchedName: entry.canonicalName,
          categories,
          probability: Number(probability.toFixed(2)),
          severity,
          explanation: entry.description
            ? {
                ingredient: entry.canonicalName,
                source: entry.sourceList[0] ?? "knowledge-base",
                description: entry.description
              }
            : undefined,
          detectedBy: "rules"
        } as RiskHitWithSource;
      })
      .filter((item): item is RiskHitWithSource => Boolean(item));

    const profileSignals = mlSignals.filter((signal) =>
      signal.categories.some((category: AllergyCategory) => profileInput.allergySettings.some((setting) => setting.category === category))
    );
    const matchedAllergens = mergeRuleAndMlHits(ruleHits, profileSignals, profileInput);
    const maxProbability = matchedAllergens[0]?.probability ?? 0;
    const medicalConditions = Array.isArray(profile.medicalConditions) ? profile.medicalConditions : [];
    const unknownIngredients = normalizedIngredients.filter((ingredient) => !knownIngredientNames.has(ingredient));
    const evidenceCoverage = normalizedIngredients.length
      ? (normalizedIngredients.length - unknownIngredients.length) / normalizedIngredients.length
      : 0;
    const strongHits = matchedAllergens.filter((hit) => hit.probability >= 0.6).length;
    const averageMlConfidence = profileSignals.length
      ? profileSignals.reduce((sum, signal) => sum + signal.confidence, 0) / profileSignals.length
      : 0;

    const confidence = Number(
      clamp(
        0.22 +
          evidenceCoverage * 0.44 +
          Math.min(matchedAllergens.length * 0.08, 0.18) +
          strongHits * 0.07 +
          Math.min(averageMlConfidence * 0.09, 0.06) -
          (unknownIngredients.length ? Math.min(unknownIngredients.length * 0.035, 0.14) : 0) -
          (matchedAllergens.length === 0 ? 0.03 : 0),
        0.18,
        0.9
      ).toFixed(2)
    );

    const strongestRuleHit = matchedAllergens.some((hit) => hit.detectedBy !== "ml" && hit.probability >= 0.46);
    const strongestMlHit = matchedAllergens.some((hit) => hit.detectedBy === "ml" && hit.probability >= 0.58);
    const criticalRuleHit = matchedAllergens.some((hit) => hit.detectedBy !== "ml" && hit.severity === "critical" && hit.probability >= 0.68);
    const rating =
      maxProbability >= 0.78 || criticalRuleHit
        ? "High Risk"
        : maxProbability >= 0.46 && (strongestRuleHit || strongestMlHit)
          ? "Moderate Risk"
          : "Safe";

    return {
      profileId: profile.id,
      profileName: profile.name,
      rating,
      confidence,
      confidenceBand: confidenceBand(confidence),
      matchedAllergens,
      safeIngredients: normalizedIngredients.filter(
        (ingredient: string) => !matchedAllergens.some((match) => match.ingredient === ingredient)
      ),
      unknownIngredients,
      notes: [
        params.scope === "all"
          ? "Analysis compared the product against every saved profile on this account."
          : "Analysis used the selected allergy profile only.",
        medicalConditions.length
          ? "Medical conditions were considered as contextual notes for review."
          : "No medical conditions were attached to this profile.",
        pythonMlSignals.length
          ? "Trained Python model signals were combined with direct ingredient matches."
          : profileSignals.length
            ? "Fallback classifier signals were combined with direct ingredient matches for broader detection."
            : "No additional classifier-only signals were needed for this result.",
        unknownIngredients.length
          ? `Some ingredients are still uncertain: ${unknownIngredients.slice(0, 5).join(", ")}${unknownIngredients.length > 5 ? ", ..." : ""}.`
          : "Every extracted ingredient had at least one knowledge-base clue for review.",
        confidence < 0.48
          ? "Treat this result as an early warning only and manually review the label before relying on it."
          : "Evidence strength is reasonable, but manual label review is still recommended for safety-critical decisions."
      ],
      mlSignals: profileSignals
    };
  });

  if (params.persistHistory !== false) {
    await prisma.analysisHistory.create({
      data: {
        userId: params.userId,
        sourceImageName: null,
        productQuery: params.productQuery,
        rawExtractedText: params.extractedText,
        normalizedText: normalizedIngredients.join(", "),
        profileHits: {
          create: predictions.map((prediction) => ({
            profile: { connect: { id: prediction.profileId } },
            rating: prediction.rating,
            confidence: prediction.confidence,
            matchedRisk: prediction.matchedAllergens as unknown as Prisma.InputJsonValue,
            safeIngredients: prediction.safeIngredients as unknown as Prisma.InputJsonValue,
            notes: prediction.notes as unknown as Prisma.InputJsonValue
          }))
        }
      }
    });
  }

  return {
    ingredients: normalizedIngredients,
    predictions,
    ml: {
      pythonModelAvailable: hasPythonMlModel(),
      pythonSignals: pythonMlSignals.length,
      fallbackSignals: localMlSignals.length
    }
  };
}
