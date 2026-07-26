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

# Runtime config for the Catalyst deployment. The client (Web Client Hosting)
# is a separate origin, and the API is stateless Bearer-token auth, so wildcard
# CORS (credentials off) is safe. Flip MOCK_AI_PIPELINE / CATALYST_AI_ENABLED
# here (or in the console) to enable Gemini / Zia.
# Catalyst's AppSail gateway handles CORS; the app must not add its own or the
# browser sees duplicate Access-Control-Allow-Origin headers.
ENV DISABLE_APP_CORS=true \
    MOCK_AI_PIPELINE=true \
    CATALYST_AI_ENABLED=false \
    AUTO_SEED=true
# ZIA_OCR_URL and ZIA_CODELIB_SECRET (for the Zia OCR CodeLib) are NOT baked in
# — set them as environment variables on the AppSail app in the Catalyst
# console so the secret never enters the image or git.

# Catalyst injects the port via X_ZOHO_CATALYST_LISTEN_PORT (default 9000).
EXPOSE 9000
CMD ["python3", "-u", "catalyst_server.py"]
