# ClearAller Vision ML Pipeline

This folder contains the Python-backed ML pipeline for packed food and cosmetic ingredient allergen classification.
   
## Interpreter

The backend can use `ML_PYTHON_PATH` from `backend/.env`. On this machine a working fallback interpreter was found at:

`C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe`

## Flow

1. Build dataset from public product sources:
   `python ml/src/build_dataset.py`
2. Train model:
   `python ml/src/train_model.py`
3. Run local inference manually:
   `echo {"ingredients":["soy lecithin","parfum"]} | python ml/src/predict.py`

## Outputs

- `ml/data/training_dataset.jsonl`
- `ml/artifacts/allergen_model.json`
- `ml/artifacts/model_metadata.json`

## Notes

- The dataset builder focuses on packed foods and cosmetics.
- Labels are bootstrapped from external ingredient/product sources and the project knowledge base.
- The backend keeps a safe fallback classifier if the Python model is missing.
