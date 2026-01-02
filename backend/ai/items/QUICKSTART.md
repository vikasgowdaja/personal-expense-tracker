# Multi-Item Receipt Extraction - Quick Start

## What Changed?

Your expense tracker now extracts **each line item from a receipt as a separate expense**.

Instead of:
```
Receipt with 10 items → 1 expense record (total amount)
```

Now:
```
Receipt with 10 items → 10 expense records (individual items)
```

## Getting Started

### 1. Verify Installation

Test that all components are working:

```bash
cd backend
python ai/items/test_multi_item.py
```

Expected output:
```
✓ PASS: Item Detector
✓ PASS: Field Extraction
✓ PASS: Pipeline Config
✓ PASS: Pattern Matching
✓ PASS: Integration

Total: 5/5 tests passed ✓
```

### 2. Try Multi-Item Extraction

Test with a receipt image:

```bash
# Multi-item mode (default)
python ai/pipeline.py uploads/receipt.jpg

# Legacy single-record mode
python ai/pipeline.py uploads/receipt.jpg --single
```

### 3. Use in Frontend

Upload a multi-item receipt:

1. Open the app → Click "Upload Receipt Images"
2. Select a receipt with 5+ items
3. Upload and process
4. You'll see a **table with all items**
5. Edit as needed
6. Click "Save X Expense(s)" to save all items

## Key Features

✅ **Automatic Item Detection**  
Finds number of items without user input

✅ **Smart Field Extraction**  
- Item name
- Quantity 
- Unit price & total price
- Tax & discounts

✅ **Quality Scoring**  
Each item rated 0-100% (green/yellow/red)

✅ **Data Validation**  
Flags invalid data (missing prices, etc.)

✅ **ML Categorization**  
Auto-categorize each item

✅ **Bulk Save**  
All items saved in one click

✅ **User-Friendly UI**  
Table view with inline editing

## What You'll See

### Old UI (Single Item)
```
Title: Receipt          Amount: $730
Category: Food
Date: 01/02/2025
Description: [long text of all items]
[Save] [Cancel]
```

### New UI (Multi-Item)
```
📋 Review Extracted Expenses (10 to save)

| Item | Amount | Qty | Category | Date |
|------|--------|-----|----------|------|
| Margherita Pizza | 500 | 2 | Food | 01/02 |
| Coca Cola 2L | 120 | 1 | Drinks | 01/02 |
| Garlic Bread | 80 | 1 | Food | 01/02 |
| ... | ... | ... | ... | ... |

[Save 10 Expense(s)] [Cancel]
```

## How It Works Behind the Scenes

```
Receipt Image
    ↓ [Item Detection - finds 10 items]
    ↓ [OCR - reads all text]
    ↓ [Field Parsing - extracts name/price/qty per item]
    ↓ [Validation - checks quality]
    ↓ [ML - categorizes each item]
    ↓ 
10 Separate Expense Records
```

## Configuration

### Default Behavior (Multi-Item)
Automatically extracts individual items.

### Fallback to Single Item Mode
If detection fails or image is unclear:
```bash
python ai/pipeline.py receipt.jpg --single
```

Or in Python:
```python
pipeline = PFIEPipeline(config={"extract_mode": "single"})
```

## Supported Currencies

- ₹ (Indian Rupee)
- $ (Dollar)
- £ (Pound)
- € (Euro)

## Supported Formats

- JPG/JPEG
- PNG
- GIF

## Troubleshooting

### Q: Items not detecting?
**A:** Check receipt image quality. Clear photos with good lighting work best.

### Q: Wrong number of items?
**A:** Some receipt layouts are complex. Use single-mode or manual entry as fallback.

### Q: Missing prices?
**A:** Receipt might use uncommon currency format. Contact support.

### Q: Quality scores too low?
**A:** Receipt image too blurry or text too small. Retake photo.

## API Reference

### Upload Receipt
```
POST /api/ocr/upload
Returns: Array of items instead of single expense
```

### Save Expenses
```
POST /api/ocr/save
Body: { expenses: [...] }
Saves all items at once
```

## File Structure

```
backend/ai/items/
  ├── __init__.py              (module init)
  ├── item_detector.py         (finds line items)
  ├── item_extractor.py        (extracts fields)
  ├── test_multi_item.py       (run tests)
  ├── README.md                (detailed docs)
  └── MULTI_ITEM_EXTRACTION.md (technical docs)
```

## Performance

- Typical receipt (10 items): **2-5 seconds**
- Large receipt (20+ items): **5-10 seconds**
- Simple receipt (1 item): **1-2 seconds**

## Examples

### Input Receipt Image
```
PIZZA HUT
Date: 01/02/2025

1. Margherita Pizza (M)  x2  @₹250  = ₹500.00
2. Coca Cola 2L          x1  @₹120  = ₹120.00
3. Garlic Bread (6pc)    x1  @₹80   = ₹80.00
                      GST (5%):        ₹30.00
                           TOTAL:    ₹730.00
```

### Extracted Items
```
Item 1: Margherita Pizza (M)
  - Quantity: 2
  - Price: ₹500
  - Category: Food
  - Quality: 95%

Item 2: Coca Cola 2L
  - Quantity: 1
  - Price: ₹120
  - Category: Drinks
  - Quality: 88%

Item 3: Garlic Bread (6pc)
  - Quantity: 1
  - Price: ₹80
  - Category: Food
  - Quality: 92%
```

### Frontend Display
User sees a table with all 3 items, can edit each one, then saves all 3 as individual expenses.

## Environment Variables

```bash
# Python executable (if not in PATH)
export PYTHON=/usr/bin/python3

# AI mode (optional)
export AI_EXTRACT_MODE=multi_item  # or "single"
```

## Next Steps

1. **Test**: Run `python ai/items/test_multi_item.py`
2. **Try**: Upload a multi-item receipt
3. **Review**: Check extracted items in the table
4. **Save**: Click save to create individual expenses
5. **Explore**: Check the detailed docs for advanced features

## Full Documentation

- [README.md](README.md) - Complete feature overview
- [MULTI_ITEM_EXTRACTION.md](MULTI_ITEM_EXTRACTION.md) - Technical deep-dive
- [Code Comments](item_detector.py) - Inline documentation

## Support

- Check logs in browser console (F12)
- Test with `test_multi_item.py` script
- Verify receipt image quality
- Try manual entry if auto-extraction fails

---

**Ready to use!** Upload a receipt and experience multi-item extraction. 🚀
