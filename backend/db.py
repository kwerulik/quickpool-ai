import os
import sqlite3
import uuid
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional

import boto3
from pydantic import BaseModel, Field


# ==========================================
# 1. DOMAIN MODELS (Pydantic v2 Validation)
# ==========================================

class RideCreate(BaseModel):
    """Data Transfer Object (DTO) for creating or updating a ride."""
    driver_name: str = Field(..., min_length=2, max_length=50)
    origin: str = Field(..., min_length=2, max_length=100)
    destination: str = Field(..., min_length=2, max_length=100)
    departure_time: str = Field(..., min_length=2, max_length=50)
    available_seats: int = Field(..., ge=0, le=8)
    price_pln: float = Field(..., ge=0.0, le=500.0)
    notes: str = Field(default="", max_length=300)

class Ride(RideCreate):
    """Full Ride entity including the unique identifier."""
    id: str


# ==========================================
# 2. ABSTRACTION (Repository Interface)
# ==========================================

class RideRepository(ABC):
    """Abstract base class defining the contract for all ride storage engines."""

    @abstractmethod
    def get_all(self) -> list[Ride]:
        """Return all available rides."""
        pass

    @abstractmethod
    def get_by_id(self, ride_id: str) -> Optional[Ride]:
        """Return a single ride by its ID or None if not found."""
        pass

    @abstractmethod
    def create(self, ride_data: RideCreate) -> Ride:
        """Persist a new ride and return the created entity."""
        pass

    @abstractmethod
    def update(self, ride_id: str, ride_data: RideCreate) -> Optional[Ride]:
        """Update an existing ride by ID."""
        pass

    @abstractmethod
    def book_seat(self, ride_id: str) -> Optional[Ride]:
        """Decrement available_seats by 1 if seats are available."""
        pass

    @abstractmethod
    def delete(self, ride_id: str) -> bool:
        """Remove a ride by ID and return True if deleted."""
        pass


# ==========================================
# 3. CONCRETE IMPLEMENTATION 1: Local SQLite
# ==========================================

