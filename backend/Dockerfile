# Vyuha Network API — Catalyst AppSail (Docker image runtime).
# Docker is used instead of the managed Python runtime because the backend
# pulls native wheels (bcrypt, cryptography, reportlab, pydantic-core) that
# cannot be reliably vendored from a macOS dev machine to Catalyst's Linux
# runtime. The image builds those on Linux at deploy time.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Catalyst injects the port via X_ZOHO_CATALYST_LISTEN_PORT (default 9000).
EXPOSE 9000
CMD ["python3", "-u", "catalyst_server.py"]
