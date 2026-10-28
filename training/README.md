# Training the VistaVision handwriting model

The CNN shipped in `backend/app/models/bundled/vista_digits_cnn.onnx` was trained with these scripts (CPU only, about 30 minutes).

```bash
pip install jax jaxlib onnx numpy opencv-python-headless onnxruntime
mkdir data && cd data
for f in train-images-idx3-ubyte train-labels-idx1-ubyte t10k-images-idx3-ubyte t10k-labels-idx1-ubyte; do
  curl -LO https://raw.githubusercontent.com/fgnt/mnist/master/$f.gz; done     # MNIST
cd ..
python gen_font_digits.py 20000 data/fonts_train.npz 1      # digits rendered in many fonts, pushed through the app's preprocessing
python gen_font_digits.py 3000  data/fonts_test.npz 999
python train_jax.py 10                                      # augmented MNIST + font digits -> ONNX
python eval_models.py ../backend/app/models/bundled/vista_digits_cnn.onnx
```

Why: the stock MNIST model is excellent on clean MNIST but weak on unusual handwriting styles, thick/thin pens and slanted digits. This model is trained with rotation, shear, scale, shift, stroke-thickness, blur and noise augmentation, plus digits that went through the same cleaning pipeline the app uses at run time.
