# Multi-Item Receipt Extraction System

## Overview

The Personal Expense Tracker now supports **line-by-line receipt extraction**. Instead of creating a single expense record from a receipt with 10 items, the system now detects, extracts, and creates separate records for each line item.

## System Architecture

```
Receipt Image
    ↓
[Item Detection] → Segment receipt into line item regions using contour detection
    ↓
[PaddleOCR] → Extract text from entire receipt with confidence scores
    ↓
[Field Extraction] → Parse item_name, quantity, unit_price, total_price, tax for each item
    ↓
[Validation] → Verify data quality, check for missing/invalid fields
    ↓
[ML Enrichment] → Categorize, detect anomalies, add insights
    ↓
[Multiple Expense Records] → Each item becomes a separate expense
```

## New Modules

### 1. **Item Detector** (`backend/ai/items/item_detector.py`)

Detects individual line items in receipt images using:
- **OpenCV Contour Detection**: Identifies horizontal lines (typical for receipts)
- **Morphological Operations**: Dilates and connects nearby regions
- **Region Merging**: Combines overlapping/adjacent regions into single items
- **Validation**: Filters by size, removes outliers

**Key Features:**
- Detects number of line items automatically
- Returns bounding boxes with confidence scores
- Handles merged/overlapping line items
- Validates region dimensions

**Usage:**
```python
from ai.items.item_detector import ItemDetector

detector = ItemDetector()
regions = detector.detect_item_regions("receipt.jpg")
# Returns: [{"x": 10, "y": 30, "width": 400, "height": 25, "confidence": 0.85}, ...]
```

### 2. **Item Field Extractor** (`backend/ai/items/item_extractor.py`)

Extracts structured fields from OCR text of individual items:

**Fields Extracted:**
- `item_name`: Product/service name
- `quantity`: Number of units
- `unit_price`: Per-unit cost
- `total_price`: Total cost for this item
- `tax`: Tax amount
- `discount`: Discount/reduction
- `quality_score`: Confidence in extraction (0-1)
- `flags`: Data quality warnings

**Patterns Recognized:**
- Multiple currency formats (₹, $, £, €, etc.)
- Quantity formats (Qty, qty, x, ×)
- Tax indicators (GST, VAT, TDS, Tax)
- Discounts and promotional deductions

**Usage:**
```python
from ai.items.item_extractor import ItemFieldExtractor

extractor = ItemFieldExtractor()
item = extractor.extract_fields("Margherita Pizza x2 @₹250.00 GST:₹45")
# Returns: {
#   "item_name": "Margherita Pizza",
#   "quantity": 2,
#   "unit_price": 250.0,
#   "total_price": 500.0,
#   "tax": 45.0,
#   "quality_score": 0.95,
#   ...
# }
```

## Updated Pipeline (`backend/ai/pipeline.py`)

**New Multi-Item Mode (`extract_mode="multi_item"`):**

```
1. Item Detection → Find line item regions
2. Full Receipt OCR → Extract all text with confidence
3. Region Grouping → Assign OCR results to item regions
4. Field Extraction → Parse structured data per item
5. Quality Filtering → Remove low-quality extractions
6. ML Enrichment → Categorize and add insights
7. Return Array → Multiple expense records
```

**Key Methods:**

- `detect_item_regions(image_path)` - Finds line items
- `extract_item_fields(item_texts)` - Parses fields
- `_group_ocr_to_items(ocr_items, regions)` - Maps OCR to items
- `_enrich_items(items, user_history)` - Adds ML features

**CLI Usage:**
```bash
# Multi-item mode (default)
python backend/ai/pipeline.py receipt.jpg

# Single-record legacy mode
python backend/ai/pipeline.py receipt.jpg --single

# With user history for ML context
python backend/ai/pipeline.py receipt.jpg --history history.json
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "item_name": "Margherita Pizza",
      "quantity": 2,
      "total_price": 500.0,
      "category": "Food",
      "quality_score": 0.95,
      "confidence": 0.92,
      "aiInsights": {
        "lineItem": true,
        "unitPrice": 250.0,
        "tax": 45.0,
        "categoryConfidence": 0.98
      }
    },
    {
      "item_name": "Coca Cola 2L",
      "quantity": 1,
      "total_price": 120.0,
      "category": "Food",
      "quality_score": 0.88,
      ...
    }
  ],
  "total_items": 2,
  "detection_regions": 2
}
```

## Backend API Updates

### POST `/api/ocr/upload`

Now returns **array of items** instead of single record:

**Request:**
```
POST /api/ocr/upload
Headers: x-auth-token: <token>
Body: FormData with receipt images
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 15 items from 1 receipt",
  "expenses": [
    {
      "title": "Item 1",
      "amount": 250.0,
      "category": "Food",
      "qualityScore": 0.95,
      "aiInsights": {
        "lineItem": true,
        "quantity": 2,
        "unitPrice": 125.0
      },
      "fileName": "receipt.jpg"
    },
    ...
  ]
}
```

### POST `/api/ocr/save`

Saves multiple expenses in single operation:

**Request:**
```json
{
  "expenses": [
    { "title": "Item 1", "amount": 250.0, ... },
    { "title": "Item 2", "amount": 120.0, ... }
  ]
}
```

Creates all records atomically; if any validation fails, can roll back.

## Frontend Updates

### UploadReceipt Component

#### New Features:

1. **Table View** - Compact display of all extracted items
   - Inline editing for item name, amount, category, date
   - Quality score badges (Good/Fair/Low)
   - Quantity column for line items
   - File origin tracking

