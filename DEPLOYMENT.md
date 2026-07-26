# Deploying Vyuha Network to Zoho Catalyst

> **✅ Verified live deployment (development env).** The exact working flow is in
> the "Verified deployment" section at the bottom — it corrects a few assumptions
> in the original guide (Docker registration protocol, the `/app/` base path, the
> `404.html` rule, and CORS being owned by the AppSail gateway). Read that first.


This guide deploys the two halves of the app to one Catalyst project:

| Component | Catalyst service | Source |
|---|---|---|
| React/Vite dashboard | **Web Client Hosting** (`client/`) | built from `frontend/` |
| FastAPI backend | **AppSail** (Docker runtime) | `backend/` |
| AI features (OCR, face match, sentiment) | **Catalyst Zia** via `zcatalyst-sdk` | inside the backend |
| Uploaded booking photos | **Stratus** object storage | via the backend |

The research this is based on — with source links and caveats — is in
[`docs/zoho-catalyst-research.md`](docs/zoho-catalyst-research.md). Read the
"Things to verify" section there; a few Catalyst behaviours are console-confirmable
only.

> **Why Docker for the backend?** The API uses native wheels (bcrypt,
> cryptography, reportlab, pydantic-core) that don't vendor cleanly from macOS to
> Catalyst's Linux runtime. The Docker image builds them on Linux. A managed-runtime
> alternative is noted at the end.

---

## 0. Prerequisites

```bash
node --version      # v14+
python3 --version   # 3.10+
npm install -g zcatalyst-cli
catalyst --version
catalyst login      # browser OAuth against your Zoho account
```

Create a Catalyst project in the console (catalyst.zoho.com) — note its **project
name** and **project domain**.

---

## 1. Files already in this repo

The Catalyst scaffolding is committed:

```
Vyuha-Network/
├── catalyst.json                 # registers the client component
├── client/
│   └── client-package.json       # SPA config (404 → index.html)
├── backend/
│   ├── Dockerfile                # AppSail Docker runtime
│   ├── catalyst_server.py        # entrypoint; binds X_ZOHO_CATALYST_LISTEN_PORT
│   ├── app-config.json           # managed-runtime fallback config
│   └── app/…                     # FastAPI app (unchanged routes + new /api/intel)
├── frontend/
│   ├── .env.production.example    # copy → .env.production
│   └── …
└── scripts/build-client.sh       # builds frontend → client/
```

---

## 2. Initialise Catalyst in the repo

From the repo root:

```bash
catalyst init
```

- Associate the project you created in the console.
- When asked which components to set up, choose **Client** (it will detect the
  existing `client/` folder) and **AppSail**.
- For AppSail, either accept the prompts and then adjust, or add it explicitly:

```bash
catalyst appsail:add
```

Answer the AppSail prompts:

| Prompt | Answer |
|---|---|
| Runtime type | **Docker image** (uses `backend/Dockerfile`) |
| Source directory | `backend` |
| App name | `vyuha-api` |
| Build/root path | `backend` |

This registers the AppSail app in `catalyst.json`. (If you pick the **managed
runtime** instead, see §8.)

> ⚠️ The CLI owns the `appsail` block in `catalyst.json` — let it write that,
> don't hand-edit it.

---

## 3. Deploy the backend (AppSail)

```bash
catalyst deploy --only appsail
```

The CLI builds the Docker image, deploys it, and prints the **AppSail URL**, e.g.
`https://vyuha-api-750xxxxxx.development.catalystappsail.com`. **Copy it.**

### Set backend environment variables

In the Catalyst console → AppSail → `vyuha-api` → Configuration → Environment
Variables (or via `app-config.json` `env_variables`):

