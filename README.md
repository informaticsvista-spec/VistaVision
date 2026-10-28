---
title: VistaVision
emoji: 👁️
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
short_description: AI-powered computer vision and data analytics for school demos
---

# VistaVision — AI-Powered Computer Vision & Data Analytics

*"See Beyond. Discover Intelligence."*

An interactive web app for school-visit demonstrations (PMIST, Department of Informatics, VISTA). Visitors use real AI
models to detect faces and estimate expressions, read handwritten numbers (on paper or on a touchscreen), and
recognise everyday objects, then explore the results as live charts next to data they type in themselves.

| Module | What it does |
|---|---|
| **Smart Recognition** | Face & expression analysis (live camera), handwritten numbers (paper + camera, or finger on screen), object recognition (camera), image upload |
| **Data Visualization** | **"Build your own chart"** (type any names and numbers, choose bar/line/pie/area), KPI cards, charts and reports, history table, manual data entry (add/edit/delete), filters, CSV export, downloadable report |
| **Learning Activities** | Six student activities (Expression Challenge, Draw and Predict, Paper Number Challenge, Object Explorer, Data Detective, AI Quiz) |
| **Session Report / Settings** | Printable report; server address and session settings |

Three logos are shown: the **VistaVision** “AI eye” mark (`src/components/Logo.tsx`, `public/favicon.svg`), the **PMIST** college logo and the **VISTA** department logo (`public/logo-pmist.png`, `public/logo-vista.png`, shown by `src/components/InstitutionLogos.tsx` on the Home page). Replace those two PNG files to change them. The colour theme lives in `tailwind.config.js`.

---

## 1. Architecture

```
 Browser (React + TypeScript + Tailwind + Recharts)                     Server (FastAPI, Python)
┌─────────────────────────────────────────────────────┐           ┌──────────────────────────────────────┐
│ CameraService (one shared MediaStream)              │           │ routes/   faces · digits · objects   │
│    │ captureFrame()                                 │  JPEG/PNG │           health                     │
│    ├─► FaceTool ──► FaceTracker (temporary ids) ────┼──────────►│ services/ image_io (validation)      │
│    ├─► ObjectTool                                   │  /api/... │           face_service  YuNet + FER+│
│    └─► PaperNumber ─► crop ─────────────────────────┼──────────►│           digit_preprocess + MNIST   │
│ DrawingCanvas (touch/pen/mouse, no camera) ─────────┼──────────►│           object_service SSD-MobileNet│
│ Upload tool ────────────────────────────────────────┼──────────►│ models/   ONNX weights (downloaded)  │
│                                                     │◄──────────┤ JSON: boxes, labels, confidences     │
│ results ─► event builders ─► AnalyticsProvider      │           └──────────────────────────────────────┘
│            (dedupe by key, pause, session-only)     │            Images are decoded in memory and discarded.
│        aggregate.ts (pure functions) ─► charts, KPIs, CSV, report
│        Manual entry form ───────────────┘  (origin = "manual")  Sample data ─► origin = "sample"
└─────────────────────────────────────────────────────┘
```

**One event model.** Every record — AI, manual or sample — is a `VistaEvent`. Its `origin` (`ai` / `manual` /
`sample`) and `source` (webcam, upload, paper camera, touch canvas, manual, sample) are never lost, so the dashboard can
always filter and compare them. The Data Visualization module does not need a camera.

