# QuickPool — Commuter Carpooling MVP

Full-stack carpooling web application designed for daily commuters in the Tricity area. Drivers can publish shared rides and manage passenger pickups, while passengers can search routes and reserve seats.

**Live Cloud Demo & Video:**
- **Web App (Amazon S3):** http://quickpool-tricity-web-kwerulik.s3-website.eu-north-1.amazonaws.com
- **API Swagger Docs (AWS Lambda):** https://w3cosmdp4i627vdpgi3xg6sfje0kache.lambda-url.eu-north-1.on.aws/docs
- **Video Walkthrough:** [Watch `demo.mp4` in the repository](./demo.mp4)

## Features & Creative Twist

- **Full CRUD & Seat Reservations:** Create, read, filter, update (`PUT`), and delete (`DELETE`) ride offers. Booking a seat (`PATCH /api/rides/{id}/book`) atomically decrements available seats and attaches the passenger's name, contact info, and pickup spot.
- **Creative Twist — AI Smart Paste (`POST /api/rides/parse-ai`):** Instead of filling out forms manually, drivers can copy a casual message from Messenger/Slack (e.g., *"Jutro o 7:45 jadę z Gdyni Redłowo pod Olivia Star, mam 3 miejsca po 12 zł"*) and let **Google Gemini (`gemini-3.5-flash-lite`)** extract structured JSON fields automatically. Requires `GEMINI_API_KEY` (already active in the **Live Cloud Demo** above; locally falls back to a basic regex parser if no API key is provided).
- **Creator Ownership & Demo Mode:** Ride IDs created in the current browser are saved in `localStorage` (`Your offer`), restricting edit/delete actions and passenger contact lists to the author. Clicking the top-right API status badge toggles **Driver Demo Mode** to preview management controls for all rides.

## Tech Stack & Architecture

- **Backend:** Python 3.12, FastAPI, Pydantic v2, Mangum (ASGI Lambda adapter)
- **Database (Repository Pattern):** Abstract `RideRepository` interface with `SQLiteRideRepository` (default local zero-config database with auto-seeding) and `DynamoDBRideRepository` (AWS cloud production), injected via FastAPI `Depends()`.
- **Frontend:** Semantic HTML5, modular Vanilla JavaScript (ES6+), Tailwind CSS
- **Testing & CI:** `pytest` with isolated temporary SQLite fixtures (`tmp_path`), executed via GitHub Actions (`.github/workflows/ci.yml`).

## How to Run Locally (Step-by-Step)

The project uses a local **SQLite** database (`quickpool.db`) by default and seeds initial sample rides automatically.

### 1. Start the Backend API (Port 8080)

```bash
git clone [https://github.com/kwerulik/quickpool-ai.git](https://github.com/kwerulik/quickpool-ai.git)
cd quickpool-ai

python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt

uvicorn backend.main:app --reload --port 8080
```

> **Note on AI Smart Paste:** Full natural-language AI extraction requires a Google Gemini API key. To enable it locally, create a `.env` file in the root directory with `GEMINI_API_KEY=your_api_key` before starting `uvicorn` (or test it directly on the **Live Cloud Demo** link above). Without `GEMINI_API_KEY`, Smart Paste won't use the LLM and will only apply a basic local regex fallback.

### 2. Start the Frontend (Port 5500)

Open a second terminal in the project root and serve the `frontend/` folder:

```bash
python -m http.server 5500 --directory frontend
```

Then open **http://localhost:5500** in your browser. The frontend automatically detects `localhost` and connects to `http://127.0.0.1:8080/api`.

### 3. Run Automated Tests

```bash
pytest -v
```

## How AI Tools Were Used

- **Architecture & Guidelines (`AGENTS.md`):** Defined strict architectural constraints (OOP Repository Pattern, FastAPI Dependency Injection, Pydantic v2 validation, and separation of concerns) in `AGENTS.md` and `.github/copilot-instructions.md` before generating code.
- **Google Gemini & AI Coding Assistants:** Used Gemini to scaffold the FastAPI boilerplate, design the dual SQLite/DynamoDB repository abstraction, build the two-column Tailwind UI, and troubleshoot AWS Lambda and CloudWatch logs.
