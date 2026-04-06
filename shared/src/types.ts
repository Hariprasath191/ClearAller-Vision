export type AllergyCategory =
  | "dairy"
  | "peanuts"
  | "gluten"
  | "soy"
  | "eggs"
  | "shellfish"
  | "tree-nuts"
  | "sesame"
  | "fragrance"
  | "preservatives"
  | "colorants"
  | "sulfates"
  | "parabens";

export type SeverityLevel = "low" | "medium" | "high" | "critical";

export interface AllergySetting {
  category: AllergyCategory;
  severity: SeverityLevel;
}

export interface MedicalCondition {
  name: string;
  note?: string;
}

export interface AllergyProfileInput {
  name: string;
  age: number;
  allergySettings: AllergySetting[];
  medicalConditions?: MedicalCondition[];
}

export interface ExtractedIngredient {
  raw: string;
  normalized: string;
}

export interface EducationalExplanation {
  ingredient: string;
  source: string;
  description: string;
}

export interface RiskHit {
  ingredient: string;
  matchedName: string;
  categories: AllergyCategory[];
  probability: number;
  severity: SeverityLevel;
  explanation?: EducationalExplanation;
  detectedBy?: "rules" | "ml" | "hybrid";
}

export interface MlSignal {
  ingredient: string;
  categories: AllergyCategory[];
  confidence: number;
  source: "classifier";
}

export interface SafetyPrediction {
  profileId: string;
  profileName: string;
  rating: "Safe" | "Moderate Risk" | "High Risk";
  confidence: number;
  confidenceBand: "Low Evidence" | "Moderate Evidence" | "Strong Evidence";
  matchedAllergens: RiskHit[];
  safeIngredients: string[];
  unknownIngredients: string[];
  notes: string[];
  mlSignals?: MlSignal[];
}

export interface ProductResult {
  id: string;
  name: string;
  brand?: string;
  category: string;
  source: string;
  sourceSite?: string;
  availabilityCountries?: string[];
  imageUrl?: string;
  ingredientsText?: string;
  purchaseUrl?: string;
  reviewRating?: number;
  reviewCount?: number;
  popularityScore?: number;
}
