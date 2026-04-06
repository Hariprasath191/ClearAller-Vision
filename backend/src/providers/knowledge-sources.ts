import { load } from "cheerio";
import type { EducationalExplanation } from "@clearaller/shared";

export async function fetchPubChemExplanation(ingredient: string): Promise<EducationalExplanation | null> {
  const url = new URL(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(ingredient)}/description/JSON`);
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    InformationList?: {
      Information?: Array<{
        Title?: string;
        Description?: string;
      }>;
    };
  };

  const info = data.InformationList?.Information?.[0];
  if (!info?.Description) {
    return null;
  }

  return {
    ingredient,
    source: "PubChem",
    description: info.Description
  };
}

export async function fetchInciExplanation(ingredient: string): Promise<EducationalExplanation | null> {
  const url = `https://incidecoder.com/search/product?query=${encodeURIComponent(ingredient)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const $ = load(html);
  const description = $(".content .fs14").first().text().trim();

  if (!description) {
    return null;
  }

  return {
    ingredient,
    source: "INCI Decoder",
    description
  };
}