class SQLiteRideRepository(RideRepository):
    """Local SQLite implementation of the RideRepository interface."""

    def __init__(self, db_path: str = "quickpool.db") -> None:
        # Encapsulation: private attribute holding the database file path
        self._db_path = db_path
        self._init_db()
        self._seed_if_empty()

    def _get_connection(self) -> sqlite3.Connection:
        """Private helper that creates a SQLite connection with dictionary-like row access."""
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Create the rides table if it does not exist yet."""
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rides (
                    id TEXT PRIMARY KEY,
                    driver_name TEXT NOT NULL,
                    origin TEXT NOT NULL,
                    destination TEXT NOT NULL,
                    departure_time TEXT NOT NULL,
                    available_seats INTEGER NOT NULL,
                    price_pln REAL NOT NULL,
                    notes TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _seed_if_empty(self) -> None:
        """Populate the database with sample Tricity rides on first startup."""
        if len(self.get_all()) > 0:
            return

        sample_rides = [
            RideCreate(
                driver_name="Marek K.",
                origin="Gdańsk Wrzeszcz PKP",
                destination="Olivia Business Centre",
                departure_time="Tomorrow, 08:15",
                available_seats=3,
                price_pln=8.0,
                notes="Fast ride via Grunwaldzka, coffee stops welcome.",
            ),
            RideCreate(
                driver_name="Anna W.",
                origin="Gdynia Redłowo",
                destination="Gdańsk Politechnika",
                departure_time="Tomorrow, 07:30",
                available_seats=2,
                price_pln=12.0,
                notes="Can pick up near SKM station.",
            ),
            RideCreate(
                driver_name="Piotr Z.",
                origin="Gdańsk Morena",
                destination="Intel Technology Poland (Rębiechowo)",
                departure_time="Today, 16:30",
                available_seats=4,
                price_pln=10.0,
                notes="Trunk space available for a foldable scooter.",
            ),
        ]
        for ride in sample_rides:
            self.create(ride)

    def get_all(self) -> list[Ride]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM rides").fetchall()
            return [Ride(**dict(row)) for row in rows]

    def get_by_id(self, ride_id: str) -> Optional[Ride]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
            return Ride(**dict(row)) if row else None

    def create(self, ride_data: RideCreate) -> Ride:
        new_ride = Ride(id=str(uuid.uuid4()), **ride_data.model_dump())
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO rides (
                    id, driver_name, origin, destination,
                    departure_time, available_seats, price_pln, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_ride.id,
                    new_ride.driver_name,
                    new_ride.origin,
                    new_ride.destination,
                    new_ride.departure_time,
                    new_ride.available_seats,
                    new_ride.price_pln,
                    new_ride.notes,
                ),
            )
            conn.commit()
        return new_ride

    def update(self, ride_id: str, ride_data: RideCreate) -> Optional[Ride]:
        if not self.get_by_id(ride_id):
            return None

        updated_ride = Ride(id=ride_id, **ride_data.model_dump())
        with self._get_connection() as conn:
            conn.execute(
                """
                UPDATE rides
                SET driver_name = ?, origin = ?, destination = ?,
                    departure_time = ?, available_seats = ?, price_pln = ?, notes = ?
                WHERE id = ?
                """,
                (
                    updated_ride.driver_name,
                    updated_ride.origin,
                    updated_ride.destination,
                    updated_ride.departure_time,
                    updated_ride.available_seats,
                    updated_ride.price_pln,
                    updated_ride.notes,
                    ride_id,
                ),
            )
            conn.commit()
        return updated_ride

    def book_seat(self, ride_id: str) -> Optional[Ride]:
        ride = self.get_by_id(ride_id)
        if not ride or ride.available_seats <= 0:
            return None

        updated_data = RideCreate(
            driver_name=ride.driver_name,
            origin=ride.origin,
            destination=ride.destination,
            departure_time=ride.departure_time,
            available_seats=ride.available_seats - 1,
            price_pln=ride.price_pln,
            notes=ride.notes,
        )
        return self.update(ride_id, updated_data)

    def delete(self, ride_id: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM rides WHERE id = ?", (ride_id,))
            conn.commit()
            return cursor.rowcount > 0


# ==========================================
# 4. CONCRETE IMPLEMENTATION 2: AWS DynamoDB
# ==========================================

class DynamoDBRideRepository(RideRepository):
    """Cloud AWS DynamoDB implementation of the RideRepository interface."""

    def __init__(self, table_name: str = "QuickPoolRides", region_name: str = "eu-central-1") -> None:
        # Encapsulation: private boto3 table resource
        self._dynamodb = boto3.resource("dynamodb", region_name=region_name)
        self._table = self._dynamodb.Table(table_name)

    @staticmethod
    def _to_dynamo_item(ride: Ride) -> dict:
        """Convert float values to Decimal as required by AWS DynamoDB."""
        data = ride.model_dump()
        data["price_pln"] = Decimal(str(data["price_pln"]))
        return data

    @staticmethod
    def _from_dynamo_item(item: dict) -> Ride:
        """Convert Decimal values from DynamoDB back into standard Python types."""
        item["price_pln"] = float(item["price_pln"])
        item["available_seats"] = int(item["available_seats"])
        return Ride(**item)

    def get_all(self) -> list[Ride]:
        response = self._table.scan()
        items = response.get("Items", [])
        return [self._from_dynamo_item(item) for item in items]

    def get_by_id(self, ride_id: str) -> Optional[Ride]:
        response = self._table.get_item(Key={"id": ride_id})
        item = response.get("Item")
        return self._from_dynamo_item(item) if item else None

    def create(self, ride_data: RideCreate) -> Ride:
        new_ride = Ride(id=str(uuid.uuid4()), **ride_data.model_dump())
        self._table.put_item(Item=self._to_dynamo_item(new_ride))
        return new_ride

    def update(self, ride_id: str, ride_data: RideCreate) -> Optional[Ride]:
        if not self.get_by_id(ride_id):
            return None
        updated_ride = Ride(id=ride_id, **ride_data.model_dump())
        self._table.put_item(Item=self._to_dynamo_item(updated_ride))
        return updated_ride

    def book_seat(self, ride_id: str) -> Optional[Ride]:
        ride = self.get_by_id(ride_id)
        if not ride or ride.available_seats <= 0:
            return None

        updated_data = RideCreate(
            driver_name=ride.driver_name,
            origin=ride.origin,
            destination=ride.destination,
            departure_time=ride.departure_time,
            available_seats=ride.available_seats - 1,
            price_pln=ride.price_pln,
            notes=ride.notes,
        )
        return self.update(ride_id, updated_data)

    def delete(self, ride_id: str) -> bool:
        if not self.get_by_id(ride_id):
            return False
        self._table.delete_item(Key={"id": ride_id})
        return True


# ==========================================
# 5. DEPENDENCY INJECTION FACTORY
# ==========================================

_sqlite_instance: Optional[SQLiteRideRepository] = None
_dynamo_instance: Optional[DynamoDBRideRepository] = None


def get_ride_repository() -> RideRepository:
    """Factory function for FastAPI Depends() returning the active repository."""
    global _sqlite_instance, _dynamo_instance
    use_aws = os.getenv("USE_AWS", "false").lower() == "true"

    if use_aws:
        if _dynamo_instance is None:
            table_name = os.getenv("DYNAMODB_TABLE", "QuickPoolRides")
            region = os.getenv("AWS_REGION", "eu-central-1")
            _dynamo_instance = DynamoDBRideRepository(
                table_name=table_name, region_name=region)
        return _dynamo_instance

    if _sqlite_instance is None:
        db_path = os.getenv("SQLITE_PATH", "quickpool.db")
        _sqlite_instance = SQLiteRideRepository(db_path=db_path)
    return _sqlite_instance
