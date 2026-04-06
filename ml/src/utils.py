from __future__ import annotations

import json
import re
from typing import Iterable

from config import CATEGORY_SIGNALS

STOP_PHRASES = (
    "contains",
    "may contain",
    "allergen",
    "allergens",
    "warning",
    "distributed by",
    "imported by",
    "nutrition",
)

def normalize_text(value: str) -> str:
    cleaned = value.lower()
    cleaned = re.sub(r"\([^)]*\)", " ", cleaned)
    cleaned = re.sub(r"\[[^]]*\]", " ", cleaned)
    cleaned = re.sub(r"\b\d+(?:\.\d+)?\s*(%|mg|mcg|g|kg|ml|l)\b", " ", cleaned)
    cleaned = re.sub(r"[^a-z0-9\s-]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def looks_like_ingredient(value: str) -> bool:
    if len(value) < 3 or len(value) > 80:
      return False
    if any(phrase in value for phrase in STOP_PHRASES):
      return False
    if len(value.split()) > 8:
      return False
    if re.search(r"\b(vitamin|mineral|daily value|serving|calorie)\b", value):
      return False
    return True

def split_ingredients(text: str) -> list[str]:
    if not text:
        return []

    candidates = [normalize_text(item) for item in re.split(r"[,.;\n]+", text)]
    return [part for part in candidates if part and looks_like_ingredient(part)]

def infer_labels(ingredient: str) -> list[str]:
    labels: list[str] = []
    for category, signals in CATEGORY_SIGNALS.items():
        if any(signal in ingredient for signal in signals):
            labels.append(category)
    return labels

def write_jsonl(path: str, rows: Iterable[dict]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")
