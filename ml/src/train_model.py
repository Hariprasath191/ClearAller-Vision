from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
sys.path.insert(0, str(ROOT_DIR / ".pydeps"))
sys.path.insert(0, str(CURRENT_DIR))

from joblib import dump
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MultiLabelBinarizer

from config import PATHS

def load_rows(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
      for line in handle:
        line = line.strip()
        if line:
          rows.append(json.loads(line))
    return rows

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default=str(PATHS.dataset_file))
    parser.add_argument("--model", default=str(PATHS.model_file))
    parser.add_argument("--metadata", default=str(PATHS.metadata_file))
    args = parser.parse_args()

    rows = load_rows(Path(args.dataset))
    if not rows:
        raise SystemExit("Dataset is empty. Run build_dataset.py first.")

    X = [row["ingredient"] for row in rows]
    y_raw = [row["labels"] for row in rows]

    mlb = MultiLabelBinarizer()
    y = mlb.fit_transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42
    )

    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
            (
                "classifier",
                MultiOutputClassifier(
                    RandomForestClassifier(
                        n_estimators=200,
                        max_depth=20,
                        random_state=42,
                        n_jobs=-1
                    )
                )
            )
        ]
    )

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    report = classification_report(
        y_test,
        y_pred,
        target_names=list(mlb.classes_),
        zero_division=0,
        output_dict=True
    )

    Path(args.model).parent.mkdir(parents=True, exist_ok=True)
    dump(
        {
            "model": model,
            "classes": list(mlb.classes_),
            "binarizer": mlb
        },
        args.model
    )

    metadata = {
        "algorithm": "RandomForestClassifier",
        "dataset": args.dataset,
        "rows": len(rows),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "classes": list(mlb.classes_),
        "model_path": args.model,
        "macro_f1": report["macro avg"]["f1-score"],
        "weighted_f1": report["weighted avg"]["f1-score"]
    }

    with open(args.metadata, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)

    print(json.dumps(metadata, indent=2))

if __name__ == "__main__":
    main()