# PFIE Setup & Installation Guide

## Prerequisites

- Node.js 14+
- Python 3.8+
- pip (Python package manager)
- Windows/macOS/Linux

---

## Step 1: Install System Tesseract (Optional, for fallback OCR)

### Windows
1. Download installer: https://github.com/tesseract-ocr/tesseract/releases
2. Run installer, note installation path (default: `C:\Program Files\Tesseract-OCR`)
3. Add to PATH or set in .env: `TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe`

### macOS
```bash
brew install tesseract
```

### Linux
```bash
sudo apt-get install tesseract-ocr
```

---

## Step 2: Install Python AI Dependencies

```bash
cd d:\MERN\personal-expense-tracker\backend

# Create virtual environment (recommended)
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate

# Install packages
pip install --upgrade pip
pip install -r requirements_ai.txt
```

**Expected packages**:
- `paddleocr` - OCR engine
- `opencv-python` - Image processing
- `pytesseract` - Tesseract wrapper
- `pillow` - Image library
- `numpy` - Numerical computing
- `scikit-learn` - ML models
- `torch` - Deep learning (optional for LayoutLM)
- `transformers` - Pre-trained models

---

## Step 3: Initialize Database

```bash
# Create SQLite database with AI schema
sqlite3 data/expense_tracker.db < ai/db/schema.sql

# Or if sqlite3 not available, use Python:
python -c "
import sqlite3
conn = sqlite3.connect('data/expense_tracker.db')
with open('ai/db/schema.sql', 'r') as f:
    conn.executescript(f.read())
conn.commit()
print('Database initialized!')
"
```

---

## Step 4: Configure Environment

Create `.env` in `backend/` directory:

```bash
# Server
PORT=5000
MONGODB_URI=mongodb://localhost:27017/expense-tracker

# Python/AI
PYTHON=python3                    # or 'python' on Windows
PFIE_ENABLED=true
PFIE_CONFIDENCE_THRESHOLD=0.85

# Optional: Tesseract path (Windows)
# TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
```

---

## Step 5: Verify Installation

```bash
# Test PaddleOCR
python ai/ocr/paddle_ocr.py --help

# Test layout analysis (dummy test)
python -c "from ai.layout_ai.layout_model import LayoutAnalyzer; print('Layout AI OK')"

# Test ML pipeline
python -c "from ai.ml.predict import MLPredictor; print('ML Pipeline OK')"

# Test healing engine
python -c "from ai.healing.retrain import HealingEngine; print('Healing Engine OK')"
```

**Expected output**:
```
Layout AI OK
ML Pipeline OK
Healing Engine OK
```

---

## Step 6: Start the Application

### Terminal 1: Backend
```bash
cd backend
npm run dev
# Expected: "Server running on port 5000"
```

### Terminal 2: Frontend
```bash
cd frontend
npm start
# Expected: Browser opens to http://localhost:3000
```

---

## Step 7: Test PFIE with a Receipt Image

1. Go to http://localhost:3000 → Expenses → Upload Receipt
2. Select a financial screenshot (UPI, GPay, Paytm, etc.)
3. Click "Upload & Extract Data"

**Expected behavior**:
- Image processed with PaddleOCR
- Transaction data extracted
- Anomaly detection runs
- Spending forecast generated
- Results displayed for review

**Check logs**:
```bash
# Terminal with npm run dev should show:
[PFIE] Starting pipeline for /path/to/image.png
[PFIE] Step 1: Running PaddleOCR...
[PFIE] Step 2: Analyzing layout...
[PFIE] Step 3: Running ML on 1 transactions...
[PFIE] Step 4: Applying healing logic...
[PFIE] Pipeline complete!
```

---

## Troubleshooting

### Issue: "paddleocr not found"
```bash
pip install paddleocr
# If still fails, try:
pip install paddleocr --no-cache-dir
```

### Issue: "No module named 'cv2'"
```bash
pip install opencv-python
```

