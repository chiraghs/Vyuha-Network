# Vyuha Network — AI-Driven Crime Analytics & Visualization Platform
*Karnataka State Police (KSP) · State Crime Records Bureau (SCRB) decision-support suite*

Vyuha Network turns fragmented FIR records into actionable intelligence. It gives
investigators and the SCRB interactive dashboards, geospatial hotspot maps,
district drilldowns, criminal link analysis, predictive recidivism scoring, and a
bilingual (English / **ಕನ್ನಡ**) AI assistant — all over the **official Karnataka
Police FIR database schema**.

Built on and **deployed to Zoho Catalyst** (AppSail + Web Client Hosting), with
Catalyst AI (Zia OCR, GLM chat) wired in.

> **Live (Catalyst development env)**
> - App: `https://vyuha-network-60080167463.development.catalystserverless.in/app/index.html`
> - API: `https://vyuha-api-50044361539.development.catalystappsail.in`
> - Developer console: `…/app/admin`
> - Logins: `officer / officer123` · `admin / admin123` · `executive / executive123`

---

## Key features

- **Command overview** — SQL-aggregated KPIs, weekly incident trend, gravity split
  (Heinous vs non-heinous), case-status pipeline, district pressure, crime-head volumes.
- **Geospatial hotspots** — Karnataka-only Leaflet map (rest of the map masked),
  incident + density layers, district polygons, click-a-district to filter/zoom,
  and a full FIR case drawer (CrimeNo, gravity, acts & sections, IO, court,
  chargesheet outcome, complainant profile).
- **Criminal link analysis** — canvas force-graph inferred from co-accused
  relationships; hub detection, risk-banded nodes, zoom-to-spread, AI risk panel.
- **Offender registry & dossiers** — identity-resolved from accused records,
  paginated, predictive recidivism scoring; printable per-offender dossier (crime
  history, arrests, chargesheets, crime-head breakdown, acts, associates).
- **Correlation analytics** — complainant occupation × crime-head and community ×
  crime-head, with auto-generated analyst notes.
- **Bilingual AI assistant** — chat grounded in the live FIR DB, real LLM
  responses, sentiment/keyword enrichment, hash-verified audit ledger, PDF export,
  and a Zia-OCR "scan document" intake.
- **Full Kannada / English UI** — a topbar toggle (`EN | ಕನ್ನಡ`) switches the whole
  interface; the choice persists.
- **Developer console (`/admin`)** — admin-gated: live metrics (API/AI/OCR calls),
  runtime environment editor (set keys without redeploying), and a log tail.
- **Light / dark themes** throughout.

## Operational Opportunities & Impact

### 📈 Command Overview Page (Strategic Oversight)
*   **Operational Opportunity**: **Instant Executive Oversight & Performance Tracking**
*   **The Value**: Instead of spending days consolidating physical ledgers and spreadsheets across 1100+ stations, police leaders get an immediate visual health report of state-level security.
*   **Real-World Impact**: Enables command staff to identify crime spikes, track station case resolution throughput, and adjust regional deployments immediately.

### 🗺️ Geospatial Hotspot Map (Tactical Navigation)
*   **Operational Opportunity**: **Proactive Patrol Routing & Resource Placement**
*   **The Value**: Replaces legacy text address lists with a live, zoomable crime-density map showing crime hotbeds, search filters, and case details.
*   **Real-World Impact**: Allows precinct planners to direct patrol cars to active risk zones, preventing offenses before they occur and decreasing local emergency response times.

### 🕸️ Criminal Link Analysis (Accomplice Graph)
*   **Operational Opportunity**: **Dismantling Syndicates & Intercepting Ring Leaders**
*   **The Value**: Exposes hidden networks of accomplices by mapping co-arrest records visually. Flags core "hubs" (repeat offenders linking separate gangs) and maps recidivism risks.
*   **Real-World Impact**: Empowers investigators to dismantle entire crime networks rather than making isolated arrests.

### 📊 Correlation & Demographic Analytics (Community Policing)
*   **Operational Opportunity**: **Targeted Crime Prevention & Local Interventions**
*   **The Value**: Maps offense trends against demographics (e.g. complainant occupation or local district metrics).
*   **Real-World Impact**: Directs municipal and social support programs directly to high-risk zones, addressing root causes of crime like youth unemployment.

