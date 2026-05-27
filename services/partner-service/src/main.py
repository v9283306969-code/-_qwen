"""Partner Service — scaffold (Этап 2.5, код — Этап 3)."""
from datetime import datetime, timezone
from fastapi import FastAPI

app = FastAPI(title="Partner Service", version="0.1.0-scaffold")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "partner-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/partners")
def list_partners():
    return {
        "partners": [],
        "note": "Partner API — в разработке (Этап 3)",
    }
