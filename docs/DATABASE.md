# Saving records (SQLite database)

VistaVision saves the **structured records** of a session (labels, counts, game rounds, "was the AI right?" checks) in a small SQLite database on the backend, so the Data Visualization page is still full after a refresh. **Images are never stored.**

## How it works
- The browser creates a random workspace code on first visit (`localStorage` key `vistavision.clientId`). There are no names, e-mails or logins. Anyone who knows the code could read that workspace, so treat it as private.
- The page loads its records from `GET /api/store/{code}` and sends changes (debounced, only what changed) to `POST /api/store/{code}/sync`. `DELETE /api/store/{code}` erases the workspace (Settings → "Delete my saved records from the server", and "Reset session").
- Sample data is never saved. Duplicates are impossible: every record has an id and a dedupe key (a game round is stored once).
- If the database is unavailable the site keeps working; the Settings page says so, and `/api/health` shows `storage.enabled: false`.
- Limits: 20,000 records per workspace, 8 KB per record. Workspaces not opened for 90 days are deleted on server start.
- Per browser: another device or browser has a different code, so it sees different records.

## Configuration
| Variable | Default | Meaning |
|---|---|---|
| `VISTA_DB_PATH` | `backend/data/vistavision.db` (Docker: `/srv/data/vistavision.db`) | SQLite file location |

## Important: Render free plan
Render's free web service has a **temporary disk**. The database file is lost whenever the service redeploys or restarts (this includes the restart after it sleeps for a long time on some occasions and every new deploy). Records survive a page refresh and normal use, but not a redeploy.
To keep them permanently, add a **Persistent Disk** (paid Render feature) mounted at `/srv/data`; the Docker image already writes there. Alternatively move to a hosted database later (the store is isolated in `backend/app/services/record_store.py`).
