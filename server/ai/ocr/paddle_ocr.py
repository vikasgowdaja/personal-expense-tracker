#!/usr/bin/env python
"""
PaddleOCR Engine - Offline Vision Module
Converts financial screenshots to structured text with high accuracy
"""
import sys
import json
import cv2
import numpy as np
from PIL import Image

try:
    from paddleocr import PaddleOCR
except ImportError:
    print(json.dumps({"error": "PaddleOCR not installed. Run: pip install paddleocr"}), file=sys.stderr)
    sys.exit(1)


class FinancialOCR:
    def __init__(self, lang='en', use_gpu=False):
        """
        Initialize PaddleOCR optimized for financial UI text
        """
        try:
            self.ocr = PaddleOCR(
                use_angle_cls=True,
                lang=lang,
                use_gpu=use_gpu,
                det_model_dir=None,  # Use default pretrained
                rec_model_dir=None,
                cls_model_dir=None,
                show_log=False
            )
        except Exception as e:
            raise RuntimeError(f"Failed to initialize PaddleOCR: {str(e)}")

    def preprocess_image(self, image_path):
        """
        Preprocess image to enhance OCR accuracy
        - Denoise
        - Adaptive thresholding
        - Contrast enhancement
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not read image: {image_path}")

        # Denoise while preserving edges
        denoised = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 15, 15)

        # Convert to grayscale for better processing
        gray = cv2.cvtColor(denoised, cv2.COLOR_BGR2GRAY)

        # CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Sharpening kernel to make text crisper
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]]) / 9.0
        sharpened = cv2.filter2D(enhanced, -1, kernel)

        return sharpened

    def extract_with_confidence(self, image_path):
        """
        Extract text with confidence scores
        Returns structured list of detected regions
        """
        try:
            # Preprocess image
            processed_img = self.preprocess_image(image_path)
            
            # Run PaddleOCR
            result = self.ocr.ocr(processed_img, cls=True)
            
            if not result or not result[0]:
                return []
            
            # Format results with confidence
            extracted = []
            for line in result:
                for word_info in line:
                    bbox, (text, confidence) = word_info
                    extracted.append({
                        "text": text.strip(),
                        "confidence": float(confidence),
                        "bbox": [[float(x), float(y)] for x, y in bbox]
                    })
            
            return extracted
        
        except Exception as e:
            raise RuntimeError(f"OCR extraction failed: {str(e)}")

    def extract_full_text(self, image_path):
        """
        Extract full text from image (simple mode)
        """
        extracted = self.extract_with_confidence(image_path)
        return "\n".join([item["text"] for item in extracted])


def main():
    """
    CLI entry point: python paddle_ocr.py <image_path> [--full]
    """
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}), file=sys.stderr)
        sys.exit(2)

    image_path = sys.argv[1]
    full_mode = "--full" in sys.argv

    try:
        ocr = FinancialOCR()
        
        if full_mode:
            # Return plain text
            text = ocr.extract_full_text(image_path)
            print(json.dumps({"text": text}))
        else:
            # Return structured data with confidence
            extracted = ocr.extract_with_confidence(image_path)
            print(json.dumps({
                "success": True,
                "items": extracted,
                "total_items": len(extracted)
            }))
    
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