| Variable | Value | Purpose |
|---|---|---|
| `CORS_ALLOW_ORIGINS` | your client URL (see §5) | let the browser call the API |
| `MOCK_AI_PIPELINE` | `false` | use real Gemini for chat (needs `GEMINI_API_KEY`) — or leave `true` for the built-in mock |
| `GEMINI_API_KEY` | your key | only if `MOCK_AI_PIPELINE=false` |
| `CATALYST_AI_ENABLED` | `true` | turn on Zia OCR / face / sentiment |
| `STRATUS_BUCKET` | `vyuha-offender-photos` | bucket for enrolled photos |
| `AUTO_SEED` | `true` | seed demo data on a fresh instance |
| `DATABASE_URL` | *(optional)* external Postgres URL | durable data — see §7 |

Redeploy after changing env vars (`catalyst deploy --only appsail`), or restart
the app from the console.

Smoke-test:

```bash
curl https://<appsail-url>/api/health
# {"status":"operational", ... ,"catalyst_ai": true}
```

---

## 4. Build the frontend against the backend URL

```bash
cp frontend/.env.production.example frontend/.env.production
```

Edit `frontend/.env.production`:

```ini
VITE_API_BASE_URL=https://vyuha-api-750xxxxxx.development.catalystappsail.com
VITE_CATALYST_AI=true      # false if you didn't enable Zia in §3
```

Build and stage into `client/`:

```bash
./scripts/build-client.sh
```

This runs the Vite production build and copies `frontend/dist/` into `client/`
(keeping `client-package.json`).

---

## 5. Deploy the frontend (Web Client Hosting)

```bash
catalyst deploy --only client
```

The CLI prints the **client URL** (your project domain), e.g.
`https://vyuha-750xxxxxx.development.catalystserverless.com`.

**Now close the CORS loop:** put this client URL into the backend's
`CORS_ALLOW_ORIGINS` (§3) and redeploy the backend. Client → API is cross-origin
on Catalyst, so this is required.

Deploy everything together next time with just:

```bash
catalyst deploy
```

---

## 6. Enable the Catalyst AI (Zia) features

Once `CATALYST_AI_ENABLED=true` and the frontend is built with
`VITE_CATALYST_AI=true`, these light up:

| Feature | Where | Zia service |
|---|---|---|
| **Sentiment + keyword chips** on chat replies | AI Assistant | Text Analytics (`get_sentiment_analysis`, keyword extraction) |
| **Scan document (OCR)** button in the chat composer | AI Assistant | OCR (`extract_optical_characters`) |
| **Search by photo** uses real facial comparison | Offenders → Search by photo | Facial Comparison (`compare_face`) |

Everything degrades gracefully: with the flags off (local dev, or Zia disabled)
the OCR button is hidden, chat shows no chips, and photo search falls back to the
in-browser perceptual matcher. No code path errors when Zia is absent.

### Enrolling booking photos for face search

Face matching (`compare_face`) is **1:1**, so the backend loops it over photos
stored in Stratus under `offenders/{criminal_id}.jpg`. Until you upload real
booking photos there, `/api/intel/face-search` returns `enrolled_photos: 0` and
the UI falls back to the local matcher.

> ⚠️ Zia facial comparison needs **real face photographs** — the app's procedural
> SVG mugshots are synthetic and won't be detected as faces. Enroll actual booking
> photos (via a Stratus upload script or an admin endpoint) to use real biometric
> search. The local perceptual matcher works on the synthetic mugshots for demos.

---

## 7. Data persistence (important)

AppSail is **stateless and auto-scaling** — the container filesystem is
effectively ephemeral, so the bundled **SQLite database resets** on redeploy or
scale-up. `AUTO_SEED=true` re-seeds each fresh instance, which is fine for a demo
but means writes (new chat audit rows, etc.) are not durable or shared across
instances.

For durable, shared data, point the app at an external Postgres:

```
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/vyuha
```

(Add `psycopg[binary]` to `requirements.txt` if you use Postgres.) The SQLAlchemy
models work unchanged. The fully-native option is **Catalyst Data Store** (hosted
relational DB via the SDK) — that would require porting the data layer off
SQLAlchemy and is out of scope here; see the research doc §7.

---

## 8. Alternative: managed Python runtime (no Docker)

