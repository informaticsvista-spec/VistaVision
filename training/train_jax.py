import gzip, math, sys, time, functools
import numpy as np, jax, jax.numpy as jnp
from jax import lax, random

def idx(path):
    d = gzip.open(path).read()
    if d[2] == 8 and d[3] == 3:
        n, r, c = np.frombuffer(d[4:16], ">u4"); return np.frombuffer(d, np.uint8, offset=16).reshape(n, r, c)
    return np.frombuffer(d, np.uint8, offset=8)

D = "data/"
xtr = (idx(D+"train-images-idx3-ubyte.gz")/255.0).astype(np.float32)[:, None]; ytr = idx(D+"train-labels-idx1-ubyte.gz").astype(np.int32)
xte = (idx(D+"t10k-images-idx3-ubyte.gz")/255.0).astype(np.float32)[:, None]; yte = idx(D+"t10k-labels-idx1-ubyte.gz").astype(np.int32)
ft = np.load(D+"fonts_train.npz"); fe = np.load(D+"fonts_test.npz")
xf, yf = ft["x"][:, None].astype(np.float32), ft["y"].astype(np.int32)
xfe, yfe = fe["x"][:, None].astype(np.float32), fe["y"].astype(np.int32)

# ---------------- augmentation (batched, jit) ----------------
def pool_max(x, k):  # x: N,1,28,28 ; "same" max filter = dilation
    return lax.reduce_window(x, -jnp.inf, lax.max, (1, 1, k, k), (1, 1, 1, 1), "SAME")
def pool_avg(x, k):
    return lax.reduce_window(x, 0.0, lax.add, (1, 1, k, k), (1, 1, 1, 1), "SAME") / (k * k)

def warp_one(img, ang, sh, sx, sy, tx, ty):
    # inverse mapping: output pixel -> input coordinate (centre-based)
    c, s = jnp.cos(ang), jnp.sin(ang)
    yy, xx = jnp.meshgrid(jnp.arange(28.0) - 13.5, jnp.arange(28.0) - 13.5, indexing="ij")
    a = jnp.array([[c / sx, (-s + sh) / sx], [s / sy, c / sy]])
    xin = a[0, 0] * xx + a[0, 1] * yy + tx * 14
    yin = a[1, 0] * xx + a[1, 1] * yy + ty * 14
    coords = jnp.stack([yin + 13.5, xin + 13.5])
    return jax.scipy.ndimage.map_coordinates(img[0], coords, order=1, mode="constant", cval=0.0)[None]

def make_augment(strong=True, thick=True):
    rot = math.radians(18 if strong else 10); shr = 0.3 if strong else 0.15; scl = 0.2 if strong else 0.1
    @jax.jit
    def aug(key, x):
        n = x.shape[0]; ks = random.split(key, 10)
        u = lambda k, lim: (random.uniform(k, (n,)) * 2 - 1) * lim
        out = jax.vmap(warp_one)(x, u(ks[0], rot), u(ks[1], shr), 1 + u(ks[2], scl), 1 + u(ks[3], scl), u(ks[4], 0.14), u(ks[5], 0.14))
        if thick:
            r = random.uniform(ks[6], (n, 1, 1, 1))
            out = jnp.where(r < 0.25, pool_max(out, 3), out)
            out = jnp.where((r >= 0.25) & (r < 0.35), pool_max(out, 5), out)
            out = jnp.where((r >= 0.35) & (r < 0.5), -pool_max(-out, 3), out)
            out = jnp.where(random.uniform(ks[7], (n, 1, 1, 1)) < 0.25, pool_avg(out, 3), out)
        noise = random.normal(ks[8], out.shape) * 0.03 * (random.uniform(ks[9], (n, 1, 1, 1)) < 0.3)
        return jnp.clip(out + noise, 0, 1)
    return aug

# ---------------- model ----------------
def init(key):
    ks = random.split(key, 6)
    he = lambda k, shape, fan: random.normal(k, shape) * math.sqrt(2.0 / fan)
    return {
        "c1": (he(ks[0], (32, 1, 3, 3), 9), jnp.zeros(32)), "c2": (he(ks[1], (32, 32, 3, 3), 288), jnp.zeros(32)),
        "c3": (he(ks[2], (64, 32, 3, 3), 288), jnp.zeros(64)), "c4": (he(ks[3], (64, 64, 3, 3), 576), jnp.zeros(64)),
        "f1": (he(ks[4], (3136, 128), 3136), jnp.zeros(128)), "f2": (he(ks[5], (128, 10), 128), jnp.zeros(10)),
    }

def conv(x, p):
    w, b = p
    return lax.conv_general_dilated(x, w, (1, 1), "SAME", dimension_numbers=("NCHW", "OIHW", "NCHW")) + b[None, :, None, None]
def mpool(x): return lax.reduce_window(x, -jnp.inf, lax.max, (1, 1, 2, 2), (1, 1, 2, 2), "VALID")
def dropout(key, x, rate):
    if key is None: return x
    return x * (random.bernoulli(key, 1 - rate, x.shape) / (1 - rate))

def forward(params, x, key=None):
    ks = random.split(key, 3) if key is not None else [None] * 3
    h = jax.nn.relu(conv(x, params["c1"])); h = jax.nn.relu(conv(h, params["c2"])); h = dropout(ks[0], mpool(h), 0.1)
    h = jax.nn.relu(conv(h, params["c3"])); h = jax.nn.relu(conv(h, params["c4"])); h = dropout(ks[1], mpool(h), 0.2)
    h = h.reshape(h.shape[0], -1)
    h = dropout(ks[2], jax.nn.relu(h @ params["f1"][0] + params["f1"][1]), 0.3)
    return h @ params["f2"][0] + params["f2"][1]

