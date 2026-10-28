# Deploy VistaVision for free (Hugging Face Spaces)

**Why Hugging Face Spaces:** free, no credit card, 2 CPU cores and 16 GB RAM (VistaVision peaks at about 300 MB), and it gives you a public **HTTPS** address, which phones need for the camera. One container serves both the web app and the AI. The project is already set up for it (`Dockerfile` and the header at the top of `README.md`).

> Not tested here: I could not run Docker or create an account in my environment, so the Space build itself is untested. The same code was tested locally serving the built website and AI from one server. If the build fails, the **Logs** tab shows exactly which line, and the fixes below cover the likely causes.

## Steps (about 10 minutes, no command line needed)

1. Make a free account at <https://huggingface.co/join>.
2. Click your profile picture → **New Space**.
   - Name: `vistavision`
   - SDK: **Docker** → template **Blank**
   - Hardware: **CPU basic · 2 vCPU · 16 GB · Free**
   - Visibility: **Public** (the camera and the QR code for phones need the public link; choose Private only for a private test)
3. Unzip `VistaVision.zip` on your computer. Open the folder `VistaVision` so you can see `Dockerfile`, `README.md`, `backend`, `frontend`, `docs`.
4. In the Space, open **Files → Add file → Upload files**. Drag in **everything inside** the `VistaVision` folder (so that `Dockerfile` and `README.md` are at the top level of the Space, not inside another folder). Press **Commit changes to main**.
5. The Space starts **Building**. Wait 5–10 minutes (it downloads the AI models during the build). Open the **Logs** tab if you want to watch.
6. When it says **Running**, open the Space. For the best experience (camera!) use the direct address: `https://YOUR-NAME-vistavision.hf.space`. You can find it under the ⋮ menu → **Embed this Space → Direct URL**.
7. Check <https://YOUR-NAME-vistavision.hf.space/api/health>: it should show `"status": "ok"`.
8. Open the direct address on a phone, allow the camera, and run through `docs/CHECKLIST.md`.

Using git instead: `git clone https://huggingface.co/spaces/YOUR-NAME/vistavision`, copy the project files in, then `git add . && git commit -m "VistaVision" && git push`.

## Things to know about the free tier

- **It sleeps** after about 2 days without visitors and wakes up (about a minute) when someone opens the link. Open it 5 minutes before your demo.
- **Speed:** free CPUs are slower than a laptop, so a face or object analysis may take about 0.5–2 seconds. The server loads the AI models in the background when it starts, so the first student should not wait long.
- **Everyone with the link can use it.** Photos are analysed in memory and not stored, but tell students not to type personal information into the chart fields.
- **Session data lives in each person's own browser tab**, not on the server, so many students can use it at once without mixing their charts.
- The page is shown inside Hugging Face's frame if you use the normal Space address. Some browsers block the camera in frames, so always use the **direct `.hf.space` address** for the camera.

## If the build or the app fails

| What you see | Fix |
|---|---|
| Build error on `npm ci` | Make sure `frontend/package-lock.json` was uploaded (it must be in the folder). |
| Build error on `python -m app.models.download` | A temporary network problem. Click ⋮ → **Factory rebuild**. |
| "Application startup failed" / cannot find `dist` | Upload the whole `frontend` folder, then rebuild. |
| Page opens but results say "Cannot reach the server" | Open **Settings** in the app and clear the server address so it is empty (same address as the page). |
| Camera does nothing | Use the direct `https://….hf.space` address, not the huggingface.co page. |

## Other free options

- **Render** (free web service): needs a GitHub account; the free plan has 512 MB RAM (enough, the app uses about 300 MB) but it sleeps after 15 minutes and wakes slowly. Choose *New Web Service → Docker* and point it at the repository.
- **Your own laptop at school:** run the app on the demo laptop (`localhost` allows the camera without HTTPS) and show it on the projector. This is the most reliable choice if the school Wi-Fi is unpredictable.