### Issue: Python not found by Node
**Solution 1**: Set PYTHON env var
```bash
# Windows PowerShell
$env:PYTHON="python"
npm run dev

# Windows CMD
set PYTHON=python
npm run dev

# macOS/Linux
export PYTHON=python3
npm run dev
```

**Solution 2**: Modify pipeline call in `backend/routes/ocr.js`
```javascript
const pythonCmd = 'C:\\Users\\YourName\\AppData\\Local\\Programs\\Python\\Python310\\python.exe';
// or
const pythonCmd = '/usr/bin/python3';
```

### Issue: PaddleOCR slow on first run
**Normal behavior**: PaddleOCR downloads ~200MB model on first run. Subsequent runs are fast (3-5s).

To pre-download models:
```bash
python -c "from paddleocr import PaddleOCR; ocr = PaddleOCR(); print('Models ready!')"
```

### Issue: "Confidence too low, transaction flagged"
The system is working! Low-confidence transactions are flagged for review. User can:
1. Edit the extracted data
2. Correct mistakes
3. System learns from corrections

---

## File Structure After Setup

```
d:\MERN\personal-expense-tracker\
├── backend/
│   ├── ai/
│   │   ├── ocr/
│   │   │   └── paddle_ocr.py         ✅ Ready
│   │   ├── layout_ai/
│   │   │   └── layout_model.py        ✅ Ready
│   │   ├── ml/
│   │   │   ├── predict.py             ✅ Ready
│   │   │   └── train.py               ✅ Ready (optional)
│   │   ├── healing/
│   │   │   └── retrain.py             ✅ Ready
│   │   ├── db/
│   │   │   └── schema.sql             ✅ Applied
│   │   ├── pipeline.py                ✅ Ready
│   │   └── README.md                  ✅ Guide
│   ├── routes/
│   │   └── ocr.js                     ✅ Updated
│   ├── utils/
│   │   └── ocrProcessor.js            ✅ Fallback
│   ├── requirements_ai.txt            ✅ Dependencies
│   ├── .env                           ✅ Config
│   ├── venv/                          ✅ Virtual env
│   └── server.js
├── frontend/
│   ├── src/
│   │   └── components/
│   │       └── Expenses/
│   │           └── UploadReceipt.js   ✅ Fixed
│   └── ...
└── data/
    └── expense_tracker.db            ✅ Created

Legend:
✅ = Implemented
🔧 = Optional
📝 = Configuration
```

---

## Performance Expectations

| Operation | Time | Status |
|-----------|------|--------|
| First PaddleOCR run | 30-60s | Downloads model |
| Subsequent OCR | 2-3s | Cached model |
| Layout analysis | <1s | Real-time |
| ML inference | <1s | Real-time |
| Healing check | <1s | Real-time |
| **Total per image** | **3-5s** | Comfortable |

---

## Production Deployment

### Recommended: Docker Container

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements_ai.txt .
RUN pip install --no-cache-dir -r requirements_ai.txt

# Copy backend
COPY backend/ .

# Set env
ENV PYTHON=python3
ENV PFIE_ENABLED=true

EXPOSE 5000
CMD ["npm", "run", "dev"]
```

**Build and run**:
```bash
docker build -t pfie-backend .
docker run -p 5000:5000 pfie-backend
```

---

## Next Steps

1. ✅ Upload first receipt → Verify pipeline works
2. 📊 Review extracted data → Check accuracy
3. 🔧 Adjust thresholds based on results
4. 📈 Collect correction data → Improve over time
5. 🚀 Deploy to production

---

## Support Resources

- **PaddleOCR Docs**: https://github.com/PaddlePaddle/PaddleOCR
- **OpenCV Tutorials**: https://docs.opencv.org/
- **scikit-learn Docs**: https://scikit-learn.org/
- **Node.js Child Process**: https://nodejs.org/api/child_process.html

---

**🎉 You're ready to use PFIE! Happy expense tracking!**
