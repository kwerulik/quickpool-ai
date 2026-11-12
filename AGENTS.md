# AI Agent Instructions — QuickPool AI

## Project Overview
QuickPool AI is a full-stack carpooling MVP built for the Tricity (Gdańsk/Sopot/Gdynia) area.
It combines a REST API CRUD for managing shared rides with an AI Natural Language Parser that extracts structured ride offers from casual text messages.

## Tech Stack & Architecture Constraints
- **Backend:** Python 3.12, FastAPI, Pydantic v2, Mangum (AWS Lambda adapter).
- **Object-Oriented Design (OOP & SOLID):**
  - Strictly apply OOP pillars: **Abstraction** (`abc.ABC`, `@abstractmethod`), **Inheritance**, **Polymorphism**, and **Encapsulation**.
  - Use **Dependency Injection** (`fastapi.Depends`) to decouple API routes from concrete database and service implementations.
- **Database (Dual-Mode Repository Pattern):**
  - Abstract base class: `RideRepository(ABC)`.
  - Local implementation (`USE_AWS=false`): `SQLiteRideRepository` using built-in `sqlite3` (`quickpool.db`) with automatic data seeding.
  - Cloud implementation (`USE_AWS=true`): `DynamoDBRideRepository` using `boto3` (`QuickPoolRides` table).
- **AI Integration:** Encapsulated inside `AIRideParserService` class using Google Gemini API (`google-genai` SDK) with Structured Outputs and a deterministic fallback mode when `GEMINI_API_KEY` is not configured.
- **Frontend:** Pure HTML5, Vanilla JavaScript (ES6+ class-based controller), and Tailwind CSS via CDN.

## Directory Structure
- `backend/main.py` — FastAPI app, CORS middleware, Dependency Injection wiring, REST endpoints, and Mangum handler.
- `backend/db.py` — Pydantic domain models and OOP Repository hierarchy (`RideRepository`, `SQLiteRideRepository`, `DynamoDBRideRepository`).
- `backend/ai.py` — `AIRideParserService` class handling LLM prompt and structured parsing.
- `backend/test_api.py` — Pytest suite testing CRUD and AI parsing endpoints.
- `frontend/index.html` — Single-page responsive UI styled with Tailwind CSS CDN.
- `frontend/app.js` — OOP Vanilla JS frontend controller (`QuickPoolApp` class).

## Coding Standards for AI Assistants
1. Follow clean Object-Oriented design patterns and SOLID principles (Single Responsibility, Dependency Inversion).
2. Use private/protected attributes (`_conn`, `_table`, `_client`) to enforce proper encapsulation of external resources.
3. Enforce strict Python type hints and Pydantic v2 validation across all inputs and outputs.
4. Keep methods small, readable, and self-documenting without unnecessary external dependencies.