import pytest
from fastapi.testclient import TestClient

try:
    from backend.ai import AIRideParserService, get_ai_parser_service
    from backend.db import SQLiteRideRepository, get_ride_repository
    from backend.main import app
except ImportError:
    from ai import AIRideParserService, get_ai_parser_service
    from db import SQLiteRideRepository, get_ride_repository
    from main import app


# ==========================================
# 1. PYTEST FIXTURE (Isolated Test Database)
# ==========================================

@pytest.fixture()
def client(tmp_path) -> TestClient:
    """
    Create a FastAPI TestClient wired to an isolated temporary SQLite database
    and deterministic AI fallback service (no external API calls during tests).
    """
    test_db_file = tmp_path / "test_quickpool.db"
    test_repo = SQLiteRideRepository(db_path=str(test_db_file))
    test_ai_service = AIRideParserService(
        api_key=None)  # Force deterministic fallback

    # Dependency Injection Override: swap production dependencies with test instances
    app.dependency_overrides[get_ride_repository] = lambda: test_repo
    app.dependency_overrides[get_ai_parser_service] = lambda: test_ai_service

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


# ==========================================
# 2. API INTEGRATION TESTS (CRUD + AI)
# ==========================================

def test_health_check(client: TestClient) -> None:
    """Verify the healthcheck endpoint returns HTTP 200."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_seeded_rides_and_search(client: TestClient) -> None:
    """Verify initial seed data is loaded and search filtering works."""
    response = client.get("/api/rides")
    assert response.status_code == 200
    rides = response.json()
    assert len(rides) == 3

    filtered = client.get("/api/rides?search=Wrzeszcz")
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["driver_name"] == "Marek K."


def test_create_book_and_delete_ride(client: TestClient) -> None:
    """Verify full lifecycle: POST create -> PATCH book seat -> DELETE ride."""
    payload = {
        "driver_name": "Tomek S.",
        "origin": "Sopot PKP",
        "destination": "Gdańsk Główny",
        "departure_time": "Jutro, 09:00",
        "available_seats": 1,
        "price_pln": 7.5,
        "notes": "Jadę z psem",
    }

    # 1. Create ride
    create_res = client.post("/api/rides", json=payload)
    assert create_res.status_code == 201
    created_ride = create_res.json()
    ride_id = created_ride["id"]
    assert created_ride["available_seats"] == 1

    # 2. Book the only available seat
    book_res = client.patch(f"/api/rides/{ride_id}/book")
    assert book_res.status_code == 200
    assert book_res.json()["available_seats"] == 0

    # 3. Booking again when 0 seats left should return HTTP 400
    overbook_res = client.patch(f"/api/rides/{ride_id}/book")
    assert overbook_res.status_code == 400

    # 4. Delete ride
    del_res = client.delete(f"/api/rides/{ride_id}")
    assert del_res.status_code == 200

    # 5. Fetching deleted ride should return HTTP 404
    get_res = client.get(f"/api/rides/{ride_id}")
    assert get_res.status_code == 404


def test_ai_parse_endpoint(client: TestClient) -> None:
    """Verify the AI Creative Twist endpoint extracts structured ride data."""
    response = client.post(
        "/api/rides/parse-ai",
        json={
            "raw_text": "Cześć, jestem Michał, jutro o 8:30 jadę z Oliwy do Gdyni, mam 3 miejsca po 12 zł"
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["driver_name"] == "Michał"
    assert data["available_seats"] == 3
    assert data["price_pln"] == 12.0
    assert "8:30" in data["departure_time"]
