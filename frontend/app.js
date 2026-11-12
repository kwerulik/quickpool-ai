/**
 * QuickPool AI - Frontend Application Logic (Vanilla JS ES6+)
 * Communicates with FastAPI backend via REST API (JSON).
 */

const API_BASE_URL = "http://127.0.0.1:8080/api";

// DOM Elements
const ridesContainer = document.getElementById("rides-container");
const rideForm = document.getElementById("ride-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const searchInput = document.getElementById("search-input");
const refreshBtn = document.getElementById("refresh-btn");
const aiRawText = document.getElementById("ai-raw-text");
const aiParseBtn = document.getElementById("ai-parse-btn");
const sampleAiBtn = document.getElementById("sample-ai-btn");
const toastEl = document.getElementById("toast");
const apiStatusEl = document.getElementById("api-status");

/**
 * Escape HTML special characters to prevent XSS attacks when rendering user data.
 */
function escapeHtml(unsafeText) {
  return String(unsafeText ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Extract up to 2 initials from a driver's name for the avatar badge.
 */
function getInitials(name) {
  const parts = String(name || "Driver")
    .trim()
    .split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Render visual seat indicators (filled circles for available seats).
 */
function renderSeatDots(availableSeats) {
  const count = Math.min(Math.max(Number(availableSeats) || 0, 0), 8);
  if (count === 0) {
    return `<span class="text-xs font-medium text-stone-400">No seats left</span>`;
  }
  const dots = Array.from({ length: count })
    .map(
      () =>
        `<span class="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>`,
    )
    .join("");
  return `
    <div class="flex items-center gap-1.5">
      <div class="flex items-center gap-1">${dots}</div>
      <span class="text-xs font-medium text-stone-600">${count} free</span>
    </div>
  `;
}

/**
 * Display a temporary feedback banner to the user.
 */
function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = `px-4 py-3 rounded-xl text-xs font-medium transition ${
    isError
      ? "bg-red-100 text-red-900 border border-red-200"
      : "bg-[#161615] text-white"
  }`;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3500);
}

/**
 * Check backend health status on startup.
 */
async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error("Non-200 response");
    apiStatusEl.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 align-middle"></span>live api`;
    apiStatusEl.className =
      "text-xs font-medium text-stone-700 bg-stone-200/80 px-3 py-1 rounded-full";
  } catch {
    apiStatusEl.textContent = "api offline (:8080)";
    apiStatusEl.className =
      "text-xs font-medium text-red-700 bg-red-100 px-3 py-1 rounded-full";
  }
}

/**
 * Fetch rides from GET /api/rides (with optional search query) and render cards.
 */
async function loadRides(searchQuery = "") {
  try {
    const url = searchQuery
      ? `${API_BASE_URL}/rides?search=${encodeURIComponent(searchQuery)}`
      : `${API_BASE_URL}/rides`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rides = await response.json();
    renderRides(rides);
  } catch (error) {
    ridesContainer.innerHTML = `
      <div class="bg-white border border-red-200 p-5 rounded-2xl text-red-700 text-xs">
        Cannot reach backend (${escapeHtml(error.message)}). Make sure Uvicorn is running on port 8080.
      </div>
    `;
  }
}

/**
 * Render the list of ride objects as visual route tickets.
 */
function renderRides(rides) {
  if (!rides.length) {
    ridesContainer.innerHTML = `
      <div class="bg-white border border-stone-200/90 p-10 rounded-2xl text-center text-stone-400 text-xs">
        No matching rides found.
      </div>
    `;
    return;
  }

  ridesContainer.innerHTML = rides
    .map((ride) => {
      const isFull = ride.available_seats <= 0;
      const initials = escapeHtml(getInitials(ride.driver_name));

      return `
        <article class="bg-white p-5 rounded-2xl border border-stone-200/90 hover:border-stone-400 transition shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between gap-5">
          
          <!-- Left & Center: Time, Visual Route Timeline, Driver Info -->
          <div class="flex gap-4">
            <!-- Visual Route Timeline -->
            <div class="flex flex-col items-center pt-1.5 shrink-0">
              <span class="w-2.5 h-2.5 rounded-full border-2 border-stone-400 bg-white"></span>
              <span class="w-0.5 h-6 bg-stone-200 my-1"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
            </div>

            <div class="space-y-2.5">
              <!-- Origin & Destination -->
              <div class="space-y-1">
                <div class="text-sm font-semibold text-stone-900 leading-tight">
                  ${escapeHtml(ride.origin)}
                </div>
                <div class="text-sm font-semibold text-stone-900 leading-tight">
                  ${escapeHtml(ride.destination)}
                </div>
              </div>

              <!-- Driver Avatar + Departure Badge + Seats -->
              <div class="flex flex-wrap items-center gap-3 pt-0.5">
                <div class="flex items-center gap-1.5">
                  <span class="w-6 h-6 rounded-full bg-stone-900 text-white font-display text-[10px] font-bold flex items-center justify-center">
                    ${initials}
                  </span>
                  <span class="text-xs font-medium text-stone-700">${escapeHtml(ride.driver_name)}</span>
                </div>

                <span class="text-xs font-medium bg-[#f7f6f2] text-stone-700 px-2.5 py-0.5 rounded-md border border-stone-200">
                  ${escapeHtml(ride.departure_time)}
                </span>

                ${renderSeatDots(ride.available_seats)}
              </div>

              ${
                ride.notes
                  ? `<p class="text-xs text-stone-500">${escapeHtml(ride.notes)}</p>`
                  : ""
              }
            </div>
          </div>

          <!-- Right: Price Tag & Action Buttons -->
          <div class="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100 shrink-0">
            <div class="text-left sm:text-right">
              <span class="font-display text-xl font-bold text-stone-900">
                ${Number(ride.price_pln).toFixed(0)}
              </span>
              <span class="text-xs font-medium text-stone-500">PLN</span>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                onclick="bookSeat('${escapeHtml(ride.id)}')"
                ${isFull ? "disabled" : ""}
                class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isFull
                    ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                    : "bg-orange-600 hover:bg-orange-500 text-white"
                }"
              >
                ${isFull ? "Sold out" : "Book seat"}
              </button>

              <button
                onclick='startEditRide(${JSON.stringify(ride).replace(/'/g, "&#39;")})'
                class="bg-[#f7f6f2] hover:bg-stone-200/80 text-stone-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition"
              >
                Edit
              </button>

              <button
                onclick="deleteRide('${escapeHtml(ride.id)}')"
                title="Remove ride"
                class="bg-[#f7f6f2] hover:bg-red-100 text-stone-400 hover:text-red-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition"
              >
                &times;
              </button>
            </div>
          </div>

        </article>
      `;
    })
    .join("");
}

