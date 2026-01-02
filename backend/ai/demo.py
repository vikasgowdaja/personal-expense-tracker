#!/usr/bin/env python
"""
PFIE Demo & Testing Script
Demonstrates all components working together
"""
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ai.ocr.paddle_ocr import FinancialOCR
from ai.layout_ai.layout_model import LayoutAnalyzer
from ai.ml.predict import MLPredictor
from ai.healing.retrain import HealingEngine


def demo_ocr():
    """Demonstrate OCR capabilities"""
    print("\n" + "="*60)
    print("🧠 PFIE Component Demo")
    print("="*60)
    
    print("\n1️⃣  OCR Engine Initialization")
    print("-" * 40)
    try:
        ocr = FinancialOCR(use_gpu=False)
        print("✅ PaddleOCR initialized successfully!")
        print("   - Ready to extract text from images")
        print("   - Supports: PNG, JPG, GIF, BMP")
        print("   - Confidence scores available")
    except Exception as e:
        print(f"⚠️  PaddleOCR not available: {e}")
        print("   Install with: pip install paddleocr")


def demo_layout():
    """Demonstrate layout analysis"""
    print("\n2️⃣  Layout Analysis Engine")
    print("-" * 40)
    
    analyzer = LayoutAnalyzer()
    
    # Mock OCR output
    mock_ocr = {
        "items": [
            {"text": "Jai Bhajarangi Super Market", "confidence": 0.96, "bbox": [[0,0],[100,50]]},
            {"text": "₹140.00", "confidence": 0.99, "bbox": [[200,10],[300,50]]},
            {"text": "31st dec 8:13 pm", "confidence": 0.93, "bbox": [[150,60],[300,80]]}
        ]
    }
    
    transactions = analyzer.group_ocr_into_transactions(mock_ocr["items"])
    print(f"✅ Grouped into {len(transactions)} transaction(s)")
    
    for i, txn in enumerate(transactions, 1):
        print(f"\n   Transaction {i}:")
        print(f"   • Name: {txn.get('name', 'N/A')}")
        print(f"   • Amount: ₹{txn.get('amount', 0)}")
        print(f"   • Type: {txn.get('type', 'unknown')}")
        print(f"   • Confidence: {txn.get('confidence', 0):.2%}")


def demo_ml():
    """Demonstrate ML capabilities"""
    print("\n3️⃣  ML Prediction Engine")
    print("-" * 40)
    
    predictor = MLPredictor()
    
    # Mock transaction history
    history = [
        {"amount": 100, "category": "Food"},
        {"amount": 150, "category": "Shopping"},
        {"amount": 75, "category": "Transport"},
        {"amount": 200, "category": "Food"},
        {"amount": 120, "category": "Shopping"}
    ]
    
    # Spend forecast
    forecast = predictor.predict_daily_spend(history, days_ahead=7)
    print("📊 7-Day Spend Forecast:")
    print(f"   • Daily average: ₹{forecast['daily_average']:.2f}")
    print(f"   • Total 7d prediction: ₹{forecast['total_predicted_7d']:.2f}")
    print(f"   • Confidence: {forecast['predictions'][0]['confidence']:.0%}")
    
    # Anomaly detection
    test_txn = {"amount": 500}
    anomaly = predictor.detect_anomalies(test_txn, history)
    print(f"\n🚨 Anomaly Detection:")
    print(f"   • Is anomaly: {anomaly['is_anomaly']}")
    print(f"   • Risk score: {anomaly['risk_score']:.2f}/1.0")
    print(f"   • Z-score: {anomaly['z_score']:.2f}σ")
    print(f"   • Reason: {anomaly['reason']}")
    
    # Categorization
    merchant_txn = {"name": "Starbucks Cafe", "amount": 250}
    category = predictor.categorize_spending(merchant_txn)
    print(f"\n🏷️  Category Classification:")
    print(f"   • Category: {category['category']}")
    print(f"   • Confidence: {category['confidence']:.0%}")
    
    # Insights
    insights = predictor.get_spending_insights(history)
    print(f"\n📈 Spending Insights:")
    print(f"   • Total transactions: {insights['total_transactions']}")
    print(f"   • Total spent: ₹{insights['total_spent']:.2f}")
    print(f"   • Average: ₹{insights['average_transaction']:.2f}")
    print(f"   • Max: ₹{insights['max_transaction']:.2f}")
    print(f"   • Min: ₹{insights['min_transaction']:.2f}")
    print(f"   • Std Dev: ₹{insights['std_deviation']:.2f}")


def demo_healing():
    """Demonstrate self-healing"""
    print("\n4️⃣  Self-Healing Engine")
    print("-" * 40)
    
    healer = HealingEngine()
    
    print("✅ Healing Engine initialized")
    print(f"   • Confidence threshold: {healer.confidence_threshold:.0%}")
    print(f"   • Current health score: {healer._calculate_health_score():.2f}/1.0")
    
    # Simulate a correction
    print("\n   Recording a correction...")
    original = {"name": "Jaia Bhajarang", "amount": 140}
    corrected = {"name": "Jai Bhajarangi Super Market", "amount": 140}
    healer.record_correction(original, corrected, "name")
    print("   ✅ Correction saved!")
    
    # Generate report
    report = healer.generate_healing_report()
    print(f"\n   Health Report:")
    print(f"   • Total corrections: {report['total_corrections']}")
    print(f"   • System health: {report['system_health']:.0%}")
    
    # Suggestions
    suggestions = healer.suggest_rule_adjustments()
    if suggestions:
        print(f"   • {len(suggestions)} improvement suggestions available")


def main():
    """Run all demos"""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 58 + "║")
    print("║" + "  🧠 PFIE (Offline Personal Financial Intelligence) 🧠  ".center(58) + "║")
    print("║" + "          Complete AI System Demonstration             ".center(58) + "║")
    print("║" + " " * 58 + "║")
    print("╚" + "=" * 58 + "╝")
    
    # Run demos
    demo_ocr()
    demo_layout()
    demo_ml()
    demo_healing()
    
    # Summary
    print("\n" + "="*60)
    print("✅ PFIE System Demo Complete!")
    print("="*60)
    print("\nNext Steps:")
    print("1. Install dependencies: pip install -r requirements_ai.txt")
    print("2. Initialize database: sqlite3 db/expense_tracker.db < ai/db/schema.sql")
    print("3. Start backend: npm run dev")
    print("4. Upload a receipt screenshot!")
    print("\nDocumentation:")
    print("• Setup Guide: ai/SETUP.md")
    print("• Full Docs: ai/README.md")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
