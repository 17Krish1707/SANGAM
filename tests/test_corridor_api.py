from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import RailwaySection

client = TestClient(app)


def test_get_corridor_windows_endpoint():
    db = SessionLocal()
    section = db.query(RailwaySection).first()
    assert section is not None, "Need seeded railway sections"
    sec_id = str(section.id)
    db.close()

    res = client.get(f"/api/corridor/{sec_id}/windows")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0

    # Verify attributes
    sample = data[0]
    assert "window_start" in sample
    assert "window_end" in sample
    assert "duration_min" in sample
    assert "risk_score" in sample
    assert sample["duration_min"] >= 20

    # Verify ascending sort by risk score
    scores = [w["risk_score"] for w in data if w["risk_score"] is not None]
    assert scores == sorted(scores)