/**
 * Handle Form Submission: POST (Create) or PUT (Update).
 */
rideForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const rideId = document.getElementById("ride-id").value.trim();
  const payload = {
    driver_name: document.getElementById("driver_name").value.trim(),
    origin: document.getElementById("origin").value.trim(),
    destination: document.getElementById("destination").value.trim(),
    departure_time: document.getElementById("departure_time").value.trim(),
    available_seats: parseInt(
      document.getElementById("available_seats").value,
      10,
    ),
    price_pln: parseFloat(document.getElementById("price_pln").value),
    notes: document.getElementById("notes").value.trim(),
  };

  const isEditing = Boolean(rideId);
  const url = isEditing
    ? `${API_BASE_URL}/rides/${rideId}`
    : `${API_BASE_URL}/rides`;
  const method = isEditing ? "PUT" : "POST";

  try {
    submitBtn.disabled = true;
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || `HTTP ${response.status}`);
    }

    showToast(isEditing ? "Ride updated." : "Ride published.");
    resetForm();
    await loadRides(searchInput.value.trim());
  } catch (error) {
    showToast(`Save failed: ${error.message}`, true);
  } finally {
    submitBtn.disabled = false;
  }
});

/**
 * Book 1 seat via PATCH /api/rides/{id}/book.
 */
async function bookSeat(rideId) {
  try {
    const response = await fetch(`${API_BASE_URL}/rides/${rideId}/book`, {
      method: "PATCH",
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Booking failed");
    }
    showToast("Seat reserved.");
    await loadRides(searchInput.value.trim());
  } catch (error) {
    showToast(`Booking error: ${error.message}`, true);
  }
}

/**
 * Delete a ride via DELETE /api/rides/{id}.
 */
async function deleteRide(rideId) {
  try {
    const response = await fetch(`${API_BASE_URL}/rides/${rideId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Could not delete ride");
    showToast("Ride removed.");
    await loadRides(searchInput.value.trim());
  } catch (error) {
    showToast(`Delete error: ${error.message}`, true);
  }
}

/**
 * Populate the form with existing ride data for editing (PUT).
 */
function startEditRide(ride) {
  document.getElementById("ride-id").value = ride.id;
  document.getElementById("driver_name").value = ride.driver_name;
  document.getElementById("origin").value = ride.origin;
  document.getElementById("destination").value = ride.destination;
  document.getElementById("departure_time").value = ride.departure_time;
  document.getElementById("available_seats").value = ride.available_seats;
  document.getElementById("price_pln").value = ride.price_pln;
  document.getElementById("notes").value = ride.notes || "";

  formTitle.textContent = "Edit Ride";
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Reset form back to 'Create' mode.
 */
function resetForm() {
  rideForm.reset();
  document.getElementById("ride-id").value = "";
  formTitle.textContent = "Post a Ride";
  submitBtn.textContent = "Publish Ride";
  cancelEditBtn.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", resetForm);

/**
 * AI Creative Twist: Send unstructured text to POST /api/rides/parse-ai
 * and auto-fill the ride form with the extracted structured fields.
 */
aiParseBtn.addEventListener("click", async () => {
  const rawText = aiRawText.value.trim();
  if (rawText.length < 5) {
    showToast("Paste a message first.", true);
    return;
  }

  const originalText = aiParseBtn.textContent;
  aiParseBtn.disabled = true;
  aiParseBtn.textContent = "Extracting route...";

  try {
    const response = await fetch(`${API_BASE_URL}/rides/parse-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: rawText }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();

    document.getElementById("driver_name").value = parsed.driver_name;
    document.getElementById("origin").value = parsed.origin;
    document.getElementById("destination").value = parsed.destination;
    document.getElementById("departure_time").value = parsed.departure_time;
    document.getElementById("available_seats").value = parsed.available_seats;
    document.getElementById("price_pln").value = parsed.price_pln;
    document.getElementById("notes").value = parsed.notes || "";

    showToast("Route extracted into form.");
  } catch (error) {
    showToast(`Parser error: ${error.message}`, true);
  } finally {
    aiParseBtn.disabled = false;
    aiParseBtn.textContent = originalText;
  }
});

// Insert a realistic Tricity sample message
sampleAiBtn.addEventListener("click", () => {
  aiRawText.value =
    "Cześć, jestem Michał, jutro o 7:45 jadę z Gdyni Redłowo pod Olivia Star w Gdańsku, mam 3 wolne miejsca po 12 zł, mogę zabrać kogoś po drodze z Sopotu.";
});

// Live search filtering
searchInput.addEventListener("input", (e) => {
  loadRides(e.target.value.trim());
});

refreshBtn.addEventListener("click", () => {
  loadRides(searchInput.value.trim());
});

// Initial bootstrap
checkHealth();
loadRides();
