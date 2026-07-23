import os
import hashlib
from datetime import datetime, timedelta
from jose import jwt

# Security Configurations
SECRET_KEY = os.getenv("SECRET_KEY", "vyuha-network-karnataka-police-secret-key-987654321")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours for long police shifts

def hash_password(password: str) -> str:
    """Bulletproof SHA-256 hashing to avoid platform-specific compilation issues with bcrypt."""
    salt = "vyuha_salt_value_12345"
    salted = password + salt
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compare password hashes securely."""
    return hash_password(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Generate JWT authentication token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict | None:
    """Decode JWT token and verify signature."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None
