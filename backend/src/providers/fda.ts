export async function fetchFdaLabelMatches(ingredient: string): Promise<string[]> {
  const url = new URL("https://api.fda.gov/food/enforcement.json");
  url.searchParams.set("search", `product_description:${JSON.stringify(ingredient)}`);
  url.searchParams.set("limit", "3");

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    results?: Array<{ product_description?: string }>;
  };

  return (data.results ?? [])
    .map((entry) => entry.product_description)
    .filter((value): value is string => Boolean(value));
}
