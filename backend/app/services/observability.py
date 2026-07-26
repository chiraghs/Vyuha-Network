"""
Lightweight in-process observability for the admin console: a rolling log
buffer (captures everything written to stdout/stderr, including uvicorn logs and
print statements) and a metrics registry (API request counts, AI-call and OCR
outcomes, recent-call trace). All in-memory and per-instance — intended for a
single-instance dev deployment's developer console, not a durable metrics store.
"""
from __future__ import annotations

import sys
import threading
import time
from collections import Counter, deque
from typing import Any, Deque, Dict, List, Optional

# --------------------------------------------------------------------------- #
# Log capture — tee stdout/stderr into a ring buffer
# --------------------------------------------------------------------------- #
LOG_BUFFER: Deque[Dict[str, Any]] = deque(maxlen=500)
_installed = False


class _Tee:
    def __init__(self, stream, is_err: bool):
        self._stream = stream
        self._level = "err" if is_err else "out"

    def write(self, data: str):
        self._stream.write(data)
        text = data.rstrip("\n")
        if text:
            for line in text.split("\n"):
                LOG_BUFFER.append({"t": time.time(), "level": self._level, "line": line})

    def flush(self):
        self._stream.flush()

    def __getattr__(self, name):
        return getattr(self._stream, name)


def install_log_capture() -> None:
    global _installed
    if _installed:
        return
    sys.stdout = _Tee(sys.stdout, is_err=False)
    sys.stderr = _Tee(sys.stderr, is_err=True)
    _installed = True


def recent_logs(limit: int = 200) -> List[Dict[str, Any]]:
    items = list(LOG_BUFFER)
    return items[-limit:]


# --------------------------------------------------------------------------- #
# Metrics
# --------------------------------------------------------------------------- #
class Metrics:
    def __init__(self):
        self._lock = threading.Lock()
        self.started = time.time()
        self.request_count = 0
        self.by_status: Counter = Counter()
        self.by_route: Counter = Counter()
        self.recent: Deque[Dict[str, Any]] = deque(maxlen=80)
        self.ai = {
            "calls": 0,
            "real": 0,
            "fallback": 0,
            "provider": None,
            "model": None,
            "last_error": None,
            "last_latency_ms": None,
        }
        self.ocr = {"calls": 0, "success": 0, "fallback": 0}

    def record_request(self, method: str, route: str, status: int, dur_ms: float):
        with self._lock:
            self.request_count += 1
            self.by_status[str(status)] += 1
            self.by_route[f"{method} {route}"] += 1
            self.recent.appendleft(
                {"t": time.time(), "method": method, "route": route, "status": status, "ms": round(dur_ms, 1)}
            )

    def record_ai(
        self,
        real: bool,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        latency_ms: Optional[float] = None,
        error: Optional[Any] = None,
    ):
        with self._lock:
            self.ai["calls"] += 1
            self.ai["real" if real else "fallback"] += 1
            if provider:
                self.ai["provider"] = provider
            if model:
                self.ai["model"] = model
            if latency_ms is not None:
                self.ai["last_latency_ms"] = round(latency_ms, 1)
            if error is not None:
                self.ai["last_error"] = str(error)[:300]

    def record_ocr(self, success: bool):
        with self._lock:
            self.ocr["calls"] += 1
            self.ocr["success" if success else "fallback"] += 1

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "uptime_s": round(time.time() - self.started),
                "request_count": self.request_count,
                "by_status": dict(self.by_status),
                "top_routes": self.by_route.most_common(12),
                "recent": list(self.recent),
                "ai": dict(self.ai),
                "ocr": dict(self.ocr),
            }


metrics = Metrics()
