"""
AppSail entrypoint for Catalyst.

Catalyst injects the listening port via X_ZOHO_CATALYST_LISTEN_PORT (default
9000) and runs this file directly with `python3 -u catalyst_server.py` — no
shell, no WSGI/ASGI server assumed — so we start uvicorn programmatically and
bind 0.0.0.0 on the injected port.
"""
import os

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", "9000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")
