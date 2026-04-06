from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

CATEGORIES = [
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
    "parabens",
]

FOOD_SEARCH_TERMS = [
    "biscuits",
    "chips",
    "cereal",
    "cookies",
    "chocolate",
    "instant noodles",
    "sauce",
    "protein bar",
    "packaged snacks",
    "breakfast bar",
    "granola bar",
    "flavored yogurt",
    "ice cream",
    "infant formula",
    "peanut butter",
    "energy drink",
    "crackers",
    "bakery snack",
    "breakfast cereal",
    "flavored milk",
    "wafer biscuits",
    "protein shake",
    "cheese spread",
    "malted drink",
    "snack mix",
    "instant soup",
    "packaged dessert",
    "meal replacement bar",
]

COSMETIC_SEARCH_TERMS = [
    "shampoo",
    "conditioner",
    "face wash",
    "body lotion",
    "cleanser",
    "sunscreen",
    "lip balm",
    "moisturizer",
    "serum",
    "soap",
    "face cream",
    "body wash",
    "baby lotion",
    "hand cream",
    "deodorant",
    "hair mask",
    "facial toner",
    "makeup remover",
    "night cream",
    "anti dandruff shampoo",
    "baby shampoo",
    "face scrub",
    "body butter",
    "gel cleanser",
    "face moisturizer",
    "repair conditioner",
    "sheet mask",
    "foaming cleanser",
    "silicone serum",
    "hydrating serum",
    "gel moisturizer",
    "essence",
    "hair serum",
    "leave in conditioner",
    "styling cream",
    "foundation",
    "primer",
    "makeup base",
    "micellar water",
    "anti aging serum",
    "eye cream",
    "scar gel",
    "repair serum",
    "facial moisturizer",
    "hydrating lotion",
    "repair shampoo",
    "curl cream",
    "scalp serum",
]

CATEGORY_SIGNALS = {
    "dairy": ["milk", "casein", "whey", "lactose", "cream", "butter", "ghee", "cheese", "caseinate", "milk solids"],
    "peanuts": ["peanut", "groundnut", "arachis", "peanut flour", "peanut oil"],
    "gluten": ["wheat", "barley", "rye", "malt", "spelt", "semolina", "triticum", "farina", "bulgur"],
    "soy": ["soy", "soya", "lecithin", "edamame", "miso", "tamari", "tofu", "soy protein"],
    "eggs": ["egg", "albumin", "ovalbumin", "lysozyme", "albumen"],
    "shellfish": ["shrimp", "prawn", "crab", "lobster", "krill", "crustacean"],
    "tree-nuts": ["almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "argan", "brazil nut"],
    "sesame": ["sesame", "tahini", "gingelly", "sesamum indicum"],
    "fragrance": [
        "fragrance",
        "parfum",
        "linalool",
        "limonene",
        "citral",
        "geraniol",
        "hexyl cinnamal",
        "benzyl salicylate",
        "citronellol",
        "coumarin",
        "eugenol",
        "alpha isomethyl ionone",
    ],
    "preservatives": [
        "benzoate",
        "sorbate",
        "phenoxyethanol",
        "bha",
        "bht",
        "formaldehyde",
        "sodium benzoate",
        "chlorphenesin",
        "ethylhexylglycerin",
        "methylisothiazolinone",
        "methylchloroisothiazolinone",
        "benzyl alcohol",
        "dehydroacetic acid",
        "potassium sorbate",
    ],
    "colorants": ["lake", "dye", "pigment", "color", "ci ", "fd&c", "blue 1", "red 40", "yellow 5", "iron oxides"],
    "sulfates": ["sulfate", "sulphate", "sls", "sles", "sodium laureth sulfate", "ammonium lauryl sulfate", "sodium lauryl sulfate"],
    "parabens": ["paraben", "methylparaben", "propylparaben", "butylparaben", "ethylparaben"],
}

AUGMENT_SUFFIXES = {
    "dairy": [" powder", " protein", " extract", " solids"],
    "peanuts": [" oil", " flour", " butter", " protein"],
    "gluten": [" flour", " starch", " protein", " extract"],
    "soy": [" oil", " protein", " isolate", " extract"],
    "eggs": [" powder", " white", " yolk", " protein"],
    "shellfish": [" extract", " powder", " stock"],
    "tree-nuts": [" oil", " butter", " meal", " extract"],
    "sesame": [" oil", " seed", " extract", " paste"],
    "fragrance": [" extract", " blend", " oil"],
    "preservatives": [" sodium", " solution"],
    "colorants": [" lake", " dye"],
    "sulfates": [" sodium", " ammonium"],
    "parabens": [" sodium", " blend"],
}

AUGMENT_PREFIXES = {
    "dairy": ["skim ", "whole ", "hydrolyzed ", "cultured "],
    "peanuts": ["roasted ", "refined ", "defatted ", "ground "],
    "gluten": ["hydrolyzed ", "vital ", "refined ", "fortified "],
    "soy": ["hydrolyzed ", "fermented ", "organic ", "isolated "],
    "eggs": ["dried ", "pasteurized ", "liquid ", "free-range "],
    "shellfish": ["dried ", "marine ", "concentrated ", "seasoned "],
    "tree-nuts": ["roasted ", "organic ", "cold pressed ", "ground "],
    "sesame": ["toasted ", "hulled ", "organic ", "stone ground "],
    "fragrance": ["natural ", "botanical ", "blended ", "concentrated "],
    "preservatives": ["stabilized ", "buffered ", "food grade ", "cosmetic grade "],
    "colorants": ["certified ", "blended ", "synthetic ", "natural "],
    "sulfates": ["ammonium ", "sodium ", "stabilized ", "refined "],
    "parabens": ["buffered ", "cosmetic grade ", "stabilized ", "refined "],
}


@dataclass(frozen=True)
class Paths:
    root: Path
    src_dir: Path
    deps_dir: Path
    data_dir: Path
    artifacts_dir: Path
    dataset_file: Path
    model_file: Path
    metadata_file: Path


ROOT = Path(__file__).resolve().parents[1]
PATHS = Paths(
    root=ROOT,
    src_dir=ROOT / "src",
    deps_dir=ROOT / ".pydeps",
    data_dir=ROOT / "data",
    artifacts_dir=ROOT / "artifacts",
    dataset_file=ROOT / "data" / "training_dataset.jsonl",
    model_file=ROOT / "artifacts" / "random_forest_model.joblib",
    metadata_file=ROOT / "artifacts" / "random_forest_metadata.json",
)
