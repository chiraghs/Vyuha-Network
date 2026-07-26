"""
AI intelligence endpoints backed by Catalyst Zia services.

All endpoints degrade gracefully: when Catalyst AI is disabled they return a
clear `available: false` payload (HTTP 200) rather than erroring, so the
frontend can fall back to its local behaviour without special-casing.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import models
from app.db.database import get_db
from app.services import catalyst_ai

router = APIRouter(prefix="/intel", tags=["AI Intelligence (Catalyst Zia)"])


class TextIn(BaseModel):
    text: str
    keywords: Optional[List[str]] = None


@router.get("/status")
def ai_status(current_user: models.User = Depends(get_current_user)):
    """Report which Catalyst AI capabilities are wired up for this deployment."""
    return {
        "catalyst_ai_enabled": catalyst_ai.is_enabled(),
        "ocr": catalyst_ai.ocr_available(),  # Zia OCR via the CodeLib function
    }


@router.post("/nlp")
def analyze_nlp(payload: TextIn, current_user: models.User = Depends(get_current_user)):
    """Sentiment + keyword extraction for an investigator query (Zia)."""
    result = catalyst_ai.analyze_text(payload.text, payload.keywords)
    if result is None:
        return {"available": False}
    return {"available": True, **result}


@router.post("/ocr")
async def ocr_document(
    file: UploadFile = File(...),
    language: str = Form("eng"),
    current_user: models.User = Depends(get_current_user),
):
    """Extract text from an uploaded FIR / case document image (Zia OCR)."""
    data = await file.read()
    result = catalyst_ai.extract_text(
        data, language=language, content_type=file.content_type or "image/png"
    )
    if result is None:
        return {
            "available": False,
            "message": "Catalyst OCR is not enabled for this deployment.",
        }
    return {"available": True, **result}


@router.post("/face-search")
async def face_search(
    file: UploadFile = File(...),
    limit: int = Form(5),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Rank offenders by facial similarity to an uploaded photograph using Zia's
    1:1 facial comparison, looped over enrolled booking photos in Stratus
    (object key `offenders/{criminal_id}.jpg`). Offenders without an enrolled
    photo are skipped. When AI or enrolment is unavailable the response says so
    and the client falls back to local perceptual matching.
    """
    if not catalyst_ai.is_enabled():
        return {"available": False, "matches": []}

    probe = await file.read()
    # Offenders are identity-resolved from accused records (person_key), matching
    # the rest of the app; booking photos are enrolled in Stratus by person_key.
    from app.services import offender_analytics as oa

    aggs = oa.aggregate_offenders(db)

    matches = []
    scanned = 0
    for key, agg in aggs.items():
        candidate = catalyst_ai.load_photo(f"offenders/{key}.jpg")
        if not candidate:
            continue
        scanned += 1
        comparison = catalyst_ai.compare_faces(probe, candidate)
        if not comparison:
            continue
        matches.append(
            {
                "id": key,
                "name": agg.name,
                "alias": agg.alias,
                "status": oa.status_of(agg),
                "risk_score": oa.risk_score(agg),
                "confidence": comparison["confidence"],
                "matched": comparison["matched"],
            }
        )

    matches.sort(key=lambda m: m["confidence"], reverse=True)
    return {
        "available": True,
        "enrolled_photos": scanned,
        "matches": matches[: max(1, limit)],
    }
