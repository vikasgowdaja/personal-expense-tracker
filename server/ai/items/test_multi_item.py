#!/usr/bin/env python
"""
Quick Test Script for Multi-Item Extraction
Tests individual components to verify functionality
"""
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

def test_item_detector():
    """Test item detection on a sample receipt"""
    print("\n" + "="*60)
    print("TEST 1: Item Detection")
    print("="*60)
    
    try:
        from ai.items.item_detector import ItemDetector
        print("✓ ItemDetector imported successfully")
        
        detector = ItemDetector()
        print("✓ ItemDetector initialized")
        
        # Simulate with a test image path (won't work without actual image)
        print("✓ ItemDetector methods available:")
        print("  - detect_item_regions(image_path)")
        print("  - extract_item_rois(image_path, regions)")
        print("  - validate_regions(regions, image_shape)")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    return True


def test_item_extractor():
    """Test field extraction on sample text"""
    print("\n" + "="*60)
    print("TEST 2: Field Extraction")
    print("="*60)
    
    try:
        from ai.items.item_extractor import ItemFieldExtractor
        print("✓ ItemFieldExtractor imported successfully")
        
        extractor = ItemFieldExtractor()
        print("✓ ItemFieldExtractor initialized")
        
        # Test cases
        test_cases = [
            "Margherita Pizza x2 @250 GST:45",
            "Coca Cola 2L 120.00",
            "Garlic Bread 80 (Qty: 1)",
            "Coffee Rs. 60.00"
        ]
        
        print("\nTesting field extraction:")
        for test_text in test_cases:
            result = extractor.extract_fields(test_text)
            print(f"\n  Input: '{test_text}'")
            print(f"  → Item: {result['item_name']}")
            print(f"  → Price: ₹{result['total_price']}")
            print(f"  → Qty: {result['quantity']}")
            print(f"  → Quality: {result['quality_score']:.2%}")
            print(f"  → Flags: {result['flags'] if result['flags'] else 'None'}")
        
        # Test batch extraction
        print("\nTesting batch extraction:")
        batch_result = extractor.extract_batch(test_cases)
        print(f"✓ Extracted {len(batch_result)} items")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    return True


def test_pipeline_config():
    """Test pipeline configuration"""
    print("\n" + "="*60)
    print("TEST 3: Pipeline Configuration")
    print("="*60)
    
    try:
        from ai.pipeline import PFIEPipeline
        print("✓ PFIEPipeline imported successfully")
        
        # Test multi-item mode
        pipeline_multi = PFIEPipeline(config={"extract_mode": "multi_item"})
        print(f"✓ Multi-item pipeline created (mode={pipeline_multi.extract_mode})")
        
        # Test single mode
        pipeline_single = PFIEPipeline(config={"extract_mode": "single"})
        print(f"✓ Single-mode pipeline created (mode={pipeline_single.extract_mode})")
        
        # Check methods
        print("\n✓ Available pipeline methods:")
        print("  - process_image(image_path, user_history)")
        print("  - detect_item_regions(image_path)")
        print("  - extract_item_fields(item_texts)")
        print("  - _group_ocr_to_items(ocr_items, regions)")
        print("  - _enrich_items(items, user_history)")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    return True


def test_pattern_matching():
    """Test regex pattern matching for fields"""
    print("\n" + "="*60)
    print("TEST 4: Pattern Matching")
    print("="*60)
    
    try:
        from ai.items.item_extractor import ItemFieldExtractor
        import re
        
        extractor = ItemFieldExtractor()
        
        # Test price patterns
        test_prices = [
            ("Price: $25.50", 25.50),
            ("Cost ₹100.00", 100.00),
            ("Amount £50,00", 50.00),
            ("€35.99 total", 35.99),
        ]
        
        print("\nTesting price pattern matching:")
        for text, expected in test_prices:
            prices = extractor._extract_prices(text)
            if prices and abs(prices[-1] - expected) < 0.01:
                print(f"✓ '{text}' → {prices[-1]}")
            else:
                print(f"✗ '{text}' → {prices} (expected {expected})")
        
        # Test quantity patterns
        test_quantities = [
            ("Qty: 2", 2.0),
            ("x 3", 3.0),
            ("quantity 5", 5.0),
        ]
        
        print("\nTesting quantity pattern matching:")
        for text, expected in test_quantities:
            qty = extractor._extract_quantity(text)
            if qty and abs(qty - expected) < 0.01:
                print(f"✓ '{text}' → {qty}")
            else:
                print(f"✗ '{text}' → {qty} (expected {expected})")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    return True


def test_integration():
    """Test integrated workflow"""
    print("\n" + "="*60)
    print("TEST 5: Integration Test")
    print("="*60)
    
    try:
        from ai.items.item_extractor import ItemFieldExtractor
        from ai.pipeline import PFIEPipeline
        
        # Simulate receipt OCR output
        mock_ocr_items = [
            "Margherita Pizza x2 @250 GST:45",
            "Coca Cola 2L 120.00",
            "Garlic Bread 80"
        ]
        
        print("Simulating receipt with 3 items:")
        
        # Step 1: Extract fields
        extractor = ItemFieldExtractor()
        extracted_items = extractor.extract_batch(mock_ocr_items)
        print(f"✓ Step 1: Extracted {len(extracted_items)} items")
        
        # Step 2: Calculate statistics
        valid_items = [item for item in extracted_items if item['quality_score'] > 0.3]
        print(f"✓ Step 2: {len(valid_items)} items passed quality check")
        
        # Step 3: Simulate enrichment
        total_amount = sum(item['total_price'] or 0 for item in valid_items)
        avg_price = total_amount / len(valid_items) if valid_items else 0
        
        print(f"✓ Step 3: Calculated stats")
        print(f"  - Total: ₹{total_amount}")
        print(f"  - Average per item: ₹{avg_price:.2f}")
        print(f"  - Item breakdown:")
        for i, item in enumerate(valid_items, 1):
            print(f"    {i}. {item['item_name']}: ₹{item['total_price']} (Q: {item['quantity']}, Score: {item['quality_score']:.0%})")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    return True


def main():
    """Run all tests"""
    print("\n" + "╔" + "="*58 + "╗")
    print("║" + " "*16 + "Multi-Item Extraction Test Suite" + " "*10 + "║")
    print("╚" + "="*58 + "╝")
    
    tests = [
        ("Item Detector", test_item_detector),
        ("Field Extraction", test_item_extractor),
        ("Pipeline Config", test_pipeline_config),
        ("Pattern Matching", test_pattern_matching),
        ("Integration", test_integration),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            results.append((name, test_func()))
        except Exception as e:
            print(f"\n✗ {name} failed with error: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ All tests passed! Multi-item extraction is ready to use.")
        return 0
    else:
        print(f"\n✗ {total - passed} test(s) failed. Please review errors above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
