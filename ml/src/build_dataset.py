from __future__ import annotations

import argparse
import json
import sys

from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
sys.path.insert(0, str(ROOT_DIR / ".pydeps"))
sys.path.insert(0, str(CURRENT_DIR))

from config import AUGMENT_PREFIXES, AUGMENT_SUFFIXES, CATEGORY_SIGNALS, COSMETIC_SEARCH_TERMS, FOOD_SEARCH_TERMS, PATHS
from external_sources import cosmetic_products, packed_food_products, search_fda_descriptions
from utils import write_jsonl, split_ingredients, infer_labels


def ingredient_rows_from_products(products: list[dict], source: str, query: str) -> list[dict]:
    rows: list[dict] = []
    for product in products:
        ingredient_text = product.get("ingredients_text_en") or product.get("ingredients_text") or ""
        for ingredient in split_ingredients(ingredient_text):
            labels = infer_labels(ingredient)
            if not labels:
                continue
            rows.append({
                "ingredient": ingredient,
                "labels": labels,
                "source": source,
                "query": query,
                "product_name": product.get("product_name") or product.get("product_name_en") or "unknown"
            })
    return rows

def ingredient_rows_from_fda() -> list[dict]:
    rows: list[dict] = []
    for category, signals in CATEGORY_SIGNALS.items():
        for signal in signals[:3]:
            for description in search_fda_descriptions(signal):
                for ingredient in split_ingredients(description):
                    labels = infer_labels(ingredient)
                    if not labels:
                        continue
                    rows.append({
                        "ingredient": ingredient,
                        "labels": labels,
                        "source": "FDA",
                        "query": signal,
                        "product_name": description[:80]
                    })
    return rows

def seed_rows() -> list[dict]:
    rows: list[dict] = []
    for category, signals in CATEGORY_SIGNALS.items():
        for ingredient in signals:
            rows.append({"ingredient": ingredient, "labels": [category], "source": "SeedSignals", "query": category, "product_name": "seed"})
    return rows

def augmented_rows(rows: list[dict]) -> list[dict]:
    generated: list[dict] = []
    for row in rows:
        ingredient = row["ingredient"]
        labels = row["labels"]
        for label in labels:
            for prefix in AUGMENT_PREFIXES.get(label, []):
                generated.append({
                    "ingredient": f"{prefix}{ingredient}".strip(),
                    "labels": labels,
                    "source": "Augmented",
                    "query": row["query"],
                    "product_name": row["product_name"],
                })
            for suffix in AUGMENT_SUFFIXES.get(label, []):
                generated.append({
                    "ingredient": f"{ingredient}{suffix}".strip(),
                    "labels": labels,
                    "source": "Augmented",
                    "query": row["query"],
                    "product_name": row["product_name"],
                })
            if " " in ingredient:
                generated.append({
                    "ingredient": ingredient.replace(" ", "-"),
                    "labels": labels,
                    "source": "Augmented",
                    "query": row["query"],
                    "product_name": row["product_name"],
                })
                generated.append({
                    "ingredient": ingredient.replace(" ", ""),
                    "labels": labels,
                    "source": "Augmented",
                    "query": row["query"],
                    "product_name": row["product_name"],
                })
                parts = ingredient.split()
                if len(parts) == 2:
                    generated.append({
                        "ingredient": f"{parts[1]} {parts[0]}",
                        "labels": labels,
                        "source": "Augmented",
                        "query": row["query"],
                        "product_name": row["product_name"],
                    })
    return generated


def dedupe_rows(rows: list[dict]) -> list[dict]:
    merged: dict[str, set[str]] = {}
    source_meta: dict[str, dict] = {}
    for row in rows:
        ingredient = row["ingredient"]
        merged.setdefault(ingredient, set()).update(row["labels"])
        source_meta.setdefault(ingredient, {"source": row["source"], "query": row["query"], "product_name": row["product_name"]})

    output = []
    for ingredient, labels in merged.items():
        output.append({"ingredient": ingredient, "labels": sorted(labels), **source_meta[ingredient]})
    return sorted(output, key=lambda item: item["ingredient"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(PATHS.dataset_file))
    args = parser.parse_args()

    PATHS.data_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = seed_rows()

    for query in FOOD_SEARCH_TERMS:
        rows.extend(ingredient_rows_from_products(packed_food_products(query), "OpenFoodFacts", query))

    for query in COSMETIC_SEARCH_TERMS:
        rows.extend(ingredient_rows_from_products(cosmetic_products(query), "OpenBeautyFacts", query))

    rows.extend(ingredient_rows_from_fda())
    rows.extend(augmented_rows(rows))

    deduped = dedupe_rows(rows)
    write_jsonl(args.output, deduped)
    print(json.dumps({"dataset": args.output, "rows": len(deduped)}, indent=2))


if __name__ == "__main__":
    main()
