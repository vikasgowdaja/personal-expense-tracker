#!/usr/bin/env python
"""
Unified PFIE Pipeline - Orchestrates all AI components end-to-end
Image → Item Detection → OCR per Item → Field Extraction → ML → Healing → Multi-Record Output
"""
import json
import sys
import subprocess
from typing import Dict, List
from pathlib import Path
import uuid
from datetime import datetime


class PFIEPipeline:
    """
    End-to-end Offline Personal Financial Intelligence Engine
    Coordinates Item Detection, OCR, Field Extraction, ML, and Healing
    Produces multiple transaction records from single receipt
    """

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.python_cmd = self.config.get("python_cmd", "python")
        self.ai_dir = Path(__file__).parent
        self.results = {}
        self.extract_mode = self.config.get("extract_mode", "multi_item")  # "multi_item" or "single"

    def run_paddle_ocr(self, image_path: str) -> Dict:
        """Step 1: Extract text with confidence using PaddleOCR"""
        try:
            result = subprocess.run(
                [self.python_cmd, str(self.ai_dir / "ocr" / "paddle_ocr.py"), image_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                return {"error": result.stderr, "success": False}
            
            return json.loads(result.stdout)
        
        except Exception as e:
            return {"error": str(e), "success": False}

    def detect_item_regions(self, image_path: str) -> Dict:
        """Step 1.5: Detect individual line item regions in receipt image"""
        try:
            result = subprocess.run(
                [self.python_cmd, str(self.ai_dir / "items" / "item_detector.py"), image_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                return {"error": result.stderr, "success": False}
            
            return json.loads(result.stdout)
        
        except Exception as e:
            return {"error": str(e), "success": False}

    def extract_item_fields(self, item_texts: List[str]) -> Dict:
        """Step 2.5: Extract structured fields from item OCR texts"""
        try:
            from ai.items.item_extractor import ItemFieldExtractor
            
            extractor = ItemFieldExtractor()
            results = []
            
            for text in item_texts:
                extracted = extractor.extract_fields(text)
                results.append(extracted)
            
            return {
                "success": True,
                "items": results,
                "total_items": len(results)
            }
        
        except Exception as e:
            return {"error": str(e), "success": False}

    def run_layout_analysis(self, ocr_output: Dict) -> Dict:
        """Step 2: Group OCR into structured transactions"""
        try:
            # Call layout model directly (Python import)
            from ai.layout_ai.layout_model import LayoutAnalyzer
            
            analyzer = LayoutAnalyzer()
            ocr_items = ocr_output.get("items", [])
            transactions = analyzer.group_ocr_into_transactions(ocr_items)
            normalized = [analyzer.normalize_transaction(txn) for txn in transactions]
            
            return {
                "success": True,
                "transactions": normalized,
                "total": len(normalized)
            }
        
        except Exception as e:
            return {"error": str(e), "success": False}

    def run_ml_pipeline(self, transactions: List[Dict], history: List[Dict] = None) -> List[Dict]:
        """Step 3: Run ML analysis on transactions"""
        try:
            from ai.ml.predict import MLPredictor
            
            predictor = MLPredictor()
            history = history or []
            
            enriched_transactions = []
            for txn in transactions:
                # Detect anomalies
                anomaly_result = predictor.detect_anomalies(txn, history)
                
                # Categorize
                category_result = predictor.categorize_spending(txn)
                
                # Enrich transaction
                enriched_txn = {
                    **txn,
                    "category": category_result.get("category"),
                    "category_confidence": category_result.get("confidence"),
                    "anomaly_detection": anomaly_result
                }
                
                enriched_transactions.append(enriched_txn)
            
            return enriched_transactions
        
        except Exception as e:
            print(f"ML Pipeline error: {e}", file=sys.stderr)
            return transactions

    def run_healing_check(self, transaction: Dict) -> Dict:
        """Step 4: Check and apply healing"""
        try:
            from ai.healing.retrain import HealingEngine
            
            healer = HealingEngine()
            confidence = transaction.get("confidence", 0.0)
            
            # Flag if low confidence
            is_flagged = healer.flag_low_confidence(transaction, confidence)
            
            # Apply any learned patterns
            learned_txn = healer.apply_learning(transaction)
            
            return {
                "is_flagged": is_flagged,
                "transaction": learned_txn,
                "health_score": healer._calculate_health_score()
            }
        
        except Exception as e:
            print(f"Healing engine error: {e}", file=sys.stderr)
            return {"is_flagged": False, "transaction": transaction}

    def process_image(self, image_path: str, user_history: List[Dict] = None) -> Dict:
        """
        Main pipeline: Process image end-to-end
        Returns array of line items extracted from receipt
        """
        user_history = user_history or []
        
        print(f"[PFIE] Starting {self.extract_mode} pipeline for {image_path}", file=sys.stderr)
        
        if self.extract_mode == "multi_item":
            return self._process_image_multi_item(image_path, user_history)
        else:
            return self._process_image_single_record(image_path, user_history)
    
    def _process_image_multi_item(self, image_path: str, user_history: List[Dict] = None) -> Dict:
        """
        Multi-item extraction: Detect items → OCR → Field extraction → Enrich → Output array
        """
        user_history = user_history or []
        
        try:
            # Step 1: Detect item regions
            print("[PFIE] Step 1: Detecting line items...", file=sys.stderr)
            detection_result = self.detect_item_regions(image_path)
            if not detection_result.get("success"):
                print(f"[PFIE] Item detection failed, falling back to full OCR", file=sys.stderr)
                regions = []
            else:
                regions = detection_result.get("regions", [])
                print(f"[PFIE] Detected {len(regions)} line items", file=sys.stderr)
            
            # Step 2: OCR entire receipt for global text context
            print("[PFIE] Step 2: Running PaddleOCR on full receipt...", file=sys.stderr)
            ocr_result = self.run_paddle_ocr(image_path)
            if not ocr_result.get("success", True) and ocr_result.get("error"):
                return {"success": False, "error": f"OCR failed: {ocr_result['error']}", "items": []}
            
            ocr_items = ocr_result.get("items", [])
            
            # Step 3: Group OCR results by detected regions
            print("[PFIE] Step 3: Grouping OCR results by item regions...", file=sys.stderr)
            item_texts = self._group_ocr_to_items(ocr_items, regions)
            print(f"[PFIE] Extracted text for {len(item_texts)} items", file=sys.stderr)
            
            # Step 4: Extract fields from each item
            print("[PFIE] Step 4: Extracting fields from each item...", file=sys.stderr)
            field_result = self.extract_item_fields(item_texts)
            if not field_result.get("success"):
                return {"success": False, "error": "Field extraction failed", "items": []}
            
            extracted_items = field_result.get("items", [])
            
            # Step 5: Filter low-quality items
            print("[PFIE] Step 5: Validating item quality...", file=sys.stderr)
            valid_items = [item for item in extracted_items if item.get("quality_score", 0) > 0.3]
            print(f"[PFIE] {len(valid_items)} items passed quality check", file=sys.stderr)
            
            # Step 6: Enrich with ML predictions
            print("[PFIE] Step 6: Running ML enrichment...", file=sys.stderr)
            enriched_items = self._enrich_items(valid_items, user_history)

            processed_at = datetime.now().isoformat()
            final_items = self._format_final_output(enriched_items, processed_at=processed_at)

            return {
                "success": True,
                "items": enriched_items,
                "final_items": final_items,
                "total_items": len(enriched_items),
                "detection_regions": len(regions),
                "ocr_data": ocr_result,
                "processed_at": processed_at
            }
        
        except Exception as e:
            import traceback
            print(f"[PFIE] Pipeline error: {e}\n{traceback.format_exc()}", file=sys.stderr)
            return {"success": False, "error": str(e), "items": []}
    
    def _process_image_single_record(self, image_path: str, user_history: List[Dict] = None) -> Dict:
        """
        Legacy mode: Single transaction extraction (old behavior)
        """
        user_history = user_history or []
        
        print(f"[PFIE] Starting single-record pipeline for {image_path}", file=sys.stderr)
        
        # Step 1: OCR
        print("[PFIE] Step 1: Running PaddleOCR...", file=sys.stderr)
        ocr_result = self.run_paddle_ocr(image_path)
        if not ocr_result.get("success", True) and ocr_result.get("error"):
            return {
                "success": False,
                "error": f"OCR failed: {ocr_result['error']}"
            }
        
        # Step 2: Layout Analysis
        print("[PFIE] Step 2: Analyzing layout...", file=sys.stderr)
        layout_result = self.run_layout_analysis(ocr_result)
        if not layout_result.get("success"):
            return {
                "success": False,
                "error": f"Layout analysis failed: {layout_result.get('error')}"
            }
        
        transactions = layout_result.get("transactions", [])
        
        # Step 3: ML Enrichment
        print(f"[PFIE] Step 3: Running ML on {len(transactions)} transactions...", file=sys.stderr)
        enriched = self.run_ml_pipeline(transactions, user_history)
        
        # Step 4: Healing
        print("[PFIE] Step 4: Applying healing logic...", file=sys.stderr)
        final_transactions = []
        for txn in enriched:
            healing_result = self.run_healing_check(txn)
            final_transactions.append({
                **healing_result["transaction"],
                "is_flagged": healing_result["is_flagged"],
                "system_health_score": healing_result.get("health_score", 0.0)
            })
        
        # Generate spending insights
        print("[PFIE] Generating insights...", file=sys.stderr)
        from ai.ml.predict import MLPredictor
        predictor = MLPredictor()
        
        all_history = user_history + final_transactions
        insights = predictor.get_spending_insights(all_history)
        forecast = predictor.predict_daily_spend(all_history)
        
        print("[PFIE] Pipeline complete!", file=sys.stderr)
        
        return {
            "success": True,
            "transactions": final_transactions,
            "final_items": self._format_final_output(final_transactions, processed_at=datetime.now().isoformat()),
            "total_transactions": len(final_transactions),
            "insights": insights,
            "forecast": forecast,
            "ocr_data": ocr_result,
            "processed_at": datetime.now().isoformat()
        }

    def _group_ocr_to_items(self, ocr_items: List[Dict], regions: List[Dict]) -> List[str]:
        """
        Group OCR text results by detected item regions
        Returns list of text strings, one per item
        """
        if not regions:
            # No regions detected, treat each OCR item as separate
            return [item.get("text", "") for item in ocr_items]
        
        item_texts = []
        
        for region in regions:
            x, y = region["x"], region["y"]
            w, h = region["width"], region["height"]
            region_right = x + w
            region_bottom = y + h
            
            # Find OCR items in this region
            region_text_parts = []
            for ocr_item in ocr_items:
                bbox = ocr_item.get("bbox", [])
                if not bbox:
                    continue
                
                # Get OCR item center
                ocr_x = (bbox[0][0] + bbox[2][0]) / 2
                ocr_y = (bbox[0][1] + bbox[2][1]) / 2
                
                # Check if OCR item is within region
                if x <= ocr_x <= region_right and y <= ocr_y <= region_bottom:
                    region_text_parts.append(ocr_item.get("text", ""))
            
            # Join text parts for this region
            item_text = " ".join(region_text_parts).strip()
            if item_text:
                item_texts.append(item_text)
        
        return item_texts if item_texts else [item.get("text", "") for item in ocr_items]
    
    def _enrich_items(self, items: List[Dict], user_history: List[Dict] = None) -> List[Dict]:
        """
        Enrich items with ML predictions and categorization
        """
        user_history = user_history or []
        enriched = []
        
        try:
            from ai.ml.predict import MLPredictor
            predictor = MLPredictor()
            
            for item in items:
                # Categorize
                category_result = predictor.categorize_spending(item.get("item_name", ""))
                
                # Detect anomalies
                anomaly_result = predictor.detect_anomalies(item, user_history)
                
                enriched_item = {
                    **item,
                    "category": category_result.get("category", "Other"),
                    "category_confidence": category_result.get("confidence", 0.0),
                    "anomaly_score": anomaly_result.get("anomaly_score", 0.0),
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now().isoformat()
                }
                
                enriched.append(enriched_item)
        
        except Exception as e:
            print(f"[PFIE] Enrichment error: {e}", file=sys.stderr)
            # Return items as-is if enrichment fails
            for item in items:
                item["id"] = str(uuid.uuid4())
                item["created_at"] = datetime.now().isoformat()
                enriched.append(item)
        
        return enriched

    def _format_final_output(self, items: List[Dict], processed_at: str = None) -> List[Dict]:
        """
        Normalize items into the final 4-field schema per transaction:
        {
          "logo": "...",
          "name": "...",
          "date_time": "YYYY-MM-DD hh:mm AM/PM",
          "amount_inr": 12345
        }
        """
        final = []

        def parse_amount(v):
            if v is None:
                return 0
            try:
                s = str(v)
                # remove currency symbols and whitespace
                s = s.replace('\u20b9', '').replace('₹', '')
                s = s.replace('$', '').replace('€', '').replace('£', '').replace('¥', '')
                # normalize commas (Indian grouping or thousands)
                s = s.replace(',', '')
                # keep digits and dot
                import re
                s = re.sub('[^0-9\.\-]', '', s)
                if s == '' or s == '-' or s == '.' or s == '-.':
                    return 0
                f = float(s)
                return int(round(f))
            except Exception:
                return 0

        def format_datetime(item):
            # Try a few common fields to build a datetime
            candidates = []
            if item.get('date_time'):
                candidates.append(str(item.get('date_time')))
            if item.get('date'):
                candidates.append(str(item.get('date')))
            if item.get('time'):
                candidates.append(str(item.get('time')))
            if item.get('created_at'):
                candidates.append(str(item.get('created_at')))
            if processed_at:
                candidates.append(processed_at)

            from datetime import datetime

            # helper to try parsing with multiple patterns
            patterns = [
                '%Y-%m-%dT%H:%M:%S.%f',
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d',
                '%d %b %Y %I:%M %p',
                '%d %b %I:%M %p',
                '%d %B %Y %I:%M %p',
                '%d %B %I:%M %p',
                '%d-%m-%Y %I:%M %p',
                '%d/%m/%Y %I:%M %p',
                '%d/%m/%Y',
                '%d-%m-%Y'
            ]

            for cand in candidates:
                if not cand:
                    continue
                # strip ordinal suffixes like 1st, 2nd
                import re
                c = re.sub(r'(\d)(st|nd|rd|th)\b', r'\1', cand)
                c = c.replace('\n', ' ').strip()
                # Try ISO formats first
                try:
                    dt = datetime.fromisoformat(c)
                    return dt.strftime('%Y-%m-%d %I:%M %p')
                except Exception:
                    pass

                for p in patterns:
                    try:
                        dt = datetime.strptime(c, p)
                        return dt.strftime('%Y-%m-%d %I:%M %p')
                    except Exception:
                        continue

            # fallback to current time
            return datetime.now().strftime('%Y-%m-%d %I:%M %p')

        def pick_logo(name, merchant=None):
            s = (name or '') + ' ' + (merchant or '')
            s = s.lower()
            if 'gold' in s:
                return 'gold'
            if 'axis' in s:
                return 'axis'
            if 'amazon' in s:
                return 'amazon'
            if 'flipkart' in s:
                return 'flipkart'
            # default: first word
            for token in s.split():
                if token.isalpha():
                    return token
            return 'merchant'

        for it in items:
            # Determine name
            name = it.get('item_name') or it.get('name') or it.get('title') or it.get('merchant') or 'item'
            # Some items include identifiers; normalize spacing
            name = str(name).strip()

            # Determine amount
            amount = None
            for k in ['total_price', 'amount', 'price', 'value', 'unit_price', 'cost']:
                if it.get(k) is not None:
                    amount = parse_amount(it.get(k))
                    break
            if amount is None:
                amount = parse_amount(it.get('price') if it.get('price') is not None else 0)

            # Build final record
            rec = {
                'logo': pick_logo(name, it.get('merchant')),
                'name': name,
                'date_time': format_datetime(it),
                'amount_inr': amount
            }
            final.append(rec)

        return final

    def save_results(self, results: Dict, output_path: str):
        """Save pipeline results to file"""
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)


def main():
    """
    CLI: python pipeline.py <image_path> [--history <json_history_path>] [--single]
    """

    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}), file=sys.stderr)
        sys.exit(2)

    image_path = sys.argv[1]
    history = []
    extract_mode = "multi_item"

    # Check for single-mode flag
    if "--single" in sys.argv:
        extract_mode = "single"

    # Load history if provided
    if "--history" in sys.argv:
        history_idx = sys.argv.index("--history")
        if history_idx + 1 < len(sys.argv):
            history_path = sys.argv[history_idx + 1]
            try:
                with open(history_path, 'r') as f:
                    history_data = json.load(f)
                    history = history_data.get("transactions", [])
            except:
                pass

    try:
        config = {"extract_mode": extract_mode}
        pipeline = PFIEPipeline(config=config)
        results = pipeline.process_image(image_path, history)
        print(json.dumps(results))
    
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
