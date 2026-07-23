from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.api import auth, analytics, network, chat

# 1. Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Vyuha Network API",
    description="Backend services for KSP Crime Analytics & Conversational AI Dashboard",
    version="1.0.0"
)

# 2. Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

@app.get("/api/health")
def health_check():
    """Simple database and service status verification endpoint."""
    return {
        "status": "operational",
        "system": "Vyuha Network Backend",
        "region": "Karnataka, IN"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
