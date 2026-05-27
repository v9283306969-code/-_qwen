"""Scaffold tests — minimal test to pass CI during scaffold phase."""
from src.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "partner-service"


def test_partners_endpoint():
    response = client.get("/api/v1/partners")
    assert response.status_code == 200
    data = response.json()
    assert "partners" in data