**Counting rules (so charts don't mislead).**

* *Faces now* = faces in the **latest snapshot** (not cumulative).
* *Tracker IDs* = distinct temporary ids from the IoU tracker. They are **not people or identities**.
* *Expression observations* = sum of per-snapshot expression counts. Percentages are shares of observations.
* The face tool saves one snapshot every N seconds (default 3), never one per video frame; each snapshot becomes one event per expression label, sharing a `groupId`.
* Digit attempts, object detections and expression observations are separate KPIs.
* Duplicates: every event has a `dedupeKey` and an id; the reducer ignores repeats. AI events are dropped while analytics are paused.

> **Where analytics lives.** The brief suggests a `backend/app/analytics` package. Analytics is in
> `frontend/src/analytics` instead: data is session-only by default and never needs to leave the browser. The backend is a stateless inference service. pandas is therefore not used.

### Stack trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| **ONNX Runtime** instead of TensorFlow/PyTorch | One small CPU dependency, fast start-up, same models on every OS, cheap hosting | Models are consumed, not trained here (train elsewhere and export to ONNX if wanted) |
| **Pretrained, checksum-pinned models** | Reliable, small, permissive licences, no GPU | Accuracy is that of the published models |
| **Analytics in the browser** | Privacy, no storage, no duplicated logic | Data is lost on refresh unless the opt-in local storage setting is on |

### Models (downloaded by `python -m app.models.download`, SHA-256 verified)

| Task | Model | Notes |
|---|---|---|
| Face detection | YuNet (OpenCV Zoo) via `cv2.FaceDetectorYN` | Boxes + 5 landmarks; nothing identity-related is kept |
| Expression estimate | **Ensemble:** MobileFaceNet trained on in-the-wild RAF-DB (OpenCV Zoo, run on landmark-aligned faces, original + mirrored view) **+** FER+ (ONNX Model Zoo) | Probabilities are softened (temperature) so "100 %" is not shown for an estimate; below the threshold the result is **Uncertain** |
| Handwritten digits | **Ensemble:** VistaVision CNN (`vista_digits_cnn.onnx`, trained here on heavily augmented MNIST + font-rendered digits pushed through the app's own preprocessing, shipped in `app/models/bundled/`) **+** MNIST `mnist-12` (ONNX Model Zoo); small shift/mirror-free test-time averaging | See `training/` for the training script and the measured accuracy |
| Objects | **YOLOX-S**, COCO (OpenCV Zoo) | 80 object types only; roughly twice the accuracy of the SSD MobileNet v1 used in the first version |

### Measured accuracy of the handwriting model

Tested with `training/eval_models.py` (2,000 – 3,000 images per row; "real handwriting" = human-written MNIST test digits blown up to drawing/photo size and sent through the app's own cleaning pipeline):

| Test | Stock MNIST model | VistaVision CNN | Ensemble used by the app (80 / 20) |
|---|---|---|---|
| Clean MNIST | 98.3 % | 99.6 % | 99.5 % |
| MNIST with rotation / shear / thick / thin strokes / noise | 82.6 % | 98.0 % | 97.8 % |
| Digits drawn in 8 font styles through the pipeline | 84.9 % | 99.7 % | 99.4 % |
| Real handwriting drawn on a canvas | 98.6 % | 99.5 % | 99.5 % |
| Real handwriting photographed on shaded, noisy paper | 97.0 % | 98.3 % | 98.8 % |

These are single digits from clean sources. A real pen, a real webcam, sloppy writing and touching digits will score lower, which is why every result has a **Yes / No check** and the dashboard scoreboard shows the accuracy your own group measures.

### Known limitations (read before a demo)

* **Expressions are estimates of a visible expression**, not emotions. FER+ is weaker on small, tilted, masked or badly lit faces. Always show the confidence and the disclaimer.
* **Digits**: MNIST-style models can misread unusual styles. The pipeline (lighting flattening, Otsu threshold, component grouping, stroke-width normalisation, 20 px fit, centre of mass) helps, but heavily touching or overlapping digits may merge or split wrongly. Up to 8 digits.
* **Objects**: COCO does not contain every object (no pear or mango, for instance). The app never claims to recognise everything; unsupported items may be labelled as something similar. Use a plain background.
* **Faces**: small faces (roughly under 30 px in the sent frame) are missed. In a big room use a closer camera.
* Developed and tested with sample photos, synthetic images and a fake camera feed; see "Testing". The expression ensemble was only checked on one real smiling face photo, so try it on your own group.

---

## 2. Project layout

```
VistaVision/
├── backend/
│   ├── app/
│   │   ├── main.py  config.py  errors.py
│   │   ├── routes/      health  faces  digits  objects
│   │   ├── services/    image_io  model_store  face_service  digit_preprocess  digit_service  object_service
│   │   └── models/      manifest.py (URLs + checksums)  download.py  weights/ (git-ignored)
│   ├── tests/           pytest (unit + HTTP integration with the real models)
│   ├── requirements.txt  requirements-dev.txt  Dockerfile
├── frontend/
│   ├── src/analytics/   events · aggregate · reducer · AnalyticsProvider · validate · csv · report · sample
│   ├── src/services/    camera (shared) · api · tracker
│   ├── src/hooks/  src/components/  src/pages/  src/types/
│   └── public/          favicon.svg  _redirects      vercel.json
├── docs/                DEMO_GUIDE.md  CHECKLIST.md
├── Dockerfile           one container: API + built web app
└── README.md
```

To add a recognition module: render `<CameraPanel>`, call `cameraService.captureFrame()`, add a backend service and
route, and emit events through the analytics event builders. The camera service knows nothing about models.

---

## 3. Install and run (development)

Requirements: **Python 3.10–3.13**, **Node 20+**, internet access once to download the models.

```bash
# --- backend ---
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.models.download                          # downloads + verifies the ONNX models
python -m app.models.download --verify                 # (optional) re-check checksums
uvicorn app.main:app --port 8000                       # add --reload while editing

# --- frontend (second terminal) ---
cd frontend
npm install
npm run dev                                            # http://localhost:5173 (proxies /api to :8000)
```

Camera access works on `localhost` without HTTPS. If the backend runs elsewhere: `VITE_DEV_API_TARGET=http://host:8000 npm run dev`
or set the server address in **Settings**.

Dependency pins: see `backend/requirements.txt` (FastAPI 0.115.6, uvicorn 0.54.0, python-multipart 0.0.32, OpenCV-headless
4.10.0.84, onnxruntime 1.29.0, NumPy ≥1.26, Pillow ≥10.3) and `frontend/package.json`.

### Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `VISTA_CORS_ORIGINS` | backend | localhost dev origins | Comma-separated allowed frontend origins (production: your HTTPS site) |
| `VISTA_CORS_ORIGIN_REGEX` | backend | – | e.g. `https://.*\.vercel\.app` for preview deployments |
| `VISTA_MAX_UPLOAD_MB` | backend | `8` | Upload limit |
| `VISTA_MAX_IMAGE_SIDE` | backend | `2048` | Larger images are shrunk before inference |
| `VISTA_WEIGHTS_DIR` | backend | `app/models/weights` | Where the `.onnx` files live |
| `VISTA_ORT_THREADS` | backend | `0` (auto) | Limit CPU threads on small servers |
| `VISTA_FRONTEND_DIST` | backend | – | Path to `frontend/dist`; the API then also serves the web app |
| `VITE_API_URL` | frontend build | empty | Backend origin when frontend and backend are on different hosts |

### API (interactive docs at `/docs`)

`GET /api/health` · `POST /api/faces/analyze` · `POST /api/digits/recognize?source=paper|canvas&mode=single|multi` ·
`POST /api/objects/detect` · `GET /api/objects/labels`. Errors are `{"error": {"code", "message"}}`.

---

## 4. Testing

```bash
cd backend  && pip install -r requirements-dev.txt && pytest        # 54 tests
cd frontend && npm test && npm run build                            # 41 tests + typecheck + production build
```

* **Backend:** preprocessing (segmentation, specks, page borders, touching digits), API validation (bad files, oversize, empty), real inference, SPA serving.
* **Frontend:** aggregation rules (current faces vs tracked ids vs observations), duplicate prevention, pause behaviour, edit/delete recalculation, filters, empty data, form validation, CSV injection guard, tracker.
* **Browser run (headless Chromium, fake camera feed, iPhone-sized touch viewport):** manual-data flow, charts, filters, downloads, mouse and touch drawing without page scroll, live face analysis (snapshots, not per-frame events), object Analyze/Retry, camera sharing and release, upload errors, paper capture of "43".

**Not tested:** real phones/tablets and webcams, real groups of people, real human handwriting at scale, the Docker build, and a deployment on real HTTPS hosting. Use `docs/CHECKLIST.md` on your own devices before the visit.

### Camera troubleshooting

| Symptom | Fix |
|---|---|
| "Permission blocked" | Click the camera icon in the address bar → Allow → try again. iOS: Settings → Safari → Camera |
| Camera does nothing / "needs HTTPS" | Browsers only allow cameras on **https://** or **localhost**. A plain `http://192.168…` address will not work on phones |
| "Camera busy" | Close Zoom/Teams/other tabs using the camera |
| Wrong camera | Use the camera selector under the preview (shown when several cameras exist) |
| Faces not detected | Light the face from the front; keep faces reasonably large in the frame |
| "Cannot reach the server" | Start the backend or fix the address in **Settings** |

Browsers: current Chrome, Edge, Firefox, Safari (iOS 14.3+). Upload and touch drawing need no camera.

---

## 5. Deployment (HTTPS is required for phone cameras)

> The Docker image and public hosting were **not** built/tested in the development environment. Serving the built app
> from the API (`VISTA_FRONTEND_DIST`) was verified locally with curl and a pytest. Treat the steps below as standard but untested.

### Option A — one service (simplest)

```bash
docker build -t vistavision .
docker run -p 8000:8000 vistavision        # http://localhost:8000
```

Deploy the image to any container host that provides HTTPS (Render, Railway, Fly.io, Cloud Run, Azure Container Apps).
Allow about 1 GB RAM. No environment variables needed (same origin). Without Docker: `npm run build` in `frontend/`,
then `VISTA_FRONTEND_DIST=/path/to/frontend/dist uvicorn app.main:app --host 0.0.0.0 --port 8000` behind an HTTPS reverse
proxy (for example Caddy: `your.domain { reverse_proxy localhost:8000 }`).

### Option B — separate frontend and backend

1. Deploy `backend/` (its Dockerfile downloads the models). Set `VISTA_CORS_ORIGINS=https://your-frontend.example.com`.
2. Deploy `frontend/` to a static host (build `npm run build`, output `dist`) with `VITE_API_URL=https://your-backend.example.com`. SPA rewrites are provided (`vercel.json`, `public/_redirects`).
3. Open the site on a phone; check `GET /api/health` and a camera prompt.

---

## 6. Privacy and responsible AI

* Frames are sent only while a camera tool is analysing (or when you press Analyze/Recognize). The server decodes them in memory and discards them; **no image, face crop or embedding is stored**.
* **No identity recognition, no names.** Faces get temporary numbers only.
* Analytics are session-only by default. An opt-in setting keeps records (labels/counts, never images) in the browser's local storage.
* Expression output is labelled as an estimate; confidences are shown; a visible Stop Camera control is available whenever the camera is on.
* Get staff supervision and follow your school's policy on classroom cameras and consent.

## 7. Licences

YuNet (MIT), FER+ and MNIST (MIT, ONNX Model Zoo), SSD MobileNet (Apache-2.0) — check against your use. 
