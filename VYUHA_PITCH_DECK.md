# Vyuha Network: AI-Driven Crime Analytics & Conversational Intelligence Platform
*Karnataka State Police (KSP) Decision-Support & Investigation System*

---

## 📺 Slide 1: Title Slide
### **VYUHA NETWORK**
*Decentralized Crime Data Aggregation meets Conversational Intelligence*

*   **Sub-title**: Transforming fragmented criminal records into real-time geospatial hotspots, accomplice link graphs, and bilingual voice-enabled chatbot query ledgers.
*   **Team Submission**: Vyuha Network + BYOD Ingestion Microservice.
*   **Target Domain**: Law Enforcement, State Crime Records Bureau (SCRB), and Police Investigators.

---

## 🛑 Slide 2: The Problem
### **Siloed Records & Static Queries**
1.  **Fragmented Registries**: Police records span 1100+ stations across Karnataka, causing critical links between repeat offenders to remain hidden in text narratives.
2.  **Static Dashboards**: Current investigative systems rely on manual SQL queries and static charts, preventing real-time analytics.
3.  **Language & Usability Barriers**: Investigators in the field need to search records quickly using spoken Kannada or English, rather than writing technical database queries.

---

## 💡 Slide 3: The Solution
### **Visual Analytics + Intelligent Conversational AI**
*   **Phase 1 Analytics Dashboard**: Visualizes geographic crime hotspots, maps co-offender networks, scores recidivism probabilities, and groups crimes by local socio-economic demographics.
*   **Phase 2 Chat Assistant**: Bilingual chatbot (English + Kannada) parsing natural language text and voice queries to query the database, returning chain-of-thought AI explanations.
*   **BYOD Integration Module**: Standalone "Bring Your Own Document" microservice that accepts PDF/TXT case files, extracts text, summarizes details, and supports file-specific Q&A.

---

## 🗺️ Slide 4: Phase 1 - Geospatial Hotspots & Drilldowns
### **Geospatial Mapping Dashboard**
*   **Leaflet GIS Map**: Renders geolocated crime coordinates across Karnataka on a custom dark tile layout.
*   **Clustered Hotspot Detection**: Dynamic radius density clusters colored by gravity (e.g. Red for Homicide, Purple for Narcotics).
*   **Interactive District Drilldowns**: Select a district to filter the registered FIR list and auto-adjust the coordinate viewport boundaries.
*   **Socio-economic Correlation**: Overlays crimes against local unemployment rate buckets and poverty indexes.

---

## 🕸️ Slide 5: Phase 1 - Criminal Link Analysis & Risk Scoring
### **Accomplice Relation Networks**
*   **Verlet Canvas Graph Physics**: Custom-built force-directed node-link network rendering co-offender associations in an animated canvas.
*   **Repeat Offender Highlight**: Identifies and scales high-priority suspects, highlighting active network hubs (&ge;3 links) with halos.
*   **Predictive Risk Scores**: Visualizes recidivism risk levels (Red for high-risk &ge;80, Yellow for medium 50-79, Blue for low &lt;50).
*   **Dynamic AI Assessment**: Double-clicking a suspect node calls the AI service to print an explainable risk assessment.

---

## 🗣️ Slide 6: Phase 2 - Bilingual Voice Chatbot
### **Conversational Intelligence Assistant**
*   **Kannada Speech Input**: Ingests voice recordings through the browser's MediaRecorder API and decodes the WAV base64 payload to transcribe Kannada queries.
*   **Bidirectional Translation**: Gemini-based language bridge translating Kannada input to English for context matching, and translating responses back to Kannada.
*   **Explainable Chain-of-Thought**: Generates detailed investigative summaries accompanied by explicit advisory action recommendations.
*   **Cryptographic Ledger Auditing**: SHA-256 hashes generated from chat payloads are saved to a secure SQL log to provide immutable audit trails.

---

## 📁 Slide 7: Bring Your Own Document (BYOD) Service
### **Document Intake & Context Q&A**
*   **Standalone microservice**: Built as a decoupled app, exposing port `8001` (backend) and `5174` (frontend).
*   **Automated Ingestion**: Accepts PDF or TXT files, runs text extraction using `pypdf`, and calls Gemini to categorize the file and generate summaries.
*   **Contextual Q&A Interface**: Pinpoints specific legal documents and allows investigators to ask document-specific questions using natural language.

---

## 🛠️ Slide 8: Technology Stack & SOLID Architecture
### **Scalable and Clean Codebase Design**
*   **Backend**: FastAPI, uvicorn, SQLAlchemy (SQLite/Postgres configurations), PyPDF, ReportLab PDF, Google Generative AI (Gemini 1.5 Flash).
*   **Frontend**: Vite, React, TypeScript, Leaflet.js, Lucide Icons, Vanilla HSL CSS with Glassmorphism.
*   **SOLID Conformance**:
    *   *SRP*: Separate modules for database mappings, services, and route handlers.
    *   *OCP & LSP*: Swappable AI implementations (`GeminiAIService` / `MockAIService`) sharing `BaseAIService` contract.
    *   *ISP*: Cohesive segregation of interfaces in `interfaces.py`.
    *   *DIP*: Routers depend strictly on injected base interfaces via FastAPI's `Depends` system.

---

## 📊 Slide 9: Verification, Testing & QA
### **Robust and Verified Pipeline**
*   **Pytest Integration Suite**: 100% green test results covering health endpoints, JWT authentication checks, crimes search filters, criminal networks, and bilingual chat logs.
*   **Type Safety**: Strict typescript checks compile successfully (`tsc --noEmit`).
*   **Fast Production Bundling**: Production bundle compiling and minifying assets in under 600ms.

---

## 📈 Slide 10: Proposed Impact & Pilot Roadmap
### **Data-Driven Strategic Policing**
*   **Impact**: Redefines law enforcement search speeds from hours of manual database queries to instant verbal queries.
*   **Pilot Roadmap**:
    *   *Phase 1*: Deploy Vyuha dashboard across Karnataka's major Commissionerates (Bengaluru, Mysuru, Mangaluru) to map hotspot trends.
    *   *Phase 2*: Integrate voice assistant logs inside patrol vehicles.
    *   *Phase 3*: Deploy BYOD microservice on local private clouds to secure case files and charge sheets.