def loss_fn(params, x, y, key):
    logits = forward(params, x, key)
    onehot = jax.nn.one_hot(y, 10) * 0.95 + 0.005
    return -jnp.mean(jnp.sum(onehot * jax.nn.log_softmax(logits), -1))

@jax.jit
def predict(params, x): return forward(params, x)

def accuracy(params, x, y):
    return float(np.mean(np.concatenate([np.argmax(predict(params, x[i:i+2000]), 1) for i in range(0, len(x), 2000)]) == y))

# AdamW with one-cycle-ish cosine schedule
def adam_init(params): return jax.tree_util.tree_map(jnp.zeros_like, params), jax.tree_util.tree_map(jnp.zeros_like, params)

@jax.jit
def step(params, m, v, t, lr, x, y, key):
    loss, g = jax.value_and_grad(loss_fn)(params, x, y, key)
    b1, b2, eps = 0.9, 0.999, 1e-8
    m = jax.tree_util.tree_map(lambda m_, g_: b1 * m_ + (1 - b1) * g_, m, g)
    v = jax.tree_util.tree_map(lambda v_, g_: b2 * v_ + (1 - b2) * g_ ** 2, v, g)
    params = jax.tree_util.tree_map(lambda p, m_, v_: p - lr * ((m_ / (1 - b1 ** t)) / (jnp.sqrt(v_ / (1 - b2 ** t)) + eps) + 1e-4 * p), params, m, v)
    return params, m, v, loss

def export_onnx(params, path):
    import onnx
    from onnx import helper, TensorProto, numpy_helper
    P = {k: (np.asarray(w, np.float32), np.asarray(b, np.float32)) for k, (w, b) in params.items()}
    inits, nodes = [], []
    def add(name, arr): inits.append(numpy_helper.from_array(arr, name))
    prev = "input"
    for i, name in enumerate(["c1", "c2", "c3", "c4"], 1):
        add(f"{name}_w", P[name][0]); add(f"{name}_b", P[name][1])
        nodes.append(helper.make_node("Conv", [prev, f"{name}_w", f"{name}_b"], [f"{name}_o"], pads=[1, 1, 1, 1], kernel_shape=[3, 3]))
        nodes.append(helper.make_node("Relu", [f"{name}_o"], [f"{name}_r"])); prev = f"{name}_r"
        if i in (2, 4):
            nodes.append(helper.make_node("MaxPool", [prev], [f"pool{i}"], kernel_shape=[2, 2], strides=[2, 2])); prev = f"pool{i}"
    nodes.append(helper.make_node("Flatten", [prev], ["flat"], axis=1))
    add("f1_w", P["f1"][0]); add("f1_b", P["f1"][1]); add("f2_w", P["f2"][0]); add("f2_b", P["f2"][1])
    nodes.append(helper.make_node("Gemm", ["flat", "f1_w", "f1_b"], ["g1"])); nodes.append(helper.make_node("Relu", ["g1"], ["g1r"]))
    nodes.append(helper.make_node("Gemm", ["g1r", "f2_w", "f2_b"], ["logits"]))
    graph = helper.make_graph(nodes, "vista_digits_cnn", [helper.make_tensor_value_info("input", TensorProto.FLOAT, ["batch", 1, 28, 28])],
                              [helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["batch", 10])], inits)
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)]); model.ir_version = 8
    onnx.checker.check_model(model); onnx.save(model, path)

if __name__ == "__main__":
    epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    key = random.PRNGKey(0); params = init(key); m, v = adam_init(params)
    aug_s, aug_f = make_augment(True, True), make_augment(False, False)
    xh = np.asarray(aug_s(random.PRNGKey(123), jnp.asarray(xte))); np.save(D + "hard_test.npy", xh)   # fixed hard test set
    bs, nf = 128, 32
    spe = len(xtr) // bs; total = epochs * spe; t = 0; t0 = time.time()
    rng = np.random.default_rng(0)
    for ep in range(epochs):
        perm = rng.permutation(len(xtr))
        for b in range(spe):
            t += 1
            lr = 3e-3 * (0.5 * (1 + math.cos(math.pi * t / total))) * min(1.0, t / 200) + 1e-5
            ids = perm[b * bs:(b + 1) * bs]; fi = rng.integers(0, len(xf), nf)
            key, k1, k2, k3 = random.split(key, 4)
            xb = jnp.concatenate([aug_s(k1, jnp.asarray(xtr[ids])), aug_f(k2, jnp.asarray(xf[fi]))]); yb = jnp.concatenate([jnp.asarray(ytr[ids]), jnp.asarray(yf[fi])])
            params, m, v, loss = step(params, m, v, float(t), lr, xb, yb, k3)
        print(f"ep{ep+1}/{epochs} loss {float(loss):.3f} clean {accuracy(params, xte, yte):.4f} hard {accuracy(params, xh, yte):.4f} fonts {accuracy(params, xfe, yfe):.4f} {time.time()-t0:.0f}s", flush=True)
        np.savez("data/digit_params.npz", **{f"{k}_{i}": np.asarray(a) for k, ab in params.items() for i, a in enumerate(ab)})
    export_onnx(params, "../backend/app/models/bundled/vista_digits_cnn.onnx"); print("exported")
