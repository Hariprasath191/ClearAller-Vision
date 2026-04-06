import type { ProductResult } from "@clearaller/shared";

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const SEARCH_TIMEOUT_MS = 2200;

async function fetchJson<T>(url: URL): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runOpenFactsSearch(baseUrl: string, query: string, source: string, fallbackCategory: string): Promise<ProductResult[]> {
  const url = new URL("/cgi/search.pl", baseUrl);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "10");

  const data = await fetchJson<{ products?: Array<Record<string, unknown>> }>(url);
  if (!data) {
    return [];
  }

  return (data.products ?? []).map((product, index) => ({
    id: `${source}-${String(product.code ?? `${query}-${index}`)}`,
    name: safeString(product.product_name) ?? "Unnamed product",
    brand: safeString(product.brands),
    category: safeString(product.categories) ?? fallbackCategory,
    source,
    sourceSite: baseUrl,
    availabilityCountries: Array.isArray(product.countries_tags)
      ? product.countries_tags.filter((entry): entry is string => typeof entry === "string")
      : safeString(product.countries)
        ? [safeString(product.countries)!]
        : undefined,
    imageUrl: safeString(product.image_front_small_url) ?? safeString(product.image_small_url),
    ingredientsText: safeString(product.ingredients_text_en) ?? safeString(product.ingredients_text),
    purchaseUrl: safeString(product.url),
    popularityScore: safeNumber(product.unique_scans_n) ?? safeNumber(product.popularity_key)
  }));
}

type SkincareApiProduct = {
  id?: number;
  brand?: string;
  name?: string;
  product_name?: string;
  category?: string;
  product_type?: string;
  ingredients?: string[];
  ingredient_list?: string[];
  image?: string;
  image_link?: string;
  url?: string;
  product_link?: string;
};

export async function searchSkincareApi(query: string): Promise<ProductResult[]> {
  const url = new URL("https://skincare-api.herokuapp.com/product");
  url.searchParams.set("q", query);

  const data = await fetchJson<SkincareApiProduct[] | { products?: SkincareApiProduct[] }>(url);
  const products = Array.isArray(data) ? data : data?.products ?? [];

  return products.slice(0, 12).map((product, index) => ({
    id: `SkincareAPI-${String(product.id ?? `${query}-${index}`)}`,
    name: safeString(product.name) ?? safeString(product.product_name) ?? "Unnamed product",
    brand: safeString(product.brand),
    category: safeString(product.category) ?? safeString(product.product_type) ?? "cosmetic",
    source: "SkincareAPI",
    sourceSite: "https://skincare-api.herokuapp.com",
    imageUrl: safeString(product.image) ?? safeString(product.image_link),
    ingredientsText: Array.isArray(product.ingredients)
      ? product.ingredients.join(", ")
      : Array.isArray(product.ingredient_list)
        ? product.ingredient_list.join(", ")
        : undefined,
    purchaseUrl: safeString(product.url) ?? safeString(product.product_link)
  }));
}

type MakeupApiProduct = {
  id?: number;
  brand?: string;
  name?: string;
  product_type?: string;
  image_link?: string;
  product_link?: string;
  description?: string;
  rating?: number | string | null;
};

const makeupTypeMap: Array<[RegExp, string]> = [
  [/\blipstick\b|\blip balm\b/, "lipstick"],
  [/\bmascara\b/, "mascara"],
  [/\beyeliner\b/, "eyeliner"],
  [/\bfoundation\b/, "foundation"],
  [/\bblush\b/, "blush"],
  [/\bbronzer\b/, "bronzer"],
  [/\bconcealer\b/, "concealer"],
  [/\beyeshadow\b/, "eyeshadow"],
  [/\bnail\b|\bpolish\b/, "nail_polish"]
];

function detectMakeupType(query: string) {
  const normalized = query.toLowerCase();
  return makeupTypeMap.find(([pattern]) => pattern.test(normalized))?.[1];
}

export async function searchMakeupApi(query: string): Promise<ProductResult[]> {
  const productType = detectMakeupType(query);
  if (!productType) {
    return [];
  }

  const url = new URL("https://makeup-api.herokuapp.com/api/v1/products.json");
  url.searchParams.set("product_type", productType);

  const data = await fetchJson<MakeupApiProduct[]>(url);
  if (!data) {
    return [];
  }

  const normalizedQuery = query.toLowerCase();
  return data
    .filter((product) => `${product.name ?? ""} ${product.brand ?? ""}`.toLowerCase().includes(normalizedQuery.split(/\s+/)[0] ?? ""))
    .slice(0, 12)
    .map((product, index) => {
      const numericRating =
        typeof product.rating === "number"
          ? product.rating
          : typeof product.rating === "string" && product.rating.trim() && product.rating !== "unrated"
            ? Number(product.rating)
            : undefined;

      return {
        id: `MakeupAPI-${String(product.id ?? `${query}-${index}`)}`,
        name: safeString(product.name) ?? "Unnamed product",
        brand: safeString(product.brand),
        category: safeString(product.product_type) ?? "cosmetic",
        source: "MakeupAPI",
        sourceSite: "https://makeup-api.herokuapp.com",
        imageUrl: safeString(product.image_link),
        ingredientsText: safeString(product.description),
        purchaseUrl: safeString(product.product_link),
        reviewRating: typeof numericRating === "number" && Number.isFinite(numericRating) ? numericRating : undefined
      } satisfies ProductResult;
    });
}

export async function searchOpenFoodFacts(query: string): Promise<ProductResult[]> {
  return runOpenFactsSearch("https://world.openfoodfacts.org", query, "OpenFoodFacts", "food");
}

export async function searchOpenBeautyFacts(query: string): Promise<ProductResult[]> {
  return runOpenFactsSearch("https://world.openbeautyfacts.org", query, "OpenBeautyFacts", "cosmetic");
}

export async function searchOpenProductsFacts(query: string): Promise<ProductResult[]> {
  return runOpenFactsSearch("https://world.openproductsfacts.org", query, "OpenProductsFacts", "product");
}
