# VistaVision — Final Checklist

Legend: ✅ verified in development (automated or headless-browser) · ⚠️ implemented, needs your own device check · ❌ not done

## Identity & navigation
- ✅ Three logos (VistaVision mark, PMIST college, VISTA department), name, subtitle, tagline, intro, "Let's Start" reveals both modules
- ✅ Navigation: Home, Smart Recognition, Data Visualization, Learning Activities, Session Report, Settings

## Smart Recognition
- ✅ Multi-face detection (YuNet), boxes, temporary IDs, expression + confidence, Uncertain label, counts and percentages (tested with a real face photo; ⚠️ multiple real people not tested)
- ✅ Paper handwriting: preprocessing, crop, single/multi-digit, large Detected Number, capture again (synthetic and a staged "43"); ⚠️ real handwriting on real paper not tested
- ✅ Touch/stylus/mouse drawing, brush size, Clear/Erase/Undo/Predict, no page scroll (emulated touch); ⚠️ real phone/tablet
- ✅ Object recognition on the shared camera: Start/Stop/Capture/Analyze/Retry, boxes, confidence, honest limits
- ✅ Image upload JPG/PNG/WebP with friendly errors (GIF rejected)
- ✅ One shared camera service; stopped on Stop and on leaving the page

## Data Visualization
- ✅ Works without a camera; AI-generated and manual sources, clearly labelled sample data
- ✅ Manual add/edit/delete/clear/load-sample with validation
- ✅ Structured events, de-duplication, pause, reset; aggregation unit-tested (current faces vs tracker IDs vs observations)
- ✅ Charts with empty states and table views, filters, CSV export (formula-injection guard), downloadable HTML report

## Build your own chart (typed inputs)
- ✅ Top of Data Visualization: type any name + number, instant bar / line / pie / area chart, rename title and axes, sort, edit or delete rows, paste many lines, examples, quick facts, CSV download (tested in browser on desktop and phone width)
- ✅ Bad input is explained in plain words (missing number, text instead of number, duplicate names added together, negative numbers on a pie)
- ✅ Records added with activity type "Other (any category)" now get their own chart

## Accuracy and uniqueness (added after feedback)
- ✅ Objects: YOLOX-S detector (tested: cup 84%, person 92%, cat 90% on sample photos)
- ✅ Expressions: ensemble of an aligned-face RAF-DB model and FER+, softened confidence; ⚠️ only checked on one smiling face photo, so test on your own faces
- ✅ Handwriting: own CNN + MNIST model ensemble with shift-averaging; measured numbers are in README "Measured accuracy"
- ✅ "Was the AI right?" check under every result, and a Human vs AI scoreboard (accuracy per tool, biggest mix-ups) on the dashboard and in the report

## Learning activities
- ✅ Six activities present

## Quality
- ✅ Backend pytest: 54 passed · Frontend vitest: 41 passed · production build OK
- ✅ Models pinned by SHA-256 with a verify command
- ⚠️ Browser support beyond Chromium (Safari/Firefox/iOS) not tested

## Deployment
- ✅ API serves built web app (`VISTA_FRONTEND_DIST`), SPA fallback, /api 404 guard
- ❌ Docker image not built here (no Docker daemon); ✅ deployed by the owner on Vercel + Render (API health check verified). Free deployment (Vercel frontend + Render backend): `docs/DEPLOY_FREE.md`. Test the live link on a phone.
- ⚠️ CORS: set `VISTA_CORS_ORIGINS` when frontend and backend are on different hosts

## Privacy
- ✅ No images, face crops or names stored; analytics in memory by default; opt-in local storage keeps labels/counts only
- ⚠️ Confirm school consent and supervision for camera use

## Before the visit
1. Run the whole demo on the real devices and network.
2. Test on a phone over HTTPS: camera permission, rear camera, drawing without scrolling.
3. Try 3+ people in front of the camera and your own handwriting; adjust lighting.
4. Rehearse with `docs/DEMO_GUIDE.md`.