If you prefer AppSail's managed runtime over Docker, `backend/app-config.json` is
already provided (`command: python3 -u catalyst_server.py`, `stack: python312`).
The catch: dependencies must be **vendored** into the build directory as
**Linux** wheels. From `backend/`:

```bash
pip install --platform manylinux2014_x86_64 --only-binary=:all: \
  --target . -r requirements.txt
```

then `catalyst appsail:add` choosing **managed runtime / python312**, and
`catalyst deploy`. Docker (§2–3) is recommended because it avoids cross-platform
wheel issues entirely.

> ⚠️ Docs are inconsistent on the config key name (`command` vs
> `startup_command`). If the app doesn't start, set the start command
> `python3 -u catalyst_server.py` in the AppSail console.

---

## 9. One-shot redeploy cheatsheet

```bash
# after backend code changes
catalyst deploy --only appsail

# after frontend changes
./scripts/build-client.sh && catalyst deploy --only client

# everything
./scripts/build-client.sh && catalyst deploy
```

## Demo credentials

`officer` / `officer123` · `admin` / `admin123` · `executive` / `executive123`

---

## Verified deployment (what actually worked)

Deployed to the Catalyst **Development** environment. Corrections vs. the guide
above, in the order they mattered:

### 1. Backend — Docker AppSail (build locally, register by protocol)
`catalyst appsail:add --source <dir>` registers a **managed** runtime, not
Docker. For a Docker app you build the image yourself and register it with a
protocol URI:

```bash
# build for Catalyst's Linux runtime (host is Apple Silicon → cross-build)
cd backend
docker build --platform linux/amd64 -t vyuha-api:latest -t localhost/vyuha-api:latest .

# register the local image (note the docker:// protocol + localhost/ prefix)
cd ..
catalyst appsail:add --name vyuha-api --source "docker://localhost/vyuha-api:latest"
catalyst deploy --only appsail          # prints the AppSail URL
```

The image tag **must** be `localhost/<name>:tag` to match `docker://localhost/…`.
Rebuild + `catalyst deploy --only appsail` to ship changes.

### 2. CORS is handled by the AppSail gateway — the app must NOT add its own
Catalyst's AppSail gateway injects `Access-Control-Allow-Origin` (echoing the
request origin). If the app *also* adds CORS you get two conflicting origin
headers and the browser blocks every call. The Dockerfile sets
`DISABLE_APP_CORS=true`; `app/main.py` skips its CORS middleware whenever it
detects Catalyst (or that flag). Local dev still adds CORS normally.

### 3. Frontend is served under `/app/` → set the Vite base + router basename
Web Client Hosting serves the client at `https://<domain>/app/index.html`, so
absolute `/assets/...` paths 404. `vite.config.ts` uses `base: '/app/'` for
production builds and `main.tsx` passes `basename={import.meta.env.BASE_URL}` to
the router. Local dev stays at `/`.

### 4. The 404 page cannot equal the homepage
Catalyst rejects `"404": "index.html"`. `build-client.sh` copies `index.html` to
`404.html` and `client-package.json` uses `"404": "404.html"` — same bundle, so
the SPA router still handles deep links (verified: refreshing `/app/offenders`
works).

### Full sequence
```bash
# backend
cd backend && docker build --platform linux/amd64 -t vyuha-api:latest -t localhost/vyuha-api:latest . && cd ..
catalyst appsail:add --name vyuha-api --source "docker://localhost/vyuha-api:latest"
catalyst deploy --only appsail            # -> AppSail URL

# frontend (point at the AppSail URL, then build + deploy)
printf 'VITE_API_BASE_URL=<AppSail URL>\nVITE_CATALYST_AI=false\n' > frontend/.env.production
./scripts/build-client.sh
catalyst deploy --only client             # -> client URL (…/app/index.html)
```

To enable Catalyst Zia AI later: set `CATALYST_AI_ENABLED=true` in the Dockerfile
`ENV` (rebuild + redeploy backend) and `VITE_CATALYST_AI=true` in
`frontend/.env.production` (rebuild + redeploy client).
