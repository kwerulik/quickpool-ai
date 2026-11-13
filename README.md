# QuickPool AI — Serverless Tricity Carpooling MVP

A cloud-native commuter carpooling platform built for the **Gdańsk · Sopot · Gdynia (Tricity)** metropolitan area. Designed with a dual-environment repository architecture (local SQLite for development/testing and AWS DynamoDB + Lambda for serverless production) and an AI-powered natural language ride parser using **Google Gemini Flash**.

## Live Cloud Demo (AWS `eu-north-1` Stockholm)

- **Frontend Web App (Amazon S3):** [http://quickpool-tricity-web-kwerulik.s3-website.eu-north-1.amazonaws.com](http://quickpool-tricity-web-kwerulik.s3-website.eu-north-1.amazonaws.com)
- **Interactive API Swagger Docs (AWS Lambda Function URL):** [https://w3cosmdp4i627vdpgi3xg6sfje0kache.lambda-url.eu-north-1.on.aws/docs](https://w3cosmdp4i627vdpgi3xg6sfje0kache.lambda-url.eu-north-1.on.aws/docs)
- **Health Check Endpoint:** [https://w3cosmdp4i627vdpgi3xg6sfje0kache.lambda-url.eu-north-1.on.aws/api/health](https://w3cosmdp4i627vdpgi3xg6sfje0kache.lambda-url.eu-north-1.on.aws/api/health)

---

## Key Features & Engineering Highlights

1. **AI Smart Paste (Google Gemini + Deterministic Fallback):**
   Users can paste unstructured ride announcements from Messenger, WhatsApp, or Slack (e.g., *"Jutro o 7:45 jadę z Gdyni Redłowo pod Olivia Star, 3 miejsca po 12 zł"*) and automatically populate structured form fields via `POST /api/rides/parse-ai`. Includes a deterministic regex extractor fallback for offline/CI execution.
2. **Passenger Pickup Coordination & Ownership Control:**
   - **Seat Reservation Drawer:** Passengers booking a seat (`PATCH /api/rides/{id}/book`) provide their name, phone/Messenger contact, and exact pickup spot along the route.
   - **Creator Ownership & Demo Driver Mode:** Created ride IDs are tracked in `localStorage` (`Your offer`), restricting edit/delete actions and passenger contact lists to the ride author. Clicking the top-right API status badge toggles **Driver Demo Mode** for presentation purposes.
3. **Repository Pattern & Dependency Injection:**
   Data access is abstracted behind an abstract `RideRepository` interface (`backend/db.py`), seamlessly switching between `SQLiteRideRepository` (`USE_AWS=false`) and `DynamoDBRideRepository` (`USE_AWS=true`) via FastAPI's `Depends()`.
4. **Serverless AWS Architecture:**
   - **Compute:** AWS Lambda (`Python 3.12`) wrapped with `Mangum` ASGI adapter.
   - **Database:** Amazon DynamoDB (`QuickPoolRides` table in `eu-north-1`).
   - **Frontend Hosting:** Amazon S3 Static Website Hosting (`Vanilla JS ES6+` & `Tailwind CSS`).
5. **Automated Testing & CI:**
   Isolated `pytest` suite (`backend/test_api.py`) using temporary fixtures (`tmp_path`) and FastAPI `dependency_overrides`, executed automatically on every push via **GitHub Actions**.

---

## Project Structure

```text
quickpool-ai/
├── .github/workflows/ci.yml   # GitHub Actions CI pipeline (pytest)
├── backend/
│   ├── main.py                # FastAPI endpoints, CORS, Mangum Lambda handler
│   ├── db.py                  # Pydantic schemas & SQLite / DynamoDB repositories
│   ├── ai.py                  # Gemini structured output parser + regex fallback
│   ├── test_api.py            # Automated pytest suite (4 end-to-end API tests)
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── index.html             # Two-column product UI (Tailwind CSS)
│   └── app.js                 # ES6+ REST API client, booking drawer & ownership logic
├── AGENTS.md                  # AI coding assistant architecture guidelines
├── pytest.ini                 # Pytest configuration
└── README.md                  # Project documentation
```

---

## Running Locally

```bash
# 1. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Configure environment variables (optional for AI parser)
# Create a .env file with:
# GEMINI_API_KEY=your_api_key_here
# USE_AWS=false

# 4. Run automated tests
pytest -v

# 5. Start local FastAPI server on port 8080
uvicorn backend.main:app --reload --port 8080
```