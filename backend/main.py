from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

# Support running both from project root (backend.db) and inside AWS Lambda package (db)
try:
    from backend.ai import AIParseRequest, AIRideParserService, get_ai_parser_service
    from backend.db import Ride, RideCreate, RideRepository, get_ride_repository
except ImportError:
    from ai import AIParseRequest, AIRideParserService, get_ai_parser_service
    from db import Ride, RideCreate, RideRepository, get_ride_repository


# ==========================================
# 1. FASTAPI APP & CORS CONFIGURATION
# ==========================================

app = FastAPI(
    title="QuickPool AI API",
    description="Full-Stack Carpooling MVP with AI Natural Language Parser",
    version="1.0.0",
)

# Enable CORS so the frontend (local or AWS S3/CloudFront) can call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# 2. REST API ENDPOINTS (CRUD + AI TWIST)
# ==========================================

@app.get("/api/health", tags=["System"])
def health_check() -> dict[str, str]:
    """Simple healthcheck endpoint to verify API availability."""
    return {"status": "ok", "service": "QuickPool AI"}


@app.get("/api/rides", response_model=list[Ride], tags=["Rides CRUD"])
def list_rides(
    search: Optional[str] = Query(
        default=None, description="Filter by origin, destination, or driver"),
    repo: RideRepository = Depends(get_ride_repository),
) -> list[Ride]:
    """Return all available rides, optionally filtered by a search keyword."""
    rides = repo.get_all()
    if search:
        keyword = search.lower().strip()
        rides = [
            r for r in rides
            if keyword in r.origin.lower()
            or keyword in r.destination.lower()
            or keyword in r.driver_name.lower()
        ]
    return rides


@app.get("/api/rides/{ride_id}", response_model=Ride, tags=["Rides CRUD"])
def get_ride(
    ride_id: str,
    repo: RideRepository = Depends(get_ride_repository),
) -> Ride:
    """Return a single ride by its unique ID."""
    ride = repo.get_by_id(ride_id)
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ride with ID '{ride_id}' not found.",
        )
    return ride


@app.post(
    "/api/rides",
    response_model=Ride,
    status_code=status.HTTP_201_CREATED,
    tags=["Rides CRUD"],
)
def create_ride(
    ride_data: RideCreate,
    repo: RideRepository = Depends(get_ride_repository),
) -> Ride:
    """Create a new carpooling ride offer."""
    return repo.create(ride_data)


@app.put("/api/rides/{ride_id}", response_model=Ride, tags=["Rides CRUD"])
def update_ride(
    ride_id: str,
    ride_data: RideCreate,
    repo: RideRepository = Depends(get_ride_repository),
) -> Ride:
    """Update all fields of an existing ride offer."""
    updated = repo.update(ride_id, ride_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ride with ID '{ride_id}' not found.",
        )
    return updated


@app.patch("/api/rides/{ride_id}/book", response_model=Ride, tags=["Rides CRUD"])
def book_ride_seat(
    ride_id: str,
    repo: RideRepository = Depends(get_ride_repository),
) -> Ride:
    """Book 1 seat in the selected ride (decrements available_seats by 1)."""
    existing = repo.get_by_id(ride_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ride with ID '{ride_id}' not found.",
        )
    if existing.available_seats <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No available seats left for this ride.",
        )

    booked = repo.book_seat(ride_id)
    return booked


@app.delete("/api/rides/{ride_id}", status_code=status.HTTP_200_OK, tags=["Rides CRUD"])
def delete_ride(
    ride_id: str,
    repo: RideRepository = Depends(get_ride_repository),
) -> dict[str, str]:
    """Delete a ride offer by its ID."""
    deleted = repo.delete(ride_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ride with ID '{ride_id}' not found.",
        )
    return {"message": "Ride deleted successfully", "id": ride_id}


@app.post("/api/rides/parse-ai", response_model=RideCreate, tags=["AI Creative Twist"])
def parse_ride_with_ai(
    payload: AIParseRequest,
    ai_service: AIRideParserService = Depends(get_ai_parser_service),
) -> RideCreate:
    """
    Creative Twist: Parse an unstructured natural language message (e.g., from Messenger)
    into structured RideCreate fields ready to populate the form or save to DB.
    """
    return ai_service.parse_message(payload.raw_text)


# ==========================================
# 3. AWS LAMBDA ENTRYPOINT (MANGUM ADAPTER)
# ==========================================

handler = Mangum(app)
