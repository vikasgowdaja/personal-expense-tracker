#!/usr/bin/env python
"""
Item Field Extractor
Extracts and validates structured fields from individual receipt line items
Handles: item_name, quantity, unit_price, total_price, tax
"""
import json
import re
import sys
from typing import Dict, List, Optional
import numpy as np


class ItemFieldExtractor:
    """
    Extracts structured fields from OCR text of individual line items
    """
    
    def __init__(self):
        # Patterns for field detection
        # Accept integers and decimals, allow common currency symbols (₹,$,£,€,¥)
        self.price_pattern = r'(?:rs\.?|₹|\$|£|€|¥)?\s*(\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)'
        self.quantity_pattern = r'(?:qty|quantity|qty\.|quantity\.|x|×)[\s:]*(\d+\.?\d*)'
        self.tax_pattern = r'(?:tax|gst|vat|tds)[\s:]*(?:rs\.?|₹|\$|£|€|¥)?\s*(\d+[,.]?\d*[.,]?\d*)'
        self.discount_pattern = r'(?:discount|disc|off)[\s:]*(?:rs\.?|₹|\$|£|€|¥)?\s*(\d+[,.]?\d*[.,]?\d*)'
    
    def extract_fields(self, item_text: str) -> Dict:
        """
        Extract all fields from OCR text of a single line item
        Returns structured dict with parsed fields and confidence
        """
        item_text = item_text.strip()
        
        if not item_text:
            return self._create_empty_result()
        
        result = {
            "raw_text": item_text,
            "item_name": None,
            "quantity": 1,
            "unit_price": None,
            "total_price": None,
            "tax": None,
            "discount": None,
            "confidence": 0.0,
            "quality_score": 0.0,
            "flags": []
        }
        
        # Extract prices (can have multiple)
        prices = self._extract_prices(item_text)
        if prices:
            result["total_price"] = prices[-1]  # Last price is usually total
            if len(prices) > 1:
                result["unit_price"] = prices[0]
        
        # Extract quantity
        qty = self._extract_quantity(item_text)
        if qty:
            result["quantity"] = qty
        
        # Extract tax
        tax = self._extract_tax(item_text)
        if tax:
            result["tax"] = tax
        
        # Extract discount
        discount = self._extract_discount(item_text)
        if discount:
            result["discount"] = discount
        
        # Extract item name (remaining text after removing prices/qty/tax)
        item_name = self._extract_item_name(item_text, prices, qty, tax, discount)
        result["item_name"] = item_name
        
        # Calculate confidence and quality
        result["confidence"] = self._calculate_confidence(result)
        result["quality_score"] = self._calculate_quality_score(result)
        
        # Validate and flag issues
        self._validate_and_flag(result)
        
        return result
    
    def _extract_prices(self, text: str) -> List[float]:
        """Extract all prices from text"""
        prices = []
        matches = re.findall(self.price_pattern, text, re.IGNORECASE)

        for match in matches:
            try:
                price_str = match
                # Remove spaces
                price_str = price_str.replace(' ', '')
                # If both dot and comma present, assume commas are thousand separators
                if '.' in price_str and ',' in price_str:
                    price_str = price_str.replace(',', '')
                # If only comma present, assume comma is decimal separator
                elif ',' in price_str and '.' not in price_str:
                    price_str = price_str.replace(',', '.')
                # Remove any remaining grouping commas
                price_str = price_str.replace(',', '')
                price = float(price_str)
                if 0 < price < 10000000:  # Reasonable upper bound
                    prices.append(price)
            except Exception:
                continue
        
        return prices
    
    def _extract_quantity(self, text: str) -> Optional[float]:
        """Extract quantity value"""
        match = re.search(self.quantity_pattern, text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        return None
    
    def _extract_tax(self, text: str) -> Optional[float]:
        """Extract tax amount"""
        match = re.search(self.tax_pattern, text, re.IGNORECASE)
        if match:
            try:
                tax_str = match.group(1).replace(',', '.')
                return float(tax_str)
            except ValueError:
                pass
        return None
    
    def _extract_discount(self, text: str) -> Optional[float]:
        """Extract discount amount"""
        match = re.search(self.discount_pattern, text, re.IGNORECASE)
        if match:
            try:
                disc_str = match.group(1).replace(',', '.')
                return float(disc_str)
            except ValueError:
                pass
        return None
    
    def _extract_item_name(self, text: str, prices: List[float], qty: Optional[float], 
                          tax: Optional[float], discount: Optional[float]) -> str:
        """
        Extract item name by removing numbers, prices, and special tokens
        Improved to handle OCR noise, timestamps, and artifacts
        """
        # Reject if text looks like timestamp or artifacts
        if re.match(r'^\d{1,2}:\d{2}', text):  # Timestamp pattern (HH:MM)
            return "Item"
        
        # Remove timestamps embedded in text (e.g., "8:37 * R1 37)")
        cleaned = re.sub(r'\d{1,2}:\d{2}(:\d{2})?\s*[*×-]?\s*', '', text)
        
        # Remove prices with all formats
        cleaned = re.sub(r'(?:rs\.?|₹|\$|£|€)\s*\d+[,.]?\d*[.,]?\d*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\d+[,.]?\d*[.,]?\d*\s*(?:rs\.?|₹|\$|£|€)', '', cleaned, flags=re.IGNORECASE)
        
        # Remove quantity patterns
        if qty:
            cleaned = re.sub(self.quantity_pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Remove tax/discount patterns
        cleaned = re.sub(self.tax_pattern, '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(self.discount_pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Remove currency symbols and special transaction markers
        cleaned = re.sub(r'[£€₹$¥₽₩₪₨₦₱₡₵₴₸]', '', cleaned)
        cleaned = re.sub(r'[*×÷™©®%‰º•·»]', '', cleaned)
        
        # Remove common OCR artifacts and special chars (keep alphanumeric, spaces, hyphens)
        cleaned = re.sub(r'[^\w\s\-&()]', '', cleaned)
        
        # Clean up multiple spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        # Remove leading/trailing parentheses and numbers
        cleaned = re.sub(r'^[\s()\d]+', '', cleaned)
        cleaned = re.sub(r'[\s()]+$', '', cleaned)
        cleaned = cleaned.strip()
        
        # Filter out pure numbers or artifacts like "37)" or "500 *"
        if not cleaned or re.match(r'^[\d\s()]+$', cleaned):
            return "Item"
        
        return cleaned if cleaned and len(cleaned) > 1 else "Item"
    
    def _calculate_confidence(self, result: Dict) -> float:
        """Calculate overall confidence in extraction"""
        confidence = 0.5  # Base
        
        if result["item_name"] and len(result["item_name"]) > 2:
            confidence += 0.2
        if result["total_price"]:
            confidence += 0.2
        if result["quantity"] > 0:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _calculate_quality_score(self, result: Dict) -> float:
        """
        Calculate data quality score (0-1)
        Based on completeness and plausibility
        """
        score = 0.0
        max_score = 0.0

        # Penalize if flags detected
        penalty = 0.0
        if "artifact_item_name" in result.get("flags", []):
            penalty += 0.5
        if "default_item_name" in result.get("flags", []):
            penalty += 0.3
        if "missing_item_name" in result.get("flags", []):
            penalty += 0.4

        # Item name (very important)
        max_score += 0.4
        if result.get("item_name") and len(result.get("item_name")) > 2 and result.get("item_name") != "Item":
            score += 0.4
        elif result.get("item_name") and result.get("item_name") != "Item":
            score += 0.2

        # Price (very important)
        max_score += 0.4
        if result.get("total_price") and result.get("total_price") > 0:
            score += 0.4

        # Quantity (important)
        max_score += 0.15
        if result.get("quantity") and result.get("quantity") > 0:
            score += 0.15

        # Tax/Discount (nice to have)
        max_score += 0.05
        if result.get("tax") is not None or result.get("discount") is not None:
            score += 0.05

        # Calculate base quality score
        base_score = score / max_score if max_score > 0 else 0.0

        # Apply penalties
        final_score = max(0.0, base_score - penalty)

        return final_score
    
    def _validate_and_flag(self, result: Dict):
        """Validate data and add flags for suspicious entries"""
        # Check for timestamp/artifact patterns in item name
        if result.get("item_name") and re.match(r'^[\d\s:*×()]+$', result.get("item_name")):
            result.setdefault("flags", []).append("artifact_item_name")

        if result.get("item_name") == "Item":
            result.setdefault("flags", []).append("default_item_name")

        # Missing critical fields
        if not result.get("item_name") or len(str(result.get("item_name"))) <= 2:
            result.setdefault("flags", []).append("missing_item_name")

        if not result.get("total_price"):
            result.setdefault("flags", []).append("missing_price")

        # Price validation
        if result.get("total_price") and result.get("total_price") < 0.01:
            result.setdefault("flags", []).append("price_too_low")

        if result.get("total_price") and result.get("total_price") > 100000:
            result.setdefault("flags", []).append("price_too_high")

        # Quantity validation
        if result.get("quantity") and result.get("quantity") < 0:
            result.setdefault("flags", []).append("invalid_quantity")

        # Unit price check
        if result.get("unit_price") and result.get("total_price"):
            if result.get("unit_price") > result.get("total_price"):
                result.setdefault("flags", []).append("unit_price_exceeds_total")

        # Tax validation
        if result.get("tax") and result.get("total_price"):
            if result.get("tax") > result.get("total_price"):
                result.setdefault("flags", []).append("tax_exceeds_total")
    
    def _create_empty_result(self) -> Dict:
        """Create empty/default result"""
        return {
            "raw_text": "",
            "item_name": None,
            "quantity": 1,
            "unit_price": None,
            "total_price": None,
            "tax": None,
            "discount": None,
            "confidence": 0.0,
            "quality_score": 0.0,
            "flags": ["empty_input"]
        }
    
    def extract_batch(self, item_texts: List[str]) -> List[Dict]:
        """Extract fields from multiple items"""
        return [self.extract_fields(text) for text in item_texts]


def main():
    """
    CLI: python item_extractor.py --text "item text" or stdin
    """
    if "--text" in sys.argv:
        idx = sys.argv.index("--text")
        if idx + 1 < len(sys.argv):
            text = sys.argv[idx + 1]
            extractor = ItemFieldExtractor()
            result = extractor.extract_fields(text)
            print(json.dumps(result))
        else:
            print(json.dumps({"error": "No text provided"}), file=sys.stderr)
    else:
        # Read from stdin
        data = json.loads(sys.stdin.read())
        texts = data.get("texts", [])
        extractor = ItemFieldExtractor()
        results = extractor.extract_batch(texts)
        print(json.dumps({"results": results}))


if __name__ == '__main__':
    main()
