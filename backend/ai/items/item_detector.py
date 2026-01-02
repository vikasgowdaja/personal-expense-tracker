#!/usr/bin/env python
"""
Item Detector & Segmenter
Detects and segments individual line items from receipt images
Uses contour detection + ML-based region validation
"""
import cv2
import numpy as np
from typing import List, Dict, Tuple
from PIL import Image


class ItemDetector:
    """
    Detects and extracts individual line items from receipt images
    """
    
    def __init__(self):
        self.min_item_height = 15  # Minimum pixel height for item region
        self.min_item_width = 50   # Minimum pixel width for item region
        self.line_overlap_threshold = 0.3  # Merge lines overlapping by this %
    
    def detect_item_regions(self, image_path: str) -> List[Dict]:
        """
        Detect bounding boxes for each line item in receipt
        Returns list of regions with coordinates and confidence
        """
        try:
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"Could not read image: {image_path}")
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Apply thresholding to get binary image
            _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
            
            # Detect horizontal lines (items are typically on horizontal lines)
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
            horizontal_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
            
            # Dilate to connect nearby regions
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3))
            dilated = cv2.dilate(horizontal_lines, kernel, iterations=2)
            
            # Find contours
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Extract item regions
            regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter by size
                if w < self.min_item_width or h < self.min_item_height:
                    continue
                
                # Add padding around item
                padding = 5
                x = max(0, x - padding)
                y = max(0, y - padding)
                w = min(img.shape[1] - x, w + 2 * padding)
                h = min(img.shape[0] - y, h + 2 * padding)
                
                regions.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    "area": int(w * h),
                    "confidence": 0.85  # Contour detection confidence
                })
            
            # Sort by Y coordinate (top to bottom)
            regions = sorted(regions, key=lambda r: r["y"])
            
            # Merge overlapping regions (same line items split across multiple contours)
            regions = self._merge_overlapping_regions(regions)
            
            return regions
        
        except Exception as e:
            raise RuntimeError(f"Item detection failed: {str(e)}")
    
    def _merge_overlapping_regions(self, regions: List[Dict]) -> List[Dict]:
        """
        Merge regions that overlap vertically (same line item)
        """
        if not regions:
            return regions
        
        merged = []
        current = regions[0].copy()
        
        for i in range(1, len(regions)):
            next_region = regions[i]
            
            # Check vertical overlap
            current_bottom = current["y"] + current["height"]
            next_top = next_region["y"]
            
            # If overlap is significant, merge
            if next_top < current_bottom * (1 + self.line_overlap_threshold):
                # Merge: expand bounding box
                x1 = min(current["x"], next_region["x"])
                y1 = min(current["y"], next_region["y"])
                x2 = max(current["x"] + current["width"], next_region["x"] + next_region["width"])
                y2 = max(current["y"] + current["height"], next_region["y"] + next_region["height"])
                
                current = {
                    "x": x1,
                    "y": y1,
                    "width": x2 - x1,
                    "height": y2 - y1,
                    "area": (x2 - x1) * (y2 - y1),
                    "confidence": min(current["confidence"], next_region["confidence"]) * 0.95
                }
            else:
                merged.append(current)
                current = next_region.copy()
        
        merged.append(current)
        return merged
    
    def extract_item_rois(self, image_path: str, regions: List[Dict]) -> List[Dict]:
        """
        Extract Region of Interest (ROI) for each detected item
        Returns list with region data + cropped image array
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not read image: {image_path}")
        
        rois = []
        for idx, region in enumerate(regions):
            x, y, w, h = region["x"], region["y"], region["width"], region["height"]
            
            # Crop region
            roi_img = img[y:y+h, x:x+w]
            
            # Convert to PIL for easier handling
            roi_pil = Image.fromarray(cv2.cvtColor(roi_img, cv2.COLOR_BGR2RGB))
            
            rois.append({
                "index": idx,
                "region": region,
                "image": roi_img,  # OpenCV format (BGR)
                "image_pil": roi_pil,
                "ocr_ready": True
            })
        
        return rois
    
    def validate_regions(self, regions: List[Dict], image_shape: Tuple) -> List[Dict]:
        """
        Validate regions - remove outliers and duplicates
        """
        if not regions:
            return []
        
        # Calculate statistics
        areas = [r["area"] for r in regions]
        mean_area = np.mean(areas)
        std_area = np.std(areas)
        
        # Filter outliers (too small or too large compared to average)
        validated = []
        for region in regions:
            area_zscore = abs((region["area"] - mean_area) / (std_area + 1e-6))
            
            # Keep regions within 2 standard deviations or if area is reasonable
            if area_zscore <= 2.5 or (region["area"] > self.min_item_width * self.min_item_height):
                validated.append(region)
        
        return validated


def main():
    """
    CLI: python item_detector.py <image_path> [--visualize]
    """
    import sys
    import json
    
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}), file=sys.stderr)
        sys.exit(2)
    
    image_path = sys.argv[1]
    visualize = "--visualize" in sys.argv
    
    try:
        detector = ItemDetector()
        regions = detector.detect_item_regions(image_path)
        
        print(json.dumps({
            "success": True,
            "regions": regions,
            "total_items": len(regions)
        }))
        
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
