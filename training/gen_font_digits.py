"""Render digits in many fonts/styles, push them through the app's own preprocessing, and save 28x28 tiles."""
import sys, random
import cv2, numpy as np
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.services.digit_preprocess import extract_digits
from app.errors import ApiError

FONTS = [cv2.FONT_HERSHEY_SIMPLEX, cv2.FONT_HERSHEY_PLAIN, cv2.FONT_HERSHEY_DUPLEX, cv2.FONT_HERSHEY_COMPLEX,
         cv2.FONT_HERSHEY_TRIPLEX, cv2.FONT_HERSHEY_COMPLEX_SMALL, cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, cv2.FONT_HERSHEY_SCRIPT_COMPLEX]

def render(digit: str, rng: random.Random, np_rng: np.random.Generator, paper: bool):
    font = rng.choice(FONTS) | (cv2.FONT_ITALIC if rng.random() < 0.3 else 0)
    size = rng.uniform(2.5, 5.0)
    thick = rng.randint(2, 16)
    w, h = 900, 600
    img = np.full((h, w, 3), 255, np.uint8)
    (tw, th), _ = cv2.getTextSize(digit, font, size, thick)
    cv2.putText(img, digit, ((w - tw) // 2, (h + th) // 2), font, size, (25, 25, 25), thick, cv2.LINE_AA)
    # handwriting-like wobble: rotation, shear, slight non-uniform scale
    ang = rng.uniform(-18, 18); sh = rng.uniform(-0.3, 0.3); sx = rng.uniform(0.8, 1.15)
    M = cv2.getRotationMatrix2D((w / 2, h / 2), ang, 1.0)
    M[0, 1] += sh; M[0, 0] *= sx
    img = cv2.warpAffine(img, M, (w, h), borderValue=(255, 255, 255))
    if paper:
        shade = np.linspace(rng.uniform(140, 200), rng.uniform(210, 250), w)[None, :, None] * np.ones((h, 1, 1))
        img = (img.astype(np.float32) / 255 * shade).astype(np.uint8)
        img = np.clip(img + np_rng.normal(0, rng.uniform(2, 10), img.shape), 0, 255).astype(np.uint8)
        img = cv2.GaussianBlur(img, (5, 5), 0)
    return img

def main(n, out, seed):
    rng = random.Random(seed); np_rng = np.random.default_rng(seed)
    X, y = [], []
    while len(y) < n:
        d = str(rng.randint(0, 9))
        paper = rng.random() < 0.5
        try:
            r = extract_digits(render(d, rng, np_rng, paper), source="paper" if paper else "canvas", mode="single")
        except ApiError:
            continue
        X.append(r.crops[0].tile); y.append(int(d))
    np.savez_compressed(out, x=np.array(X, np.float32), y=np.array(y, np.int64))
    print("saved", out, len(y))

if __name__ == "__main__":
    main(int(sys.argv[1]), sys.argv[2], int(sys.argv[3]))
