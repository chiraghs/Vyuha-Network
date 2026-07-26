import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.api import auth, analytics, network, chat, intel

# 1. Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Vyuha Network API",
    description="Backend services for KSP Crime Analytics & Conversational AI Dashboard",
    version="1.0.0",
)

# 2. Configure CORS.
# On Catalyst the client (Web Client Hosting) and this API (AppSail) are served
# from different origins, so the allowed origins are supplied via the
# CORS_ALLOW_ORIGINS env var (comma-separated). Local dev origins are always
# permitted so `npm run dev` keeps working.
_default_origins = ["http://localhost:5173", "http://localhost:3000"]
_env_origins = [
    o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()
]
_allow_all = os.getenv("CORS_ALLOW_ALL", "false").lower() == "true"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else [*_default_origins, *_env_origins],
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(intel.router, prefix="/api")


@app.on_event("startup")
def ensure_seed_data() -> None:
    """
    AppSail instances are stateless — a fresh container (scale-up or redeploy)
    starts with an empty local database. Seeding on startup is idempotent
    (seed_db() no-ops when users already exist), so every instance comes up
    populated. For durable, shared data set DATABASE_URL to an external
    Postgres and this simply becomes a first-run seed.
    """
    if os.getenv("AUTO_SEED", "true").lower() != "true":
        return
    try:
        from app.scripts.seed_data import seed_db

        seed_db()
    except Exception as exc:  # never block boot on seeding
        print(f"[startup] auto-seed skipped: {exc}")


@app.get("/api/health")
def health_check():
    """Simple database and service status verification endpoint."""
    return {
        "status": "operational",
        "system": "Vyuha Network Backend",
        "region": "Karnataka, IN",
        "catalyst_ai": os.getenv("CATALYST_AI_ENABLED", "false").lower() == "true",
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", os.getenv("PORT", "8000")))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
