#!/usr/bin/env python
"""
Layout Understanding Module - Core AI for Financial Screenshot Analysis
Groups OCR output into structured transactions with rule-based + ML approach
"""
import json
import re
from typing import List, Dict, Tuple
from datetime import datetime


class LayoutAnalyzer:
    """
    Groups OCR output into meaningful transactions
    Extracts: name, amount, timestamp, transaction type
    """

    def __init__(self):
        # Rules for identifying field types
        self.amount_pattern = r'₹\s*(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s*(?:rs|rupee|paisa)?'
        self.time_pattern = r'(\d{1,2})[:/\-](\d{1,2})[:/\-](\d{2,4})|(\w{3})\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?'
        self.merchant_keywords = ['cafe', 'store', 'market', 'shop', 'restaurant', 'uber', 'grocery', 'mall', 'super']

    def extract_amounts(self, text: str) -> List[float]:
        """Extract all monetary amounts from text"""
        amounts = []
        matches = re.finditer(self.amount_pattern, text, re.IGNORECASE)
        for match in matches:
            try:
                amount_str = match.group(1) or match.group(2)
                amount = float(amount_str.replace(',', '').replace('.', '', amount_str.rfind('.')-2 if amount_str.rfind('.') != -1 else 0))
                amounts.append(amount)
            except:
                pass
        return amounts

    def extract_datetime(self, text: str) -> str:
        """Extract timestamp from text"""
        match = re.search(self.time_pattern, text, re.IGNORECASE)
        if match:
            return text[match.start():match.end()]
        return None

    def detect_merchant_type(self, text: str) -> str:
        """Detect if transaction is merchant, person, or investment"""
        text_lower = text.lower()
        
        if any(kw in text_lower for kw in self.merchant_keywords):
            return 'merchant'
        elif any(name in text_lower for name in ['transfer', 'sent', 'received', 'paid']):
            return 'person'
        elif any(inv in text_lower for inv in ['gold', 'investment', 'mutual', 'stock']):
            return 'investment'
        
        return 'transaction'

    def group_ocr_into_transactions(self, ocr_items: List[Dict]) -> List[Dict]:
        """
        Group OCR items into logical transactions
        
        Args:
            ocr_items: List from paddle_ocr.py with text, confidence, bbox
        
        Returns:
            List of structured transactions
        """
        if not ocr_items:
            return []

        transactions = []
        current_transaction = {
            "name": None,
            "amount": None,
            "timestamp": None,
            "type": None,
            "confidence": 0.0,
            "raw_texts": []
        }

        for item in ocr_items:
            text = item.get("text", "").strip()
            confidence = item.get("confidence", 0.0)

            if not text:
                continue

            # Try to extract amount
            amounts = self.extract_amounts(text)
            if amounts:
                current_transaction["amount"] = max(amounts)
                current_transaction["confidence"] = max(current_transaction["confidence"], confidence)

            # Try to extract timestamp
            time_str = self.extract_datetime(text)
            if time_str and not current_transaction["timestamp"]:
                current_transaction["timestamp"] = time_str

            # Store raw text
            current_transaction["raw_texts"].append(text)

            # If we have both name and amount, it's likely a complete transaction
            if current_transaction["amount"] and len(current_transaction["raw_texts"]) > 1:
                if not current_transaction["name"]:
                    # Use first non-numeric text as name
                    for t in current_transaction["raw_texts"]:
                        if not self.extract_amounts(t):
                            current_transaction["name"] = t
                            break

                if current_transaction["name"] and current_transaction["amount"]:
                    current_transaction["type"] = self.detect_merchant_type(current_transaction["name"])
                    transactions.append(current_transaction.copy())
                    current_transaction = {
                        "name": None,
                        "amount": None,
                        "timestamp": None,
                        "type": None,
                        "confidence": 0.0,
                        "raw_texts": []
                    }

        return transactions

    def normalize_transaction(self, txn: Dict) -> Dict:
        """
        Normalize transaction data
        - Clean amounts
        - Standardize timestamps
        - Fill missing fields
        """
        normalized = {
            "name": txn.get("name", "Unknown").strip(),
            "amount": float(txn.get("amount", 0.0)),
            "timestamp": txn.get("timestamp", datetime.now().isoformat()),
            "type": txn.get("type", "transaction"),
            "confidence": float(txn.get("confidence", 0.0)),
            "status": "pending_review" if float(txn.get("confidence", 0.0)) < 0.85 else "confirmed"
        }
        
        return normalized


def main():
    """
    CLI: python layout_model.py <json_ocr_output>
    Input: JSON from paddle_ocr.py
    Output: Structured transactions
    """
    import sys
    
    try:
        ocr_json = sys.stdin.read()
        ocr_data = json.loads(ocr_json)
        
        analyzer = LayoutAnalyzer()
        ocr_items = ocr_data.get("items", [])
        
        transactions = analyzer.group_ocr_into_transactions(ocr_items)
        normalized = [analyzer.normalize_transaction(txn) for txn in transactions]
        
        print(json.dumps({
            "success": True,
            "transactions": normalized,
            "total": len(normalized)
        }))
    
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