### 🗣️ Bilingual AI Assistant (Voice Command)
*   **Operational Opportunity**: **Democratizing Investigation Access for Field Staff**
*   **The Value**: Direct voice query support in spoken Kannada or English (e.g. *"Show me recent homicides near Bengaluru"*).
*   **Real-World Impact**: Saves hours of database lookups, giving every beat officer instant, voice-activated access to case records in their native language.

---

## Architecture

```mermaid
flowchart TD
    subgraph Client["Web Client Hosting (Catalyst)"]
        SPA["React + Vite SPA (/app) · EN/ಕನ್ನಡ"]
    end
    subgraph AppSail["AppSail (Docker · FastAPI)"]
        API["FastAPI · JWT auth · paginated + SQL-aggregated API"]
        OBS["Observability (metrics + log buffer) → /admin"]
    end
    subgraph Fn["Catalyst Functions"]
        ZIA["catalyst-zia-services (Zia OCR CodeLib)"]
    end
    subgraph AI["AI chain (primary → fallback)"]
        GLM["Catalyst QuickML GLM"]
        GROQ["Groq (open Llama models)"]
        MOCK["Heuristic mock"]
    end
    subgraph DB["Data"]
        PG[("PostgreSQL (DATABASE_URL)")]
        SQLITE[("SQLite (local/dev default)")]
    end

    SPA -->|/api · CORS| API
    API --> OBS
    API -->|document OCR| ZIA
    API -->|chat / risk / translate| GLM
    GLM -->|on failure| GROQ
    GROQ -->|on failure| MOCK
    API --> PG
    API --> SQLITE
```

---

## Process Flow & Use-Case Diagram

```mermaid
flowchart TD
    subgraph Users["User Personas"]
        INV["Investigator (Field Officer)"]
        EXEC["SCRB Executive (Command Staff)"]
    end

    subgraph Ingest["1. Data Ingestion & Intake"]
        VOICE["Kannada / English Voice Input"]
        TEXT["Text Query Input"]
        DOCS["BYOD Ingest (PDF / TXT upload)"]
    end

    subgraph Proc["2. Processing & Analysis Layer"]
        STT["Zia / Whisper STT Transcription"]
        TRANS["Bilingual Translation Bridge"]
        EXTR["pypdf Text Extraction"]
        DB_QUERY["ACID Database Query"]
        AI_QUERY["AI Chain (GLM / Groq / Gemini)"]
    end

    subgraph Out["3. Visual & Audit Outputs"]
        MAP["Geospatial Hotspots & GIS Map"]
        NET["Criminal Network Accomplice Graph"]
        CHAT["Explainable AI Answers & Advisories"]
        PDF["ReportLab signed PDF Log Export"]
        LEDGER["SHA-256 Cryptographic Log Verification"]
    end

    INV --> VOICE
    INV --> TEXT
    INV --> DOCS
    EXEC --> TEXT

    VOICE --> STT --> TRANS --> AI_QUERY
    TEXT --> TRANS --> AI_QUERY
    DOCS --> EXTR --> AI_QUERY

    AI_QUERY --> DB_QUERY
    DB_QUERY --> MAP
    DB_QUERY --> NET
    AI_QUERY --> CHAT
    CHAT --> LEDGER
    CHAT --> PDF
```

### AI chain (`backend/app/services/ai_service.py`)

Selection is a graceful chain — each tier falls back to the next on any error:

1. **Catalyst QuickML GLM** (primary) — set `CATALYST_AI_TOKEN`.
2. **Groq** (OpenAI-compatible, free open models) — set `FALLBACK_AI_*`.
3. **Gemini** — legacy, if `GEMINI_API_KEY` and mock not forced.
4. **Heuristic mock** — zero-config default.

JSON parsing tolerates code fences and `<think>` reasoning blocks. Keys are set at
runtime via the `/admin` console (or the Catalyst console) — never committed.

### Catalyst AI features

- **Zia OCR** — installed as a Catalyst Function via the Zia Services CodeLib; the
  backend calls it server-to-server so the secret never reaches the browser.
- **Catalyst GLM** — the primary chat/analysis model (see chain above).

---

## Data model — official Karnataka Police FIR schema

The backend implements the full FIR ER schema (see
[`docs/fir-schema.md`](docs/fir-schema.md)) — ~25 tables including:

- **CaseMaster** — the FIR, with the 18-digit structured `CrimeNo`
  (`category + district + unit + year + serial`), gravity, crime head/sub-head,
  status, court, lat/long, brief facts.
- **People** — `ComplainantDetails`, `Victim`, `Accused` (+ `ArrestSurrender` and
  the `inv_arrestsurrenderaccused` junction).
