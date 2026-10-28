import sys, random, gzip
import numpy as np, cv2, onnxruntime as ort
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.services.digit_preprocess import extract_digits
from app.errors import ApiError

def idx(path):
    d = gzip.open(path).read()
    if d[2] == 8 and d[3] == 3:
        n, r, c = np.frombuffer(d[4:16], ">u4"); return np.frombuffer(d, np.uint8, offset=16).reshape(n, r, c)
    return np.frombuffer(d, np.uint8, offset=8)
xte = idx("data/t10k-images-idx3-ubyte.gz"); yte = idx("data/t10k-labels-idx1-ubyte.gz")

def sm(z): z = z - z.max(1, keepdims=True); e = np.exp(z); return e / e.sum(1, keepdims=True)
def run(path, tiles):
    s = ort.InferenceSession(path, providers=["CPUExecutionProvider"]); n = s.get_inputs()[0].name
    return sm(np.vstack([s.run(None, {n: t[None, None].astype(np.float32)})[0] for t in tiles]))

def real_world_tiles(count, seed, paper):
    """Real human MNIST handwriting -> big drawing/photo -> the app's own preprocessing -> tile."""
    rng = random.Random(seed); nrng = np.random.default_rng(seed); tiles, labels = [], []
    order = list(range(len(xte))); rng.shuffle(order)
    for i in order:
        if len(tiles) >= count: break
        size = rng.randint(180, 420)
        big = cv2.resize(255 - xte[i], (size, size), interpolation=cv2.INTER_CUBIC)
        # make strokes look like a pen/finger line: sharpen + optional thickening
        big = cv2.threshold(big, 160 if rng.random() < .5 else 200, 255, cv2.THRESH_BINARY)[1] if rng.random() < .6 else big
        canvas = np.full((600, 900), 255, np.uint8)
        x0, y0 = rng.randint(50, 900 - size - 50), rng.randint(20, 600 - size - 20)
        canvas[y0:y0 + size, x0:x0 + size] = np.minimum(canvas[y0:y0 + size, x0:x0 + size], big)
        img = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)
        if paper:
            shade = np.linspace(rng.uniform(140, 200), rng.uniform(210, 250), 900)[None, :, None] * np.ones((600, 1, 1))
            img = (img.astype(np.float32) / 255 * shade).astype(np.uint8)
            img = cv2.GaussianBlur(np.clip(img + nrng.normal(0, rng.uniform(2, 9), img.shape), 0, 255).astype(np.uint8), (5, 5), 0)
        try: r = extract_digits(img, source="paper" if paper else "canvas", mode="single")
        except ApiError: continue
        tiles.append(r.crops[0].tile); labels.append(int(yte[i]))
    return np.array(tiles), np.array(labels)

if __name__ == "__main__":
    mine = sys.argv[1]
    ref = str(Path(__file__).resolve().parents[1] / "backend/app/models/weights/mnist-12.onnx")
    sets = {}
    sets["MNIST clean"] = (np.array([cv2.copyMakeBorder(x, 0, 0, 0, 0, cv2.BORDER_CONSTANT) for x in xte[:2000]], np.float32) / 255, yte[:2000])
    sets["MNIST hard-aug"] = (np.load("data/hard_test.npy")[:2000, 0], yte[:2000])
    f = np.load("data/fonts_test.npz"); sets["font digits via pipeline"] = (f["x"], f["y"])
    sets["real handwriting, drawn (canvas)"] = real_world_tiles(1200, 1, False)
    sets["real handwriting, photo (paper)"] = real_world_tiles(1200, 2, True)
    print(f"{'test set':36s} {'mnist-12':>9s} {'VistaCNN':>9s} {'ensemble':>9s}  n")
    for name, (x, y) in sets.items():
        a, b = run(ref, x), run(mine, x)
        acc = lambda p: np.mean(p.argmax(1) == y) * 100
        best = max(((w, acc(w * b + (1 - w) * a)) for w in (0.5, 0.7, 0.85)), key=lambda t: t[1])
        print(f"{name:36s} {acc(a):8.1f}% {acc(b):8.1f}% {acc(0.7*b+0.3*a):8.1f}%  {len(y)}")
