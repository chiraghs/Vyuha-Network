import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    """Verify system health check route."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "operational"

def test_login_officer():
    """Verify JWT authentication endpoint for officer role."""
    response = client.post(
        "/api/auth/login",
        json={"username": "officer", "password": "officer123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "officer"
    assert data["username"] == "officer"

def test_login_invalid():
    """Verify unauthorized response on bad credentials."""
    response = client.post(
        "/api/auth/login",
        json={"username": "officer", "password": "wrong_password"}
    )
    assert response.status_code == 401

def test_get_crimes_authorized():
    """Verify crimes analytics endpoint requires authorization."""
    # 1. Without Token
    response = client.get("/api/analytics/crimes")
    assert response.status_code == 401 # Unauthorized

    # 2. Get token
    login_res = client.post(
        "/api/auth/login",
        json={"username": "officer", "password": "officer123"}
    )
    token = login_res.json()["access_token"]

    # 3. With Token
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/analytics/crimes", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert "FIR_number" in data[0]

def test_get_network_graph():
    """Verify criminal accomplice network endpoints."""
    # 1. Login
    login_res = client.post(
        "/api/auth/login",
        json={"username": "officer", "password": "officer123"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Query network
    response = client.get("/api/network", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert "metrics" in data
    assert len(data["nodes"]) > 0

def test_post_chat_query():
    """Verify Intelligent Chat Assistant parses and translates prompts."""
    # 1. Login
    login_res = client.post(
        "/api/auth/login",
        json={"username": "officer", "password": "officer123"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Submit chat prompt
    chat_payload = {"query_text": "ಕೊಲೆ ಪ್ರಕರಣ"} # Kannada for Homicide case
    response = client.post("/api/chat", json=chat_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "original_query" in data
    assert "translated_query" in data
    assert "reply_text" in data
    assert "verification_hash" in data
    assert data["language"] == "kn"