- **Legal** — `Act`, `Section`, `ActSectionAssociation`; **classification** —
  `CrimeHead`, `CrimeSubHead`; **outcome** — `ChargesheetDetails`.
- **Org / geography** — `Employee`, `Unit`, `UnitType`, `Court`, `District`,
  `State`, `Rank`, `Designation`, and lookups (Caste/Religion/Occupation,
  CaseCategory, GravityOffence, CaseStatusMaster).

Offenders and the criminal network are **inferred** (there is no global person
table in the schema): accused are resolved across cases by a stable key, and the
network is built from co-accused on shared cases.

**Persistence:** SQLite is the zero-config local default; set `DATABASE_URL` to a
Postgres instance for durable, shared data (verified — the app is Postgres-ready,
with dialect-aware queries). AppSail is stateless, so a bundled SQLite reseeds on
redeploy; `AUTO_SEED` is idempotent.

---

## Directory structure

```
Vyuha-Network/
├── README.md
├── DEPLOYMENT.md              # Zoho Catalyst deploy guide (verified)
├── catalyst.json             # client + appsail + functions
├── docs/
│   ├── fir-schema.md         # official FIR ER schema (implemented)
│   ├── zoho-catalyst-research.md
│   └── screenshots/
├── client/                   # Web Client Hosting (built SPA + client-package.json)
├── functions/
│   └── catalyst-zia-services/  # Zia OCR CodeLib (Catalyst Function)
├── scripts/build-client.sh   # build frontend → client/
├── backend/                  # FastAPI (AppSail, Docker)
│   ├── Dockerfile
│   ├── catalyst_server.py    # entrypoint; binds X_ZOHO_CATALYST_LISTEN_PORT
│   ├── app/
│   │   ├── main.py           # app, CORS, metrics middleware, startup seed
│   │   ├── db/models.py      # full FIR schema (SQLAlchemy)
│   │   ├── api/              # auth, analytics, network, chat, intel, admin
│   │   ├── services/         # ai_service, catalyst_ai, offender_analytics,
│   │   │                     #   network_service, observability, pdf_service
│   │   └── scripts/seed_data.py
│   └── requirements.txt
└── frontend/                 # Vite + React + TypeScript
    └── src/
        ├── App.tsx           # routes (incl. self-gated /admin)
        ├── context/          # Auth, Theme, Language (EN/ಕನ್ನಡ)
        ├── lib/i18n.ts       # bilingual UI strings
        ├── components/       # ui/, layout/, charts/
        └── features/         # dashboard, map, network, analytics,
                              #   offenders, assistant, admin, auth
```

---

## Local setup

### Backend (Python 3.12)

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt

# seed the local SQLite DB (idempotent)
cd backend && ../backend/.venv/bin/python -m app.scripts.seed_data

# run the API
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Zero-config: falls back to `sqlite:///./vyuha_crime.db` and the heuristic mock AI.
To enable real AI locally, export `FALLBACK_AI_API_KEYS` (a free Groq key) or
`CATALYST_AI_TOKEN`; for Postgres, set `DATABASE_URL`.

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api → :8000)
```

---

## Deploying to Zoho Catalyst

Full, verified walkthrough in **[DEPLOYMENT.md](DEPLOYMENT.md)**. In short:

```bash
npm install -g zcatalyst-cli && catalyst login && catalyst init

# backend → AppSail (Docker)
cd backend && docker build --platform linux/amd64 -t vyuha-api:latest -t localhost/vyuha-api:latest . && cd ..
catalyst appsail:add --name vyuha-api --source "docker://localhost/vyuha-api:latest"
catalyst deploy --only appsail

# Zia OCR CodeLib (Catalyst Function)
catalyst codelib:install https://github.com/catalystbyzoho/codelib-zia-services
catalyst deploy --only functions

# frontend → Web Client Hosting (served under /app)
printf 'VITE_API_BASE_URL=<AppSail URL>\nVITE_CATALYST_AI=true\n' > frontend/.env.production
./scripts/build-client.sh && catalyst deploy --only client
```

Set runtime config (AI/OCR keys, `DATABASE_URL`) in **`/admin` → Environment** or
the Catalyst console — secrets are never committed or baked into the image.

---

## Quality checks

- **Frontend:** `npm run typecheck` · `npm run lint` · `npm run build` (in `frontend/`)
- **Backend:** `pytest` · `black --check app/` · `flake8 app/` · `mypy app/` (in `backend/`)
