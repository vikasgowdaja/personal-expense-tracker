#!/usr/bin/env python
import sys
import json
import cv2
import numpy as np
import pytesseract
from PIL import Image


def preprocess_image(path):
    img = cv2.imread(path)
    if img is None:
        raise ValueError('Could not read image')

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Denoise while preserving edges
    denoised = cv2.fastNlMeansDenoising(gray, None, 30, 7, 21)

    # Apply adaptive thresholding to handle uneven lighting
    thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 21, 10)

    # Morphological operations to remove small noise
    kernel = np.ones((1, 1), np.uint8)
    opened = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    # Optional deskew: compute moments and rotate
    coords = np.column_stack(np.where(opened > 0))
    if coords.size > 0:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        (h, w) = opened.shape
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(opened, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    else:
        rotated = opened

    return rotated


def ocr_from_image(path):
    processed = preprocess_image(path)

    # Convert to PIL Image for pytesseract
    pil_img = Image.fromarray(processed)

    # Configure tesseract for best text extraction
    custom_oem_psm_config = r'--oem 1 --psm 6'
    text = pytesseract.image_to_string(pil_img, lang='eng', config=custom_oem_psm_config)
    return text


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No image path provided'}))
        sys.exit(2)

    path = sys.argv[1]
    try:
        text = ocr_from_image(path)
        print(json.dumps({'text': text}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
