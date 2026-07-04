# Finance AI Service (FastAPI)

This service powers `/extract` for Finance Image Intelligence.

## Run locally

```bash
cd server/ai/finance_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

## Endpoint

`POST /extract`
- Input: `multipart/form-data` with image file under key `file`
- Output: JSON array of extracted transactions

## Environment variables

- `FINANCE_LLM_PROVIDER`: optional (`claude` or `gpt4o`) for future LLM integration
- `GOOGLE_APPLICATION_CREDENTIALS`: optional, enables Google Vision OCR if configured

## Notes

- Current implementation includes image preprocessing, OCR fallback, heuristic parsing, and merchant normalization.
- You can extend `extract_with_llm` in `main.py` for LangChain + Claude/GPT structured extraction.
