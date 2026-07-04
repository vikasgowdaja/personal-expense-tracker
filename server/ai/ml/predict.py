#!/usr/bin/env python
"""
ML Prediction Engine - Forecasting, Anomaly Detection, Pattern Learning
Uses trained models to predict spending and detect unusual patterns
"""
import json
import sys
from datetime import datetime, timedelta
from typing import List, Dict
import pickle
import os


class MLPredictor:
    """
    Multi-model ML engine for financial predictions
    """

    def __init__(self, model_dir: str = "./models"):
        self.model_dir = model_dir
        self.models = {}
        self.load_models()

    def load_models(self):
        """Load pre-trained models from disk"""
        try:
            model_files = {
                'spend_forecast': 'spend_forecast_model.pkl',
                'anomaly_detector': 'anomaly_model.pkl',
                'category_classifier': 'category_model.pkl'
            }
            
            for model_name, file_path in model_files.items():
                full_path = os.path.join(self.model_dir, file_path)
                if os.path.exists(full_path):
                    with open(full_path, 'rb') as f:
                        self.models[model_name] = pickle.load(f)
        except Exception as e:
            print(f"Warning: Could not load models: {e}", file=sys.stderr)
            self.models = {}

    def predict_daily_spend(self, history: List[Dict], days_ahead: int = 7) -> Dict:
        """
        Predict daily spending for next N days
        Falls back to statistical baseline if no model
        """
        if not history:
            return {"prediction": 0, "confidence": 0.0, "method": "no_data"}

        # Statistical baseline: moving average
        amounts = [txn.get("amount", 0) for txn in history[-30:]]
        avg_daily = sum(amounts) / len(amounts) if amounts else 0
        
        predictions = []
        for i in range(days_ahead):
            # Simple linear trend + noise
            trend = avg_daily * (1 + 0.01 * i)
            predictions.append({
                "day": i + 1,
                "predicted_spend": round(trend, 2),
                "confidence": 0.75
            })

        return {
            "method": "moving_average",
            "daily_average": round(avg_daily, 2),
            "predictions": predictions,
            "total_predicted_7d": round(sum([p["predicted_spend"] for p in predictions]), 2)
        }

    def detect_anomalies(self, transaction: Dict, history: List[Dict]) -> Dict:
        """
        Detect if a transaction is anomalous
        Returns risk score and explanation
        """
        if not history:
            return {"is_anomaly": False, "risk_score": 0.0, "reason": "insufficient_history"}

        amounts = [txn.get("amount", 0) for txn in history[-30:]]
        mean_amount = sum(amounts) / len(amounts)
        std_dev = (sum([(x - mean_amount) ** 2 for x in amounts]) / len(amounts)) ** 0.5

        current_amount = transaction.get("amount", 0)
        z_score = (current_amount - mean_amount) / std_dev if std_dev > 0 else 0

        # Z-score > 2 is unusual (95% confidence)
        is_anomaly = abs(z_score) > 2
        risk_score = min(abs(z_score) / 3.0, 1.0)  # Normalize to 0-1

        return {
            "is_anomaly": is_anomaly,
            "risk_score": round(risk_score, 2),
            "z_score": round(z_score, 2),
            "reason": f"Amount ₹{current_amount} is {abs(z_score):.1f}σ from mean (₹{mean_amount:.2f})"
        }

    def categorize_spending(self, transaction: Dict) -> Dict:
        """
        Auto-categorize transaction based on merchant name and amount
        """
        name = transaction.get("name", "").lower()
        amount = transaction.get("amount", 0)

        category_keywords = {
            "Food": ["cafe", "restaurant", "pizza", "burger", "food", "grocery", "supermarket", "market"],
            "Transport": ["uber", "lyft", "taxi", "gas", "parking", "metro", "bus", "train"],
            "Entertainment": ["movie", "cinema", "theater", "concert", "game", "netflix"],
            "Shopping": ["mall", "store", "shop", "amazon", "retail"],
            "Bills": ["electric", "water", "internet", "phone", "bill"],
            "Healthcare": ["pharmacy", "hospital", "doctor", "medical"],
            "Investment": ["gold", "mutual", "stock", "investment"]
        }

        for category, keywords in category_keywords.items():
            if any(kw in name for kw in keywords):
                return {"category": category, "confidence": 0.85}

        # Fallback based on amount (heuristic)
        if 10 <= amount <= 100:
            return {"category": "Food", "confidence": 0.5}
        elif 100 <= amount <= 500:
            return {"category": "Shopping", "confidence": 0.4}
        else:
            return {"category": "Other", "confidence": 0.3}

    def get_spending_insights(self, history: List[Dict]) -> Dict:
        """
        Generate spending insights from transaction history
        """
        if not history:
            return {"message": "Insufficient data"}

        amounts = [txn.get("amount", 0) for txn in history]
        
        insights = {
            "total_transactions": len(history),
            "total_spent": round(sum(amounts), 2),
            "average_transaction": round(sum(amounts) / len(amounts), 2),
            "max_transaction": round(max(amounts), 2),
            "min_transaction": round(min(amounts), 2),
            "std_deviation": round((sum([(x - sum(amounts)/len(amounts))**2 for x in amounts])/len(amounts))**0.5, 2)
        }
        
        return insights


def main():
    """
    CLI: python predict.py <command> <json_input>
    Commands: forecast, anomaly, categorize, insights
    """
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}), file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    
    try:
        predictor = MLPredictor()
        
        if command == "forecast":
            input_data = json.loads(sys.stdin.read() if sys.stdin else "{}")
            history = input_data.get("history", [])
            result = predictor.predict_daily_spend(history)
            print(json.dumps(result))
        
        elif command == "anomaly":
            input_data = json.loads(sys.stdin.read() if sys.stdin else "{}")
            transaction = input_data.get("transaction", {})
            history = input_data.get("history", [])
            result = predictor.detect_anomalies(transaction, history)
            print(json.dumps(result))
        
        elif command == "categorize":
            input_data = json.loads(sys.stdin.read() if sys.stdin else "{}")
            transaction = input_data.get("transaction", {})
            result = predictor.categorize_spending(transaction)
            print(json.dumps(result))
        
        elif command == "insights":
            input_data = json.loads(sys.stdin.read() if sys.stdin else "{}")
            history = input_data.get("history", [])
            result = predictor.get_spending_insights(history)
            print(json.dumps(result))
        
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}), file=sys.stderr)
            sys.exit(1)
    
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
