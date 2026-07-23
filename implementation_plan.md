# Implementation Plan: Vyuha Network (AI-Driven Crime Analytics & Conversational AI Platform)

This document details the software architecture, database schemas, API endpoints, user interfaces, and verification plans for the Vyuha Network platform.

---

## 📢 Goal Description
Develop a modern decision-support system for the Karnataka State Police (SCRB) that aggregates records from 1100+ police stations into an actionable intelligence suite. The project is split into two phases:
*   **Phase 1**: Real-time geospatial hotspot tracking, repeat offender indexing, predictive risk scoring, socio-economic crime correlation, and criminal network analysis.
*   **Phase 2**: Conversational AI (English & Kannada) with voice input, context-aware memory, PDF report generation, and role-based access control.

---

## ⚠️ User Review Required

> [!IMPORTANT]
> **Data Privacy & AI Guidelines**: Police database interactions will use strict role-based access control (RBAC). Natural language queries will be audited via ledger logs. All LLM responses will include reference lists mapping back to database crime IDs for explainable audit trails.

---

## ❓ Open Questions

> [!NOTE]
> 1. **Data Seeding**: Do you want us to seed a highly detailed mock dataset representing districts, police stations (1100+), criminals, and historical crime records of Karnataka? *(We plan to build a comprehensive seed script that pre-populates these structures for demonstration).*
> 2. **Kannada Speech-to-Text**: Can we use the standard Gemini Multimodal Audio API (or Google Cloud Speech-to-Text v2 API) for transcription? *(We recommend Gemini Flash's native audio ingest as it handles Kannada voice notes and accents with high accuracy).*

---

## 📐 System Architecture

The following diagram shows the data flow from clients to the backend database, Google Gemini, and analytical storage:

```mermaid
flowchart TD
    subgraph "Clients & Gateways"
        Officer["Investigator Portal"]
        Admin["SCRB Admin Dashboard"]
        Gateway["Nginx Gateway / Reverse Proxy"]
    end

    subgraph "FastAPI Backend Pool"
        API["FastAPI App Server"]
    end

    subgraph "Caching & Session Store"
        RedisCache[("Redis Session & Token Bucket Cache")]
    end

    subgraph "AI Services (Google AI / Vertex)"
        Gemini["Gemini 2.5 Flash / Pro API"]
        STT["Google Speech-to-Text API"]
        TTS["Google Text-to-Speech API"]
    end

    subgraph "Databases (OLTP / OLAP)"
        Postgres[("Google Cloud SQL / Postgres (OLTP)")]
        BigQuery[("Google BigQuery Workspace (OLAP)")]
    end

    Officer -->|HTTPS / WSS| Gateway
    Admin -->|HTTPS / WSS| Gateway
    Gateway --> API
    API -->|Validate Limits| RedisCache
    API -->|Query Context & Transcribe| Gemini
    API -->|Synthesize Responses| TTS
    API -->|Perform Text-to-Speech| STT
    API -->|Relational Queries| Postgres
    Postgres <---|BigQuery External Queries| BigQuery
```

---

## 🗄️ Database Model (OLTP Schema)

The PostgreSQL transactional schema is designed to model multi-station records, criminal networks, and chat audit trails:

```mermaid
erDiagram
    DISTRICTS ||--o{ POLICE_STATIONS : contains
    POLICE_STATIONS ||--o{ CRIME_RECORDS : registers
    CRIME_RECORDS ||--|{ CRIME_CRIMINALS : involves
    CRIMINALS ||--|{ CRIME_CRIMINALS : committed-by
    CRIMINALS ||--o{ CRIMINAL_NETWORKS : links
    USERS ||--o{ CHAT_AUDITS : performs

    DISTRICTS {
        integer id PK
        string name
        string headquarter
    }
    POLICE_STATIONS {
        integer id PK
        string name
        integer district_id FK
        string station_code
    }
    CRIME_RECORDS {
        uuid id PK
        string FIR_number
        integer station_id FK
        timestamp occurrence_time
        string crime_category
        text description
        float latitude
        float longitude
        string status
        jsonb socio_economic_factors
    }
    CRIMINALS {
        uuid id PK
        string name
        string alias
        string fingerprint_hash
        string status
        float risk_score
    }
    CRIME_CRIMINALS {
        uuid crime_id FK
        uuid criminal_id FK
        string role
    }
    CRIMINAL_NETWORKS {
        uuid criminal_a FK
        uuid criminal_b FK
        string relationship_type
        float strength
    }
    USERS {
        uuid id PK
        string username
        string email
        string password_hash
        string role
    }
    CHAT_AUDITS {
        uuid id PK
        uuid user_id FK
        string query_text
        string reply_text
        string audio_url
        timestamp timestamp
    }
```

---

## 📂 Proposed Directory Structure

```
Vyuha-Network/
├── README.md                  # System overview and pitch guides
├── .gitignore                 # Exclusion configuration
├── docker-compose.yml         # Dev services configuration
├── backend/
│   ├── app/
│   │   ├── main.py            # API Entrypoint
│   │   ├── core/              # Config settings, RBAC security
│   │   ├── db/                # SQLAlchemy models, sessions
│   │   ├── api/               # API Routers (analytics, chat, network)
│   │   ├── services/          # ai_service, network_service, pdf_service
│   │   └── scripts/           # mock_db_seeder
│   ├── tests/                 # Integration test suites
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile             # Container configuration
└── frontend/
    ├── index.html             # React entry mounting frame
    ├── vite.config.ts         # Vite server settings
    ├── package.json           # Node project dependencies
    └── src/
        ├── App.tsx            # Main routes and login screens
        ├── styles/            # HSL layouts, maps, chatbot styles
        ├── components/        # GeospatialMap, NetworkVisualizer, ChatAssistant
        ├── context/           # Auth and Session management
        └── types/             # Common TypeScript signatures
```

---

## 🛠️ Proposed Changes

### Configuration & Base Environment
#### [NEW] [.gitignore](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/.gitignore)
Create standard workspace exclusion paths:
*   Exclude `.env`, `*.db`, `node_modules/`, `venv/`, and `dist/`.

#### [NEW] [README.md](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/README.md)
Write complete project documentation outlining features, tech stack, build scripts, local database fallback settings, and deployment details.

#### [NEW] [docker-compose.yml](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/docker-compose.yml)
Set up services including PostgreSQL (database storage), Redis (session caching), and local application images.

### Backend Development
#### [NEW] [requirements.txt](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/backend/requirements.txt)
Define Python library references: FastAPI, uvicorn, SQLAlchemy, psycopg2-binary, PyPDF2, reportlab (PDF generation), google-generativeai, and pytest.

#### [NEW] [main.py](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/backend/app/main.py)
Implement initialization routine, seed checkpoints, CORS rules, and routing bindings.

#### [NEW] [models.py](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/backend/app/db/models.py)
Build SQLAlchemy database classes mapping to normalized police station, crime, network, user, and audit tables.

#### [NEW] [ai_service.py](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/backend/app/services/ai_service.py)
Create interfaces with Gemini models to analyze crime patterns, generate risk scores, translate queries, and parse Kannada voice recordings.

#### [NEW] [network_service.py](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/backend/app/services/network_service.py)
Implement link-analysis logic mapping co-occurrences in FIR records to graph nodes and edges.

#### [NEW] [pdf_service.py](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/backend/app/services/pdf_service.py)
Add ReportLab compiler to compile chat logs and trend statistics into secure, printable PDF documents.

### Frontend Development
#### [NEW] [package.json](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/frontend/package.json)
Configure React, Leaflet (geospatial rendering), React-Router, Axios, and vis-network / cytoscape (for criminal network graphs).

#### [NEW] [GeospatialMap.tsx](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/frontend/src/components/GeospatialMap.tsx)
Build a Leaflet map showing markers for crime hotspots, district borders, and filtering systems.

#### [NEW] [NetworkVisualizer.tsx](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/frontend/src/components/NetworkVisualizer.tsx)
Develop a graph visualizer rendering connections, offender hubs, and associate links.

#### [NEW] [ChatAssistant.tsx](file:///Volumes/DiskD/HACKATHONS/Vyuha-Network/frontend/src/components/ChatAssistant.tsx)
Build a responsive chat component supporting text/voice intake, audio playback confirmations, and PDF report triggers.

---

## 🧪 Verification Plan

### Automated Validation Tests
Run these commands to verify code style, compile safety, and test suites:
```bash
# 1. Verify Backend Test Coverage
pytest backend/tests/

# 2. Run Backend Linter checks
flake8 backend/app/ tests/
mypy backend/app/

# 3. Verify Frontend Compile Safety
cd frontend && npm run typecheck
npm run lint
```

### Manual Verification Flows
1. **Interactive GIS Hotspotting**:
   * Inspect the main map view. Click on hotspot clusters to verify district-level drilldowns.
2. **Criminal Network Exploration**:
   * Double-click a criminal node. Verify that partner edges and repeat-offender aliases load.
3. **Conversational Assistant**:
   * Send a Kannada prompt: *"ಬೆಂಗಳೂರಿನಲ್ಲಿ ನಡೆದ ಇತ್ತೀಚಿನ ಕಳ್ಳತನ ಪ್ರಕರಣಗಳ ವರದಿ ಕೊಡಿ"* (Give me a report of recent theft cases in Bengaluru). Verify translation and accurate analytical response.
   * Upload a voice query. Verify transcription and vocal audio playback response.
   * Click **Export PDF**. Verify that the downloaded document contains the full transcript and audit hashes.
