"""
Offline Personal Financial Intelligence Engine (PFIE)
Complete AI system for financial screenshot analysis
"""

__version__ = "1.0.0"
__author__ = "AI Development Team"
__description__ = "Enterprise-grade offline financial AI"

from .ocr.paddle_ocr import FinancialOCR
from .layout_ai.layout_model import LayoutAnalyzer
from .ml.predict import MLPredictor
from .healing.retrain import HealingEngine

__all__ = [
    'FinancialOCR',
    'LayoutAnalyzer',
    'MLPredictor',
    'HealingEngine'
]
