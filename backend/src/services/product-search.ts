import pLimit from "p-limit";
import type { ProductResult, SafetyPrediction } from "@clearaller/shared";
import { prisma } from "../lib/db.js";
import {
  searchMakeupApi,
  searchOpenBeautyFacts,
  searchOpenFoodFacts,
  searchOpenProductsFacts,
  searchSkincareApi
} from "../providers/openfoodfacts.js";
import { analyzeIngredients } from "./risk-engine.js";

type RankedProduct = {
  product: ProductResult;
  predictions: SafetyPrediction[];
  safestLabel: string;
  recommendationScore: number;
  recommendationNote: string;
};

type ProfilePreferences = {
  profileId: string;
  gender: string;
  skinType: string;
  hairType: string;
  cosmeticConcern: string;
};

type CandidateProduct = {
  product: ProductResult;
  recommendationScore: number;
  recommendationNote: string;
};

type ProductGender = "male" | "female" | "unisex" | "unknown";

const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60;
const ANALYSIS_CACHE_TTL_MS = 1000 * 60 * 15;
const MAX_ANALYSIS_CANDIDATES = 8;
const searchCache = new Map<string, { expiresAt: number; value: ProductResult[] }>();
const analysisCache = new Map<string, { expiresAt: number; value: RankedProduct[] }>();
const analyzeLimit = pLimit(6);