2. **Details Panel** - Additional information per item
   - Unit price breakdown
   - Tax and discount display
   - Data quality flags
   - Confidence indicators

3. **Bulk Operations**
   - Mark multiple items for ignore
   - Handle duplicates in batch
   - Quick quantity adjustments
   - Smart recalculation of totals

4. **Data Validation UI**
   - Visual quality indicators
   - Warning badges for suspicious data
   - Flag highlighting (missing fields, invalid ranges)

#### Usage:

```javascript
// Component automatically detects multi-item mode
// and switches between card and table layouts

// Extract expenses from receipt
const response = await api.post('/api/ocr/upload', formData);
// Returns array of items

// Edit and save
const toSave = extractedExpenses.filter(e => !e.ignore);
await api.post('/api/ocr/save', { expenses: toSave });
```

## Example: Multi-Item Receipt Flow

### Input Receipt Image
```
          PIZZA HUT RECEIPT
Date: 01/02/2025  OrderID: 12345

Margherita Pizza (M)        x2 @₹250   ₹500.00
Coca Cola 2L                x1 @₹120   ₹120.00
Garlic Bread (6pc)          x1 @₹80    ₹80.00
                        GST (5%):      ₹30.00
                             TOTAL:   ₹730.00
```

### Extracted Items

| Item | Qty | Price | Category | Quality |
|------|-----|-------|----------|---------|
| Margherita Pizza (M) | 2 | ₹500 | Food | 95% |
| Coca Cola 2L | 1 | ₹120 | Food | 88% |
| Garlic Bread (6pc) | 1 | ₹80 | Food | 92% |

### Created Expenses (Frontend shows for review)

Each item displays:
- ✓ Extracted name & amount
- ✓ Detected category
- ✓ Quality assessment
- ✓ Edit capability before save
- ✓ Mark as ignore/duplicate option

## Quality Scores

Items are evaluated on:

| Criterion | Weight | Criteria |
|-----------|--------|----------|
| Item Name | 40% | Present and meaningful (>2 chars) |
| Price | 40% | Valid positive amount |
| Quantity | 15% | Valid number > 0 |
| Extras | 5% | Tax/discount captured |

**Thresholds:**
- **Green (Good)**: score > 70%
- **Yellow (Fair)**: score 40-70%
- **Red (Low)**: score < 40% (user warning)

## Error Handling

### Item Detection Fails
→ Falls back to full receipt extraction

### OCR Low Confidence
→ Flags item with warning, still returns item

### Field Extraction Issues
→ Shows specific flags (missing_price, tax_exceeds_total, etc.)

### Bulk Save Failure
→ Attempts individual save for each item
→ Reports which items failed

## Configuration

### Pipeline Config

```python
# Enable multi-item mode (default)
pipeline = PFIEPipeline(config={"extract_mode": "multi_item"})

# Use legacy single-record mode
pipeline = PFIEPipeline(config={"extract_mode": "single"})
```

### Item Detector Tuning

```python
detector = ItemDetector()
detector.min_item_height = 15  # pixels
detector.min_item_width = 50   # pixels
detector.line_overlap_threshold = 0.3  # merge threshold
```

### Field Extractor Patterns

Can be customized in `ItemFieldExtractor.__init__()`:
```python
self.price_pattern = r'(?:rs\.?|₹|\$|£|€)?\s*(\d+[,.]?\d*[.,]\d{2})\s*(?:rs\.?|₹|\$|£|€)?'
self.quantity_pattern = r'(?:qty|quantity|x|×)[\s:]*(\d+\.?\d*)'
```

## Testing

### Unit Tests

```bash
# Test item detection
python -m pytest backend/ai/items/test_item_detector.py

# Test field extraction
python -m pytest backend/ai/items/test_item_extractor.py
```

### Integration Test

```bash
# Process test receipt
python backend/ai/pipeline.py backend/ai/test_receipts/multi_item.jpg

# Verify output has multiple items
cat output.json | grep total_items
```

## Performance

- **Detection**: ~100-500ms per receipt (depends on image size)
- **OCR**: ~1-3s per receipt
- **Field Extraction**: ~50-100ms per item
- **Total**: ~2-5s for typical 10-item receipt

## Known Limitations

1. **Handwritten Receipts**: Works best with printed receipts
2. **Column Alignment**: Assumes items in columns (most receipts)
3. **Currency Recognition**: Works with major currencies (₹$£€)
4. **Multi-column Receipts**: May struggle with complex layouts
5. **Receipt Language**: English OCR; other languages need additional training

## Future Enhancements

- [ ] Deep Learning-based item detection (YOLO-based)
- [ ] Multi-language support
- [ ] Receipt layout understanding (header, items, total sections)
- [ ] Automated receipt reconciliation
- [ ] Receipt vendor recognition
- [ ] Barcode/SKU extraction
- [ ] Receipt image rotation correction

## Troubleshooting

### Items not detected
→ Check receipt lighting/quality
→ Try manual CSV import as fallback

### Wrong item counts
→ Check `min_item_height` and `min_item_width` settings
→ Receipt may have non-standard layout

### Missing prices
→ Currency format not recognized
→ Add custom pattern to `price_pattern`

### Low quality scores
→ Receipt image too blurry
→ Text too small
→ Check `quality_score` field for specific issues

## References

- [Item Detection Code](backend/ai/items/item_detector.py)
- [Field Extraction Code](backend/ai/items/item_extractor.py)
- [Pipeline Integration](backend/ai/pipeline.py)
- [API Routes](backend/routes/ocr.js)
- [Frontend Component](frontend/src/components/Expenses/UploadReceipt.js)
