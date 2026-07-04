#!/usr/bin/env python
"""
Self-Healing Engine - Auto-improvement when confidence is low
Monitors OCR/model outputs and retrains on failures
"""
import json
import sys
import os
from datetime import datetime
from typing import List, Dict


class HealingEngine:
    """
    Monitors transaction extraction quality
    Flags low-confidence samples for retraining
    Auto-adjusts rules based on correction patterns
    """

    def __init__(self, healing_db_path: str = "./healing_logs.json"):
        self.healing_db_path = healing_db_path
        self.healing_log = self.load_healing_log()
        self.confidence_threshold = 0.85

    def load_healing_log(self) -> Dict:
        """Load existing healing logs"""
        if os.path.exists(self.healing_db_path):
            try:
                with open(self.healing_db_path, 'r') as f:
                    return json.load(f)
            except:
                return {"corrections": [], "patterns": {}, "stats": {}}
        return {"corrections": [], "patterns": {}, "stats": {}}

    def save_healing_log(self):
        """Save healing logs to disk"""
        with open(self.healing_db_path, 'w') as f:
            json.dump(self.healing_log, f, indent=2)

    def flag_low_confidence(self, transaction: Dict, confidence: float) -> bool:
        """
        Flag transactions with low confidence for review
        Returns True if flagged
        """
        if confidence < self.confidence_threshold:
            flag = {
                "timestamp": datetime.now().isoformat(),
                "transaction": transaction,
                "confidence": confidence,
                "status": "pending_review"
            }
            # This would typically be sent to a human review queue
            return True
        return False

    def record_correction(self, original: Dict, corrected: Dict, correction_type: str):
        """
        Record when a user corrects an extraction
        Learns from corrections to improve rules
        """
        correction = {
            "timestamp": datetime.now().isoformat(),
            "original": original,
            "corrected": corrected,
            "type": correction_type,
            "applied": False
        }
        
        self.healing_log["corrections"].append(correction)
        self._update_patterns(original, corrected, correction_type)
        self.save_healing_log()

    def _update_patterns(self, original: Dict, corrected: Dict, corr_type: str):
        """
        Extract patterns from corrections
        Example: If name is often misspelled, adjust OCR thresholds
        """
        if corr_type not in self.healing_log["patterns"]:
            self.healing_log["patterns"][corr_type] = []

        pattern = {
            "original_name": original.get("name"),
            "corrected_name": corrected.get("name"),
            "original_amount": original.get("amount"),
            "corrected_amount": corrected.get("amount"),
            "frequency": 1
        }
        
        self.healing_log["patterns"][corr_type].append(pattern)

    def suggest_rule_adjustments(self) -> List[Dict]:
        """
        Analyze correction patterns and suggest rule changes
        Returns list of suggestions
        """
        suggestions = []
        
        # Analyze amount correction patterns
        amount_corrections = self.healing_log["patterns"].get("amount", [])
        if len(amount_corrections) > 5:
            suggestions.append({
                "type": "amount_extraction",
                "issue": "Multiple amount extraction errors detected",
                "suggestion": "Lower OCR confidence threshold for amounts",
                "frequency": len(amount_corrections)
            })

        # Analyze name extraction patterns
        name_corrections = self.healing_log["patterns"].get("name", [])
        if len(name_corrections) > 5:
            suggestions.append({
                "type": "merchant_name",
                "issue": "Multiple merchant name errors",
                "suggestion": "Apply fuzzy matching or manual merchant database",
                "frequency": len(name_corrections)
            })

        return suggestions

    def generate_healing_report(self) -> Dict:
        """
        Generate system health report
        Shows success rates and areas needing improvement
        """
        total_corrections = len(self.healing_log["corrections"])
        correction_types = {}
        
        for correction in self.healing_log["corrections"]:
            corr_type = correction.get("type", "unknown")
            correction_types[corr_type] = correction_types.get(corr_type, 0) + 1

        report = {
            "timestamp": datetime.now().isoformat(),
            "total_corrections": total_corrections,
            "correction_breakdown": correction_types,
            "suggestions": self.suggest_rule_adjustments(),
            "system_health": self._calculate_health_score()
        }
        
        return report

    def _calculate_health_score(self) -> float:
        """
        Calculate system health (0-1)
        Based on correction frequency
        """
        if len(self.healing_log["corrections"]) == 0:
            return 1.0
        
        # Penalize based on correction frequency
        # Ideal: 0 corrections, worst: >20
        correction_count = len(self.healing_log["corrections"])
        health = max(0.0, 1.0 - (correction_count / 50.0))
        
        return round(health, 2)

    def apply_learning(self, transaction: Dict) -> Dict:
        """
        Apply learned patterns to improve transaction extraction
        """
        learned_transaction = transaction.copy()
        
        # Check if we have patterns for this merchant
        name_patterns = self.healing_log["patterns"].get("name", [])
        for pattern in name_patterns:
            if pattern["original_name"] == transaction.get("name"):
                learned_transaction["name"] = pattern["corrected_name"]
                learned_transaction["learning_applied"] = True
                break

        return learned_transaction


def main():
    """
    CLI: python retrain.py <command> <json_input>
    Commands: flag, record, report, health
    """
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}), file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    
    try:
        healer = HealingEngine()
        
        if command == "flag":
            input_data = json.loads(sys.stdin.read() if sys.stdin else "{}")
            transaction = input_data.get("transaction", {})
            confidence = input_data.get("confidence", 0.0)
            is_flagged = healer.flag_low_confidence(transaction, confidence)
            print(json.dumps({"flagged": is_flagged}))
        
        elif command == "record":
            input_data = json.loads(sys.stdin.read() if sys.stdin else "{}")
            original = input_data.get("original", {})
            corrected = input_data.get("corrected", {})
            corr_type = input_data.get("type", "manual")
            healer.record_correction(original, corrected, corr_type)
            print(json.dumps({"recorded": True}))
        
        elif command == "report":
            report = healer.generate_healing_report()
            print(json.dumps(report))
        
        elif command == "health":
            health = healer._calculate_health_score()
            print(json.dumps({"health_score": health}))
        
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}), file=sys.stderr)
            sys.exit(1)
    
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
