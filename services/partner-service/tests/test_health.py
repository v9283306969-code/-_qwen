"""Scaffold tests — minimal test to pass CI during scaffold phase."""
import sys
import os

# Add src to path so we can import from it
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from main import app
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
