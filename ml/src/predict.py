from __future__ import annotations

import json
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
sys.path.insert(0, str(ROOT_DIR / ".pydeps"))
sys.path.insert(0, str(CURRENT_DIR))

from joblib import load

from config import PATHS

def main() -> None:
    raw = sys.argv[1] if len(sys.argv) > 1 else (sys.stdin.read() or "{}")
    payload = json.loads(raw)
    ingredients = payload.get("ingredients", [])
    model_path = Path(payload.get("model_path") or PATHS.model_file)

    if not model_path.exists():
        print(json.dumps({"signals": [], "status": "missing-model"}))
        return

    bundle = load(model_path)
    model = bundle["model"]
    classes: list[str] = bundle["classes"]

    predictions = model.predict(ingredients)
    probabilities = None

    classifier = model.named_steps["classifier"]
    vectorizer = model.named_steps["tfidf"]
    transformed = vectorizer.transform(ingredients)

    if hasattr(classifier, "estimators_"):
        probabilities = []
        for estimator in classifier.estimators_:
            if hasattr(estimator, "predict_proba"):
                probability_rows = estimator.predict_proba(transformed)
                if len(probability_rows.shape) == 2 and probability_rows.shape[1] > 1:
                    probabilities.append(probability_rows[:, 1])
                else:
                    probabilities.append(probability_rows[:, 0])
            else:
                probabilities.append(None)

    signals = []
    for row_index, ingredient in enumerate(ingredients):
        categories = [classes[index] for index, value in enumerate(predictions[row_index]) if value == 1]
        if not categories:
            continue

        confidence_values: list[float] = []
        if probabilities:
            for index, predicted in enumerate(predictions[row_index]):
                if predicted == 1 and probabilities[index] is not None:
                    confidence_values.append(float(probabilities[index][row_index]))

        confidence = round(max(confidence_values) if confidence_values else 0.75, 2)
        signals.append(
            {
                "ingredient": ingredient,
                "categories": categories,
                "confidence": confidence,
                "source": "classifier",
            }
        )

    print(json.dumps({"signals": signals, "status": "ok"}))

if __name__ == "__main__":
    main()
