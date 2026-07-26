# Zoho Catalyst — Deployment & AI Research Report

_Compiled 2026-07-26. Sources are official `docs.catalyst.zoho.com` / `catalyst.zoho.com` (2025/2026 docs). Items marked **⚠️** are ambiguous in the docs or inferred — verify at deploy time._

This report backs the Vyuha Network deployment plan (see [`../DEPLOYMENT.md`](../DEPLOYMENT.md)).

---

## 1. CLI: install, login, init

**Install** (Node.js v14+; `sudo` may be needed on macOS/Linux; Python 3.10+ with Pip for Python components):

```bash
npm install -g zcatalyst-cli      # or: yarn add zcatalyst-cli
catalyst --version
```

**Login / init:**

```bash
catalyst login          # browser OAuth against your Zoho account
catalyst init           # run inside the project directory
```

`catalyst init` associates a Catalyst project from your org and lets you select components (Functions, AppSail, Client / Web Client Hosting, …). It always writes `catalyst.json` at the project root.
**⚠️** If a folder already has a Catalyst project from another account, delete all Catalyst files including the hidden `.catalystrc` before re-running `catalyst init`.

**Top-level `catalyst.json`:**

```json
{
    "functions": {
        "source": "functions",
        "targets": ["fn", "sendemail", "mynode"],
        "ignore": [".output"]
    },
    "client": {
        "source": "client"
    }
}
```

Keys: `functions.source`, `functions.targets`, `functions.ignore`, `client.source`. AppSail entries are registered here when you add an AppSail service. Two CLI styles exist: bare `catalyst init` and namespaced commands like `catalyst appsail:add`.

