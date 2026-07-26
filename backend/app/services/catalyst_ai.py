"""
Catalyst Zia AI integration — OCR, facial comparison and text analytics —
plus Stratus object storage for enrolled booking photographs.

Everything here is optional and defensive: if the Catalyst SDK is unavailable
(local dev) or CATALYST_AI_ENABLED is not "true", `is_enabled()` returns False
and callers fall back to their existing local behaviour. No import of the SDK
happens unless the feature is switched on.
"""
from __future__ import annotations

import io
import os
from typing import Any, Dict, List, Optional


def is_enabled() -> bool:
    return os.getenv("CATALYST_AI_ENABLED", "false").lower() == "true"


_app = None


def _catalyst_app():
    """Lazily initialise the Catalyst SDK app handle (cached)."""
    global _app
    if _app is not None:
        return _app
    import zcatalyst_sdk  # imported only when enabled

    _app = zcatalyst_sdk.initialize()
    return _app


# --------------------------------------------------------------------------- #
# Text analytics (chat enrichment)
# --------------------------------------------------------------------------- #
def analyze_text(text: str, keywords: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """
    Returns {sentiment, score, keywords} via Zia text analytics, or None on
    any failure so the caller can silently skip enrichment.
    """
    if not is_enabled() or not text.strip():
        return None
    try:
        zia = _catalyst_app().zia()
        snippet = text.strip()[:1500]  # Zia sentiment caps at 1500 chars
        result: Dict[str, Any] = {}

        sentiment = zia.get_sentiment_analysis([snippet], keywords or [])
        doc = _first(sentiment)
        if doc:
            result["sentiment"] = doc.get("document_sentiment") or doc.get("sentiment")
            result["score"] = doc.get("overall_score")

        extracted = _extract_keywords(zia, snippet)
        if extracted:
            result["keywords"] = extracted

        return result or None
    except Exception as exc:
        print(f"[catalyst_ai] analyze_text failed: {exc}")
        return None


def _extract_keywords(zia, text: str) -> Optional[List[str]]:
    """Keyword extraction — method name varies across SDK versions; try a few."""
    for method in ("get_keyword_extraction", "keyword_extraction", "get_keywords"):
        fn = getattr(zia, method, None)
        if not fn:
            continue
        try:
            res = fn([text]) if _takes_list(method) else fn(text)
            kws = _collect_keywords(res)
            if kws:
                return kws[:8]
        except Exception:
            continue
    return None


# --------------------------------------------------------------------------- #
# OCR (document intake)
# --------------------------------------------------------------------------- #
def extract_text(image_bytes: bytes, language: str = "eng") -> Optional[Dict[str, Any]]:
    """Run Zia OCR over an uploaded document image. Returns {text, confidence}."""
    if not is_enabled():
        return None
    try:
        zia = _catalyst_app().zia()
        res = zia.extract_optical_characters(
            io.BytesIO(image_bytes), {"language": language, "modelType": "OCR"}
        )
        return {"text": res.get("text", ""), "confidence": res.get("confidence")}
    except Exception as exc:
        print(f"[catalyst_ai] extract_text failed: {exc}")
        return None


# --------------------------------------------------------------------------- #
# Facial comparison (photo search)
# --------------------------------------------------------------------------- #
def compare_faces(probe: bytes, candidate: bytes) -> Optional[Dict[str, Any]]:
    """
    1:1 facial comparison via Zia. Returns {matched: bool, confidence: float}
    or None if the service errored (e.g. no face detected in an image).
    """
    if not is_enabled():
        return None
    try:
        zia = _catalyst_app().zia()
        res = zia.compare_face(io.BytesIO(probe), io.BytesIO(candidate))
        confidence = float(res.get("confidence", 0) or 0)
        matched = str(res.get("matched", "")).lower() == "true" or confidence > 0.5
        return {"matched": matched, "confidence": confidence}
    except Exception as exc:
        print(f"[catalyst_ai] compare_faces failed: {exc}")
        return None


# --------------------------------------------------------------------------- #
# Stratus object storage (enrolled booking photos)
# --------------------------------------------------------------------------- #
def _bucket():
    name = os.getenv("STRATUS_BUCKET", "vyuha-offender-photos")
    return _catalyst_app().stratus().bucket(name)


def store_photo(object_key: str, image_bytes: bytes, content_type: str = "image/jpeg") -> bool:
    if not is_enabled():
        return False
    try:
        _bucket().put_object(
            object_key,
            io.BytesIO(image_bytes),
            {"overwrite": "true", "content_type": content_type},
        )
        return True
    except Exception as exc:
        print(f"[catalyst_ai] store_photo failed: {exc}")
        return False


def load_photo(object_key: str) -> Optional[bytes]:
    if not is_enabled():
        return None
    try:
        obj = _bucket().get_object(object_key)
        # SDK may return bytes or a stream-like object depending on version.
        if isinstance(obj, (bytes, bytearray)):
            return bytes(obj)
        read = getattr(obj, "read", None)
        return read() if read else None
    except Exception as exc:
        print(f"[catalyst_ai] load_photo failed: {exc}")
        return None


# --------------------------------------------------------------------------- #
# Small helpers tolerant of SDK response-shape variation
# --------------------------------------------------------------------------- #
def _first(res: Any) -> Optional[Dict[str, Any]]:
    if isinstance(res, dict):
        for key in ("data", "result", "response", "sentiment_prediction"):
            if key in res:
                return _first(res[key])
        return res
    if isinstance(res, list) and res:
        return res[0] if isinstance(res[0], dict) else None
    return None


def _collect_keywords(res: Any) -> List[str]:
    node = _first(res) or res
    out: List[str] = []
    if isinstance(node, dict):
        for key in ("keywords", "keyword", "keyphrases"):
            val = node.get(key)
            if isinstance(val, list):
                out.extend(str(_kw_text(k)) for k in val)
    elif isinstance(node, list):
        out.extend(str(_kw_text(k)) for k in node)
    return [k for k in out if k]


def _kw_text(k: Any) -> str:
    if isinstance(k, dict):
        return k.get("keyword") or k.get("text") or k.get("name") or ""
    return str(k)


def _takes_list(method: str) -> bool:
    return "extraction" in method or method == "get_keywords"
