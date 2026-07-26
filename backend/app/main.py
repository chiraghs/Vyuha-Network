import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.api import auth, analytics, network, chat, intel, admin
from app.services import observability

# Capture stdout/stderr into the admin log buffer as early as possible.
observability.install_log_capture()

# 1. Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Vyuha Network API",
    description="Backend services for KSP Crime Analytics & Conversational AI Dashboard",
    version="1.0.0",
)

# 2. Configure CORS.
# On Catalyst the AppSail gateway already injects CORS headers (it echoes the
# request origin), so adding our own here would emit a SECOND, conflicting
# Access-Control-Allow-Origin and the browser would reject every cross-origin
# call. We therefore skip app-level CORS when running on Catalyst (detected via
# the injected X_ZOHO_CATALYST_LISTEN_PORT, or forced with DISABLE_APP_CORS) and
# keep it for local dev where nothing else adds the headers.
_on_catalyst = bool(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT"))
_disable_app_cors = os.getenv("DISABLE_APP_CORS", "false").lower() == "true"

if not (_on_catalyst or _disable_app_cors):
    _default_origins = ["http://localhost:5173", "http://localhost:3000"]
    _env_origins = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()]
    _allow_all = os.getenv("CORS_ALLOW_ALL", "false").lower() == "true"
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if _allow_all else [*_default_origins, *_env_origins],
        allow_credentials=not _allow_all,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 3. Request-metrics middleware (feeds the developer console).
@app.middleware("http")
async def _observe_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    route = request.scope.get("route")
    path = getattr(route, "path", None) or request.url.path
    observability.metrics.record_request(request.method, path, response.status_code, duration_ms)
    return response


# 4. Include API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(intel.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


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
