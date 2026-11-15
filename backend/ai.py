import os
import re
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Support running both from project root (backend.db) and from backend/ directory (db)
try:
    from backend.db import RideCreate
except ImportError:
    from db import RideCreate

load_dotenv()


# ==========================================
# 1. INPUT DTO FOR AI ENDPOINT
# ==========================================

class AIParseRequest(BaseModel):
    """Data Transfer Object for natural language ride parsing requests."""
    raw_text: str = Field(..., min_length=5, max_length=500)


# ==========================================
# 2. OOP SERVICE: AI Ride Parser (Encapsulation)
# ==========================================

class AIRideParserService:
    """Service encapsulating LLM integration for structured ride extraction."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()
        self._candidate_models = [
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-3.6-flash",
        ]
        self._client = genai.Client(
            api_key=self._api_key) if self._api_key else None

    def parse_message(self, raw_text: str) -> RideCreate:
        """
        Extract structured RideCreate fields from unstructured text.
        Tries candidate LLM models in order and falls back to regex parsing only if all fail.
        """
        if not self._client:
            return self._fallback_parse(raw_text)

        prompt = (
            "You are a transport data extractor for a carpooling app in Tricity (Gdańsk, Sopot, Gdynia). "
            "Extract ride details from the user's message and return ONLY a raw JSON object "
            "(no markdown code blocks) with exact keys: "
            "driver_name (string, default 'Kierowca'), "
            "origin (string in Polish nominative case, e.g. 'Gdynia Redłowo'), "
            "destination (string in Polish nominative case, e.g. 'Olivia Star, Gdańsk'), "
            "departure_time (string, e.g. 'Jutro, 07:45'), "
            "available_seats (integer), "
            "price_pln (number), "
            "notes (string with extra trip info like 'mogę zabrać kogoś po drodze z Sopotu' or empty string).\n\n"
            f"User message: {raw_text}"
        )

        for model_name in self._candidate_models:
            try:
                response = self._client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                    ),
                )
                cleaned_json = re.sub(
                    r"^```(?:json)?\s*|\s*```$", "", (response.text or "").strip()
                )
                return RideCreate.model_validate_json(cleaned_json)
            except Exception as exc:
                print(f"[AI Parser Warning] Model {model_name} failed: {exc}")
                continue

        print(
            "[AIRideParserService] All cloud models failed, using local regex fallback.")
        return self._fallback_parse(raw_text)

    def _fallback_parse(self, raw_text: str) -> RideCreate:
        """
        Deterministic fallback parser used when GEMINI_API_KEY is missing
        or when all external LLM models are unavailable.
        """
        time_match = re.search(r"\b(\d{1,2}:\d{2})\b", raw_text)
        price_match = re.search(
            r"(\d+(?:[.,]\d+)?)\s*(?:zł|pln)", raw_text, re.IGNORECASE
        )
        seats_match = re.search(
            r"(\d+)\s*(?:wolne\s+)?(?:miejsc|seat)", raw_text, re.IGNORECASE
        )
        name_match = re.search(
            r"(?:jestem|tu)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)", raw_text
        )
        route_match = re.search(
            r"\bz\s+([^,]+?)\s+(?:pod|do|na)\s+([^,]+)", raw_text, re.IGNORECASE
        )
        notes_match = re.search(
            r"(?:zł|pln)\s*,?\s*(.+)$", raw_text, re.IGNORECASE
        )

        driver_name = name_match.group(1) if name_match else "Kierowca"
        origin = route_match.group(1).strip(
        ) if route_match else "Gdańsk Wrzeszcz"
        destination = (
            route_match.group(2).strip()
            if route_match
            else "Olivia Business Centre"
        )
        departure_time = (
            f"Jutro, {time_match.group(1)}" if time_match else "Jutro, 08:00"
        )
        price_pln = (
            float(price_match.group(1).replace(",", "."))
            if price_match
            else 10.0
        )
        available_seats = int(seats_match.group(1)) if seats_match else 3
        extracted_notes = (
            notes_match.group(1).strip().rstrip(".") if notes_match else ""
        )

        return RideCreate(
            driver_name=driver_name[:50],
            origin=origin[:100],
            destination=destination[:100],
            departure_time=departure_time[:50],
            available_seats=min(max(available_seats, 1), 8),
            price_pln=price_pln,
            notes=extracted_notes[:300],
        )


# ==========================================
# 3. DEPENDENCY INJECTION FACTORY
# ==========================================

def get_ai_parser_service() -> AIRideParserService:
    """Factory function for FastAPI Depends() returning the AI parser service."""
    return AIRideParserService()
