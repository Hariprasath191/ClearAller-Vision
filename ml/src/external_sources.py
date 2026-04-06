from __future__ import annotations

from typing import Any

import requests

def search_products(base_url: str, query: str, page_size: int = 24, page_count: int = 4) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    seen_codes: set[str] = set()

    for page in range(1, page_count + 1):
        try:
            response = requests.get(
                f"{base_url.rstrip('/')}/cgi/search.pl",
                params={
                    "search_terms": query,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page_size": page_size,
                    "page": page,
                    "fields": "code,product_name,product_name_en,ingredients_text,ingredients_text_en,brands,image_front_url,image_url",
                },
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            page_products = payload.get("products", [])
            if not page_products:
                break

            new_in_page = 0
            for product in page_products:
                code = str(product.get("code") or "")
                if code and code in seen_codes:
                    continue
                if code:
                    seen_codes.add(code)
                products.append(product)
                new_in_page += 1

            if new_in_page == 0:
                break
        except requests.RequestException:
            continue

    return products

def search_fda_descriptions(query: str, limit: int = 12) -> list[str]:
    try:
        response = requests.get(
            "https://api.fda.gov/food/enforcement.json",
            params={
                "search": f'product_description:{query}',
                "limit": limit,
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        return [
            item.get("product_description", "")
            for item in payload.get("results", [])
            if item.get("product_description")
        ]
    except requests.RequestException:
        return []

def packed_food_products(query: str) -> list[dict[str, Any]]:
    return search_products("https://world.openfoodfacts.org", query)

def cosmetic_products(query: str) -> list[dict[str, Any]]:
    return search_products("https://world.openbeautyfacts.org", query)