function getCachedValue<T>(store: Map<string, { expiresAt: number; value: T }>, key: string): T | null {
  const entry = store.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue<T>(store: Map<string, { expiresAt: number; value: T }>, key: string, value: T, ttlMs: number) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function isCosmeticSearch(query: string, lens?: "packaged-food" | "cosmetic") {
  if (lens === "cosmetic") {
    return true;
  }

  if (lens === "packaged-food") {
    return false;
  }

  return isCosmeticQuery(query);
}

async function fetchProducts(query: string, lens?: "packaged-food" | "cosmetic"): Promise<ProductResult[]> {
  const cacheKey = `${query.trim().toLowerCase()}::${lens ?? "auto"}`;
  const cached = getCachedValue(searchCache, cacheKey);
  if (cached) {
    return cached;
  }

  const providerCalls = isCosmeticSearch(query, lens)
    ? [searchOpenBeautyFacts(query), searchSkincareApi(query), searchMakeupApi(query)]
    : [searchOpenFoodFacts(query), searchOpenProductsFacts(query)];

  const productGroups = await Promise.all(providerCalls);
  const merged = new Map<string, ProductResult>();

  for (const group of productGroups) {
    for (const product of group) {
      const mergeKey = `${normalizeValue(product.name)}|${normalizeValue(product.brand)}`;
      const existing = merged.get(mergeKey);
      if (!existing) {
        merged.set(mergeKey, product);
        continue;
      }

      merged.set(mergeKey, {
        ...existing,
        imageUrl: existing.imageUrl ?? product.imageUrl,
        ingredientsText: existing.ingredientsText ?? product.ingredientsText,
        purchaseUrl: existing.purchaseUrl ?? product.purchaseUrl,
        reviewRating: Math.max(existing.reviewRating ?? 0, product.reviewRating ?? 0) || undefined,
        reviewCount: Math.max(existing.reviewCount ?? 0, product.reviewCount ?? 0) || undefined,
        popularityScore: Math.max(existing.popularityScore ?? 0, product.popularityScore ?? 0) || undefined,
        source: existing.source === product.source ? existing.source : `${existing.source}, ${product.source}`,
        sourceSite: existing.sourceSite ?? product.sourceSite
      });
    }
  }

  const products = Array.from(merged.values());
  setCachedValue(searchCache, cacheKey, products, SEARCH_CACHE_TTL_MS);
  return products;
}

function normalizeValue(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function readPreference(medicalConditions: unknown, tag: string) {
  if (!Array.isArray(medicalConditions)) {
    return "";
  }

  const found = medicalConditions.find(
    (item): item is { name?: string; note?: string } =>
      typeof item === "object" && item !== null && "note" in item && (item as { note?: string }).note === tag
  );

  return normalizeValue(found?.name);
}

function isCosmeticQuery(query: string) {
  const normalized = query.toLowerCase();
  return ["shampoo", "conditioner", "serum", "lotion", "cleanser", "face wash", "body wash", "facewash", "sunscreen", "moisturizer", "soap", "cream", "toner", "skincare"].some((token) =>
    normalized.includes(token)
  );
}

function isBabyProduct(query: string, product: ProductResult) {
  const normalizedQuery = query.toLowerCase();
  if (normalizedQuery.includes("baby")) {
    return false;
  }

  const haystack = `${product.name} ${product.brand ?? ""} ${product.category}`.toLowerCase();
  return /\bbaby\b|\bchildren\b|\bkids\b|\bnewborn\b/.test(haystack);
}

function isIndiaAvailable(product: ProductResult) {
  return true;
}

function queryMatchBoost(query: string, product: ProductResult) {
  const normalizedQuery = query.toLowerCase().trim();
  const haystack = `${product.name} ${product.brand ?? ""} ${product.category}`.toLowerCase();
  let score = 0;

  for (const token of normalizedQuery.split(/\s+/).filter((entry) => entry.length > 2)) {
    if (haystack.includes(token)) {
      score += 14;
    }
  }

  if (haystack.includes(normalizedQuery)) {
    score += 18;
  }

  return score;
}

function detectProductGender(product: ProductResult): ProductGender {
  const haystack = `${product.name} ${product.brand ?? ""} ${product.category}`.toLowerCase();

  if (/\bmen\b|\bmale\b|\bfor him\b/.test(haystack)) {
    return "male";
  }

  if (/\bwomen\b|\bfemale\b|\bfor her\b/.test(haystack)) {
    return "female";
  }

  if (/\bunisex\b/.test(haystack)) {
    return "unisex";
  }

  return "unknown";
}

function isGenderCompatible(product: ProductResult, preferences: ProfilePreferences[], query: string) {
  if (!isCosmeticQuery(query) || preferences.length === 0) {
    return true;
  }

  const productGender = detectProductGender(product);
  if (productGender === "unknown" || productGender === "unisex") {
    return true;
  }

  const selectedGenders = new Set(preferences.map((preference) => preference.gender).filter(Boolean));
  if (selectedGenders.size === 0) {
    return true;
  }

  return selectedGenders.size === 1 && selectedGenders.has(productGender);
}

function cosmeticPreferenceBoost(product: ProductResult, query: string, preferences: ProfilePreferences[]) {
  const haystack = `${product.name} ${product.category} ${query}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  for (const preference of preferences) {
    if (preference.gender === "female" && /\bwomen\b|\bfemale\b|\bfor her\b/.test(haystack)) {
      score += 12;
      reasons.push("female fit");
    }

    if (preference.gender === "male" && /\bmen\b|\bmale\b|\bfor him\b/.test(haystack)) {
      score += 12;
      reasons.push("male fit");
    }

    if (preference.skinType && haystack.includes(preference.skinType)) {
      score += 18;
      reasons.push(`${preference.skinType} skin`);
    }

    if (preference.hairType && haystack.includes(preference.hairType)) {
      score += 18;
      reasons.push(`${preference.hairType} hair`);
    }

    if (preference.cosmeticConcern && preference.cosmeticConcern !== "none" && haystack.includes(preference.cosmeticConcern.replace("-", " "))) {
      score += 12;
      reasons.push(preference.cosmeticConcern.replace("-", " "));
    }
  }

  return {
    score,
    note: reasons.length ? `Best fit for ${Array.from(new Set(reasons)).join(", ")}.` : "Safe match based on saved allergy profiles."
  };
}

function reviewBoost(product: ProductResult) {
  const rating = product.reviewRating ?? 0;
  const count = product.reviewCount ?? 0;
  return rating > 0 ? rating * 14 + Math.min(count, 250) / 20 : 0;
}

function reviewNote(product: ProductResult) {
  if (product.reviewRating && product.reviewRating >= 4) {
    return `Highly rated (${product.reviewRating.toFixed(1)}/5) and screened for your saved profiles.`;
  }

  if (product.reviewRating && product.reviewRating >= 3.5) {
    return `Good rating signal (${product.reviewRating.toFixed(1)}/5) with profile-safe ingredient screening.`;
  }

  return "";
}

function riskPriority(label: string) {
  if (label === "Safe") {
    return 0;
  }

  if (label === "Moderate Risk") {
    return 1;
  }

  return 2;
}

function completenessScore(product: ProductResult) {
  return (
    (product.imageUrl ? 10 : 0) +
    (product.brand ? 8 : 0) +
    (product.purchaseUrl ? 6 : 0) +
    Math.min((product.popularityScore ?? 0) / 25, 10) +
    Math.min((product.ingredientsText?.length ?? 0) / 20, 12)
  );
}

function hasUsableIngredients(product: ProductResult): boolean {
  const text = (product.ingredientsText ?? "").trim();
  // Accept if there is any ingredient text at all (even short)
  if (text.length > 0) return true;
  // Fallback: accept if the product has a meaningful name and brand (will be analysed as unknown ingredients)
  const name = (product.name ?? "").trim();
  const brand = (product.brand ?? "").trim();
  return name.length >= 3 && brand.length >= 1;
}

function buildCandidateProducts(products: ProductResult[], query: string, preferences: ProfilePreferences[], lens?: "packaged-food" | "cosmetic") {
  return products
    .filter((product) => !isBabyProduct(query, product))
    .filter((product) => isIndiaAvailable(product))
    .filter((product) => hasUsableIngredients(product))
    .filter((product) => isGenderCompatible(product, preferences, query))
    .filter((product) => !isCosmeticSearch(query, lens) || !product.reviewRating || product.reviewRating >= 3.0)
    .map((product) => {
      const cosmeticBoost = isCosmeticSearch(query, lens)
        ? cosmeticPreferenceBoost(product, query, preferences)
        : { score: 0, note: "Safe choice based on saved allergy profiles." };

      const reviewDrivenNote = reviewNote(product);
      const recommendationScore = completenessScore(product) + cosmeticBoost.score + queryMatchBoost(query, product) + reviewBoost(product);

      return {
        product,
        recommendationScore,
        recommendationNote: reviewDrivenNote || cosmeticBoost.note
      } satisfies CandidateProduct;
    })
    .sort((left, right) => right.recommendationScore - left.recommendationScore)
    .slice(0, MAX_ANALYSIS_CANDIDATES);
}

export async function searchAndEvaluateProducts(params: {
  userId: string;
  query: string;
  lens?: "packaged-food" | "cosmetic";
  scope: "selected" | "all";
  profileIds?: string[];
}) {
  const profiles = await prisma.allergyProfile.findMany({
    where: {
      userId: params.userId,
      ...(params.scope === "selected" && params.profileIds?.length ? { id: { in: params.profileIds } } : {})
    },
    select: {
      id: true,
      medicalConditions: true
    }
  });

  const preferences = profiles.map((profile) => ({
    profileId: profile.id,
    gender: readPreference(profile.medicalConditions, "gender"),
    skinType: readPreference(profile.medicalConditions, "skinType"),
    hairType: readPreference(profile.medicalConditions, "hairType"),
      cosmeticConcern: readPreference(profile.medicalConditions, "cosmeticConcern")
  }));

  const cacheKey = JSON.stringify({
    userId: params.userId,
    query: params.query.trim().toLowerCase(),
    lens: params.lens ?? "auto",
    scope: params.scope,
    profileIds: params.profileIds ?? [],
    preferences: preferences.map((preference) => ({
      profileId: preference.profileId,
      gender: preference.gender,
      skinType: preference.skinType,
      hairType: preference.hairType,
      cosmeticConcern: preference.cosmeticConcern
    }))
  });
  const cached = getCachedValue(analysisCache, cacheKey);
  if (cached) {
    return cached;
  }

  const products = await fetchProducts(params.query, params.lens);

  const candidates = buildCandidateProducts(products, params.query, preferences, params.lens);

  const ranked = (
    await Promise.all(
      candidates.map((candidate) =>
        analyzeLimit(async () => {
          const analysis = await analyzeIngredients({
            userId: params.userId,
            extractedText: candidate.product.ingredientsText ?? "",
            productQuery: candidate.product.name,
            profileIds: params.profileIds,
            scope: params.scope,
            persistHistory: false
          });

          const highestRisk = analysis.predictions.some((prediction) => prediction.rating === "High Risk")
            ? "High Risk"
            : analysis.predictions.some((prediction) => prediction.rating === "Moderate Risk")
              ? "Moderate Risk"
              : "Safe";

          return {
            product: candidate.product,
            predictions: analysis.predictions,
            safestLabel: highestRisk,
            recommendationScore: candidate.recommendationScore,
            recommendationNote: candidate.recommendationNote
          } satisfies RankedProduct;
        })
      )
    )
  ).filter((item): item is RankedProduct => Boolean(item));

  const safeOnly = ranked
    .filter((item) => item.safestLabel === "Safe")
    .sort((left, right) => right.recommendationScore - left.recommendationScore);

  const fallback = ranked
    .filter((item) => item.safestLabel !== "High Risk")
    .sort((left, right) => {
      const priorityGap = riskPriority(left.safestLabel) - riskPriority(right.safestLabel);
      if (priorityGap !== 0) {
        return priorityGap;
      }

      return right.recommendationScore - left.recommendationScore;
    });

  // Show safe-only list if we got even one safe product; otherwise show the safest fallback list
  const ordered = (safeOnly.length >= 1 ? safeOnly : fallback).slice(0, 3);

  setCachedValue(analysisCache, cacheKey, ordered, ANALYSIS_CACHE_TTL_MS);
  return ordered;
}