Sources: [Install CLI](https://docs.catalyst.zoho.com/en/getting-started/installing-catalyst-cli/), [catalyst.json](https://docs.catalyst.zoho.com/en/cli/v1/project-directory-structure/catalyst-json/), [CLI FAQ](https://docs.catalyst.zoho.com/en/faq/cli/)

---

## 2. Hosting a Python web app — AppSail

**AppSail supports Python** as a first-class Catalyst-managed runtime.

- **Supported Python versions:** 3.13, 3.12, 3.11, 3.10 (stack strings like `"python312"`). Also Node 16–24, Java 8–25.
- **WSGI vs ASGI — gotcha:** AppSail does **not** ask for a WSGI/ASGI entrypoint. It runs your **startup command**, and your process must listen on an HTTP port. Every official Python example (Flask, Tornado, CherryPy) self-hosts via `python3 -u app.py`. No Gunicorn/Uvicorn requirement — but you may use them.
- **Port binding:** Catalyst injects the port via **`X_ZOHO_CATALYST_LISTEN_PORT`** (default 9000). Bind `0.0.0.0`:
  ```python
  listen_port = int(os.getenv('X_ZOHO_CATALYST_LISTEN_PORT', 9000))
  ```
- **Startup command:** in `app-config.json` under key **`command`** (some pages call it `startup_command` — **⚠️** inconsistent; set it in the console after deploy if unsure). AppSail runs the command **without a shell**, so `${VAR}` expansion in the command fails unless wrapped: `sh -c '... ${X_ZOHO_CATALYST_LISTEN_PORT}'`. Cleanest: read the env var inside Python and use a fixed command `python3 -u main.py`.
- **Dependencies (managed runtime):** no auto `pip install`; you **vendor deps into the build directory**:
  ```bash
  python3 -m pip install fastapi uvicorn -t .
  python3 -m pip install --pre zcatalyst-sdk -t .
  ```
- **`catalyst appsail:add` prompts:** managed-runtime vs Docker image → sample? → source dir → app name → build path → stack/runtime. Creates `app-config.json` in the source dir and registers the app in `catalyst.json`.
- **⚠️ Docker-image AppSail** is also supported (any OCI image) — config lives in `catalyst.json`, no `app-config.json`.

**Recommended FastAPI layout (programmatic uvicorn):**

```
fastapi-app/
├── main.py
├── app-config.json
├── requirements.txt          # reference only; not auto-installed
├── fastapi/ uvicorn/ starlette/ zcatalyst_sdk/   # vendored deps (managed runtime)
```

```python
# main.py
import os
from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def root():
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", 9000))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

```json
// app-config.json
{
  "command": "python3 -u main.py",
  "stack": "python312",
  "memory": 512,
  "env_variables": {}
}
```

Other `app-config.json` keys: `buildPath`, `platform` (Java only), `scripts` (predeploy/preserve). Default disk ~256 MB; default port 9000.

**Deploy:** `catalyst deploy` (or `catalyst deploy --only appsail`). CLI prints the endpoint URL.

Sources: [Managed runtimes](https://docs.catalyst.zoho.com/en/serverless/help/appsail/catalyst-managed-runtimes/key-concepts/), [AppSail configurations](https://docs.catalyst.zoho.com/en/serverless/help/appsail/appsail-configurations/), [Flask guide](https://docs.catalyst.zoho.com/en/serverless/help/appsail/help-guides/python/flask/), [Tornado guide](https://docs.catalyst.zoho.com/en/serverless/help/appsail/help-guides/python/tornado/), [appsail:add](https://docs.catalyst.zoho.com/en/cli/v1/add-appsail/), [AppSail intro](https://docs.catalyst.zoho.com/en/serverless/help/appsail/introduction/)

---

## 3. Static frontend — Web Client Hosting

Host a Vite/React SPA build via the **Client** component. `catalyst init` (choose Client) creates a `client/` directory. Put **built** static files (Vite `dist/` output) into the client source folder with a `client-package.json` **at its root** (never in subfolders):

```json
{
  "name": "vyuha-frontend",
  "version": "0.0.1",
  "homepage": "index.html",
  "login_redirect": "home.html",
  "404": "index.html"
}
```

Keys: `name` (immutable after deploy), `version` (decimal, only incrementable), `homepage` (entry file), `login_redirect` (optional), `404` (optional error page), `description` (optional).

**SPA routing:** **⚠️** Catalyst has **no rewrite/wildcard array** (unlike Firebase/Netlify). The documented mechanism is the **404 fallback** — set `"404": "index.html"` so unmatched paths serve the SPA and the client router takes over. Confirm after deploy.

**Client + backend in one project:** one Catalyst project holds both `client/` and the AppSail app dir, both in `catalyst.json`. Deploy together with `catalyst deploy`.

Sources: [Web Client Hosting intro](https://docs.catalyst.zoho.com/en/cloud-scale/help/web-client-hosting/introduction/), [Client directory](https://docs.catalyst.zoho.com/en/cli/v1/project-directory-structure/client-directory/), [Configure client](https://docs.catalyst.zoho.com/en/tutorials/react/nodejs/configure-client/)

---

## 4. Routing between client and backend

**⚠️ Biggest ambiguity / likely gotcha.** Docs do **not** describe a built-in reverse proxy mapping `/api/...` on the client domain to AppSail.

- **Project domain:** `https://<project-domain>.catalystserverless.com` (older `zohocatalyst.com` deprecated). Development env URLs contain a `development` segment; production URLs drop it.
- **Web Client Hosting** is served under the project domain.
- **AppSail** gets its **own auto-generated URL** (a `catalystappsail` domain); you can edit the service name/subdomain and optionally map a **custom domain**.

So by default **client and AppSail are separate origins**. Options:
1. Point the React app at the full AppSail URL and **enable CORS** in FastAPI.
2. Map **custom domains** so both live under your own domain and front them with your own routing.

No official same-project "`/api` → AppSail" rewrite was found. Treat cross-origin (CORS) as the default. **⚠️** Verify against the [AppSail Console overview](https://docs.catalyst.zoho.com/en/serverless/help/appsail/console/overview/).

Sources: [Deploy AppSail](https://docs.catalyst.zoho.com/en/cli/v1/deploy-resources/deploy-appsail/), [CLI release notes](https://docs.catalyst.zoho.com/en/release-notes/cli/), [AppSail intro](https://docs.catalyst.zoho.com/en/serverless/help/appsail/introduction/)

---

## 5. Auth — keeping your own FastAPI JWT

Yes. AppSail runs your process as an ordinary web server, so **your own JWT auth works normally** — Catalyst does not force Embedded Authentication on an AppSail app. Catalyst's Authentication (Embedded Auth / IAM) is optional and mainly integrates with Web Client Hosting + Functions.

**Gotchas:**
- **CORS:** client and AppSail are separate origins → add `CORSMiddleware` allowing your client origin; with cookies set `allow_credentials=True` + explicit origins (not `*`).
- **Embedded Auth conflict:** if you enable Catalyst Embedded Auth on the client, its IAM flow is separate from your JWT — don't mix on the same routes. Keep the API stateless (Bearer tokens).
- **⚠️** Docs don't detail CORS for AppSail specifically; handle CORS in app code, not Catalyst config.

Source: [Embedded Auth Python tutorial](https://docs.catalyst.zoho.com/en/tutorials/embedded-auth/python/init-project/)

---

## 6. Catalyst AI — Zia Services (Python SDK)

All via `zcatalyst-sdk`. Pattern: `app = zcatalyst_sdk.initialize()` then `zia = app.zia()`. Also available as REST + Java/Node SDKs. Uploaded files are processed and **not retained** by Catalyst.

```python
import zcatalyst_sdk
app = zcatalyst_sdk.initialize()
zia = app.zia()
```

### a) Face — match uploaded photo vs stored faces
**Facial Comparison** (`compare_face`), part of Identity Scanner / E-KYC — **1:1 comparison**:

```python
res = zia.compare_face(open("uploaded.jpg","rb"), open("stored.jpg","rb"))
# -> {"confidence": 0.9464, "matched": "true"}   # matched when confidence > 0.5
```

Formats .webp/.jpeg/.png, ≤10 MB. **⚠️** No native 1:N face-search index / embeddings — to search many stored faces, **loop `compare_face`** over candidates or precompute.

**Face Analytics** (`analyse_face`) — detects up to 10 faces, returns boxes/landmarks/age/emotion/gender (analysis, not matching):

```python
res = zia.analyse_face(open("img.jpg","rb"), {"mode":"moderate","age":True,"emotion":True})
```

### b) OCR — `extract_optical_characters`
```python
res = zia.extract_optical_characters(open("doc.png","rb"), {"language":"eng","modelType":"OCR"})
# -> {"confidence": 95, "text": "..."}
```
9 international + 10 Indian languages; ≤20 MB; jpg/png/tiff/bmp/pdf.

### c) Object detection — `detect_object`
```python
res = zia.detect_object(open("img.jpg","rb"))
# -> {"objects":[{"co_ordinates":[...],"object_type":"person","confidence":"99.82"}]}
```
**Image Moderation** is a separate Zia service in the same SDK (**⚠️** exact Python method name not captured — verify on the [Image Moderation page](https://docs.catalyst.zoho.com/en/sdk/python/v1/zia-services/)).

### d) NLP / Text Analytics — `app.zia()`
- Sentiment: `get_sentiment_analysis(text_list, keyword_list)` → `document_sentiment` (Positive/Negative/Neutral), `sentence_analytics`, `overall_score` (0–1). Max 1500 chars.
- NER: `/zia-services/text-analytics/named-entity-recognition/`
- Keyword extraction: `/zia-services/text-analytics/keyword-extraction/`
- **⚠️** Exact NER/keyword Python method names not captured — confirm on those pages.

### e) QuickML / AutoML
No-code ML pipeline builder. Train in the console, **publish a model as an endpoint**, then call it from the SDK with input data → prediction. Supports classification/regression/ensemble. ([QuickML SDK](https://docs.catalyst.zoho.com/en/quickml/))

**Other Zia:** Barcode Scanner, Identity Scanner (Aadhaar/PAN/Passbook/Cheque).

Sources: [Python SDK overview](https://docs.catalyst.zoho.com/en/sdk/python/v1/overview/), [Facial Comparison](https://docs.catalyst.zoho.com/en/sdk/python/v1/zia-services/identity-scanner/facial-comparison/), [Face Analytics](https://docs.catalyst.zoho.com/en/sdk/python/v1/zia-services/face-analytics/), [OCR](https://docs.catalyst.zoho.com/en/sdk/python/v1/zia-services/ocr/), [Object Recognition](https://docs.catalyst.zoho.com/en/sdk/python/v1/zia-services/object-recognition/), [Sentiment](https://docs.catalyst.zoho.com/en/sdk/python/v1/zia-services/text-analytics/sentiment-analysis/), [QuickML](https://docs.catalyst.zoho.com/en/quickml/)

---

## 7. Data store — SQLite persistence

**AppSail is stateless and auto-scaling.** **⚠️** Docs don't say "ephemeral filesystem" verbatim, but the architecture (auto-scaled instances, zip/image deploy, ~256 MB disk) means **local SQLite will not reliably persist** across scaling/redeploys and is not shared across instances. **Do not rely on SQLite-on-local-file for durable data.**

Persistent options (Python SDK + REST):
- **Catalyst Data Store** — hosted **relational (SQL)** DB; closest drop-in for a relational schema. `app.datastore().table('Users')` → CRUD/bulk.
- **Catalyst NoSQL** — managed non-relational store.
- **Cache** (`app.cache()`) — in-memory ephemeral.

Or run an **external managed Postgres** and connect via `DATABASE_URL` (least code change for SQLAlchemy).

```python
ds = app.datastore()
table = ds.table('Users')
```

Sources: [Data Store intro](https://docs.catalyst.zoho.com/en/cloud-scale/help/data-store/introduction/), [NoSQL intro](https://docs.catalyst.zoho.com/en/cloud-scale/help/nosql/introduction/), [Data Store Python SDK](https://docs.catalyst.zoho.com/en/sdk/python/v1/cloud-scale/data-store/get-component-instance/)

---

## 8. File / object storage — Stratus

**Stratus** (S3-like object storage; buckets + objects) for uploaded images:

```python
import zcatalyst_sdk
app = zcatalyst_sdk.initialize()
bucket = app.stratus().bucket('vyuha-images')

with open('upload.jpg', 'rb') as f:
    bucket.put_object(
        'faces/user123.jpg', f,
        {'overwrite': 'true', 'content_type': 'image/jpeg', 'ttl': '300'}
    )
```

Supports stream/string uploads, `overwrite`/`ttl`/`meta_data`/`content_type`, and multipart/transfer-manager for large files. **⚠️** Object-path chars disallowed: space, `"`, `<`, `>`, `#`, `\`, `|`. No versioning unless bucket versioning is enabled.

An older **File Store** component exists; Stratus is the newer, recommended object storage.

Sources: [Stratus upload (Python)](https://docs.catalyst.zoho.com/en/sdk/python/v1/cloud-scale/stratus/upload-object/), [Stratus overview](https://docs.catalyst.zoho.com/en/sdk/python/v1/cloud-scale/stratus/overview/), [File Store](https://docs.catalyst.zoho.com/en/cloud-scale/help/file-store/introduction/)

---

## Things to verify before committing

1. **`command` vs `startup_command`** key in `app-config.json` — docs inconsistent. Safest: set the startup command in the AppSail console after first deploy.
2. **No shell in the run command** — read `X_ZOHO_CATALYST_LISTEN_PORT` inside Python; don't rely on `${VAR}` expansion (or wrap with `sh -c '...'`).
3. **FastAPI/ASGI is not an official example** — self-host uvicorn programmatically from `main.py`; ensure uvicorn is vendored (managed runtime) or installed (Docker).
4. **Client ↔ AppSail is cross-origin by default** — no confirmed `/api` reverse-proxy. Plan for CORS or custom-domain mapping.
5. **SPA routing** relies on `404 → index.html`; no rewrites array.
6. **SQLite won't persist on AppSail** — use Data Store / external Postgres / NoSQL / Stratus.
7. **Face matching is 1:1** (`compare_face`) — no native 1:N search; loop or precompute.
8. **Image Moderation / NER / keyword-extraction** exact Python method names — verify on their SDK pages.
9. **Native deps** (bcrypt, cryptography, reportlab, pydantic-core) don't vendor cleanly from macOS → Linux. Prefer **Docker AppSail**, or vendor with `pip install --platform manylinux2014_x86_64 --only-binary=:all: -t .`.
