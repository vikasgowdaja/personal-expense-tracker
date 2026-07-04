from __future__ import annotations

import io
import re
from datetime import datetime
from difflib import SequenceMatcher
from typing import List, Optional

import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageEnhance, ImageOps
from pydantic import BaseModel, Field

app = FastAPI(title="Finance Image Intelligence Service", version="1.0.0")


class Transaction(BaseModel):
    date: str
    amount: float = Field(ge=0)
    payee: str
    note: Optional[str] = None
    payment_method: str = "Other"
    app: Optional[str] = None
    bank: Optional[str] = None
    card_last4: Optional[str] = None
    transaction_id: Optional[str] = None
    category: str = "Uncategorised"
    confidence: float = Field(ge=0.0, le=1.0, default=0.7)


KNOWN_MERCHANTS = {
    "airtel": "Utilities",
    "job hai": "Job Portals",
    "connect2future": "Services",
    "swiggy": "Food",
    "zomato": "Food",
    "uber": "Transport",
    "ola": "Transport",
    "amazon": "Shopping",
    "flipkart": "Shopping",
}


def preprocess_image(raw_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    image = ImageOps.exif_transpose(image)

    # Improve readability before OCR.
    image = ImageEnhance.Contrast(image).enhance(1.5)
    width, height = image.size
    if width < 1200:
        ratio = 1200 / max(width, 1)
        image = image.resize((1200, int(height * ratio)))

    np_img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    thresholded = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        5,
    )
    return thresholded


def run_ocr(processed: np.ndarray) -> str:
    return pytesseract.image_to_string(processed, config="--oem 3 --psm 6", lang="eng")


def parse_date(text: str) -> str:
    patterns = [
        r"(\d{4}-\d{2}-\d{2})",
        r"(\d{2}/\d{2}/\d{4})",
        r"(\d{2}-\d{2}-\d{4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        value = match.group(1)
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                continue
    return datetime.utcnow().date().isoformat()


def extract_transactions_from_text(text: str) -> List[Transaction]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    transactions: List[Transaction] = []

    amount_pattern = re.compile(r"(?:INR|Rs\.?|₹)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)", re.IGNORECASE)
    upi_pattern = re.compile(r"(?:to|paid to|for)\s+([A-Za-z0-9 .&_-]{3,})", re.IGNORECASE)
    tid_pattern = re.compile(r"(?:txn|utr|ref|transaction)[\s:#-]*([A-Za-z0-9]{6,})", re.IGNORECASE)

    for line in lines:
        amount_match = amount_pattern.search(line)
        if not amount_match:
            continue

        amount = float(amount_match.group(1).replace(",", ""))
        payee_match = upi_pattern.search(line)
        payee = payee_match.group(1).strip() if payee_match else "Unknown"

        payment_method = "UPI" if "upi" in text.lower() else "Other"
        app = None
        for candidate in ("PhonePe", "GPay", "Paytm", "CRED", "Kiwi"):
            if candidate.lower() in text.lower():
                app = candidate
                break

        tid_match = tid_pattern.search(line)

        transactions.append(
            Transaction(
                date=parse_date(line + " " + text),
                amount=amount,
                payee=payee,
                note=line if len(line) < 120 else line[:117] + "...",
                payment_method=payment_method,
                app=app,
                transaction_id=tid_match.group(1) if tid_match else None,
                confidence=0.76 if payee_match else 0.64,
            )
        )

    if transactions:
        return transactions

    # Minimal fallback so user can review/edit when OCR is noisy.
    return [
        Transaction(
            date=datetime.utcnow().date().isoformat(),
            amount=0.0,
            payee="Needs manual review",
            note=text[:150] if text else None,
            payment_method="Other",
            confidence=0.35,
        )
    ]


def normalize_merchants(transactions: List[Transaction]) -> List[Transaction]:
    for txn in transactions:
        payee_key = txn.payee.lower()
        best_score = 0.0
        best_category = "Uncategorised"

        for merchant, category in KNOWN_MERCHANTS.items():
            score = SequenceMatcher(None, merchant, payee_key).ratio()
            if score > best_score:
                best_score = score
                best_category = category

        txn.category = best_category if best_score > 0.82 else "Uncategorised"
    return transactions


@app.post("/extract", response_model=List[Transaction])
async def extract(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    processed = preprocess_image(raw)
    text = run_ocr(processed)
    transactions = extract_transactions_from_text(text)
    normalized = normalize_merchants(transactions)

    return normalized


@app.get("/health")
def health():
    return {"status": "ok"}
