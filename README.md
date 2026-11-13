# QuickPool

A lightweight carpooling web app for daily commuters. Users can post rides manually or paste a raw message from Messenger/Slack and let the backend extract the route, time, seats, and price automatically.

**Live Demo:**
- **Web App (S3):** http://quickpool-tricity-web-kwerulik.s3-website.eu-north-1.amazonaws.com
- **API Docs (Swagger):** https://w3cosmdp4i627vdpgi3xg6sfje0kache.lambda-url.eu-north-1.on.aws/docs

## Stack

- **Backend:** Python 3.12, FastAPI, Pydantic v2, Mangum
- **Database:** SQLite (local dev/tests) / AWS DynamoDB (production)
- **AI Parser:** Google Gemini API (`google-genai`) with regex fallback
- **Frontend:** Vanilla JS (ES6+), Tailwind CSS
- **Infra & CI:** AWS Lambda, S3, DynamoDB (`eu-north-1`), GitHub Actions (`pytest`)

## How It Works

- **Dual database setup:** `RideRepository` switches between local SQLite (`USE_AWS=false`) and DynamoDB (`USE_AWS=true`) via FastAPI Dependency Injection.
- **Smart Paste (`POST /api/rides/parse-ai`):** Parses unstructured text into structured ride fields. Falls back to regex extraction if no API key is configured.
- **Seat booking (`PATCH /api/rides/{id}/book`):** Decrements available seats and saves the passenger's name, contact info, and pickup spot.
- **Ride ownership:** Created ride IDs are stored in `localStorage` so only the author sees edit/delete buttons and passenger contacts. Clicking the status badge in the top right toggles a demo driver view for all offers.

## Local Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt

# Optional: create .env with GEMINI_API_KEY=your_key and USE_AWS=false

pytest
uvicorn backend.main:app --reload --port 8080
```
