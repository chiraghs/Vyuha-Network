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
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Any, Callable, Dict, List, Optional

# Zia SDK calls are blocking network calls. If the SDK is misconfigured (e.g.
# missing project credentials on AppSail) they can hang, which would stall the
# request that triggered them. Every call is therefore run with a hard timeout
# so a broken Zia degrades to the local fallback fast instead of hanging.
_ZIA_TIMEOUT_S = float(os.getenv("ZIA_TIMEOUT_SECONDS", "8"))
_executor = ThreadPoolExecutor(max_workers=4)


def _guarded(fn: Callable[[], Any], timeout: Optional[float] = None) -> Optional[Any]:
    try:
        return _executor.submit(fn).result(timeout=timeout or _ZIA_TIMEOUT_S)
    except (FutureTimeout, Exception) as exc:  # noqa: BLE001 — degrade gracefully
        print(f"[catalyst_ai] call failed/timed out: {exc}")
        return None


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

    def _run() -> Optional[Dict[str, Any]]:
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

    return _guarded(_run)


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
# OCR (document intake) — via the Zia Services CodeLib function
# --------------------------------------------------------------------------- #
# The bare SDK `zcatalyst_sdk.initialize()` has no auth context on AppSail, so
# Zia is reached through the installed CodeLib Function instead (it initialises
# the SDK from its own request context). The AppSail backend calls it
# server-to-server with the shared secret so the key never reaches the browser.
def ocr_available() -> bool:
    return bool(os.getenv("ZIA_OCR_URL") and os.getenv("ZIA_CODELIB_SECRET"))


def extract_text(
    image_bytes: bytes, language: str = "eng", content_type: str = "image/png"
) -> Optional[Dict[str, Any]]:
    """Run Zia OCR over an uploaded document image. Returns {text, confidence}."""
    url = os.getenv("ZIA_OCR_URL")
    secret = os.getenv("ZIA_CODELIB_SECRET")
    if not url or not secret:
        return None

    # The CodeLib upload handler filters by image mimetype, so send a real
    # image content-type (not octet-stream) or it rejects the file with 400.
    mime = content_type if (content_type or "").startswith("image/") else "image/png"
    ext = mime.split("/")[-1]

    def _run() -> Optional[Dict[str, Any]]:
        import requests

        resp = requests.post(
            url,
            headers={"catalyst-codelib-secret-key": secret},
            files={"image": (f"document.{ext}", image_bytes, mime)},
            timeout=25,
        )
        resp.raise_for_status()
        payload = resp.json()
        data = payload.get("data") or {}
        text = data.get("text", "")
        return {"text": text, "confidence": data.get("confidence")} if text else None

    result = _guarded(_run, timeout=28)
    from app.services.observability import metrics

    metrics.record_ocr(success=result is not None)
    return result


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

    def _run() -> Optional[Dict[str, Any]]:
        zia = _catalyst_app().zia()
        res = zia.compare_face(io.BytesIO(probe), io.BytesIO(candidate))
        confidence = float(res.get("confidence", 0) or 0)
        matched = str(res.get("matched", "")).lower() == "true" or confidence > 0.5
        return {"matched": matched, "confidence": confidence}

    return _guarded(_run)


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
