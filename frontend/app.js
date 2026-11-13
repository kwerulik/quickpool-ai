/**
 * QuickPool AI - Frontend Application Logic (Vanilla JS ES6+)
 * Communicates with FastAPI backend via REST API (JSON).
 */

const API_BASE_URL =
  "https://w3cosmdp4i627vdpgi3xg6sfje0kache.lambda-url.eu-north-1.on.aws/api";
const OWNED_RIDES_KEY = "quickpool_my_rides";

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

let demoAdminMode = false;

/**
 * Manage locally owned ride IDs so only the creator can edit/delete or view passenger contacts.
 */
function getOwnedRideIds() {
  try {
    return JSON.parse(localStorage.getItem(OWNED_RIDES_KEY) || "[]");
  } catch {
    return [];
  }
}

function markRideAsOwned(rideId) {
  const owned = getOwnedRideIds();
  if (!owned.includes(rideId)) {
    owned.push(rideId);
    localStorage.setItem(OWNED_RIDES_KEY, JSON.stringify(owned));
  }
}

function isRideOwner(rideId) {
  return demoAdminMode || getOwnedRideIds().includes(rideId);
}

/**
 * Split notes into public trip notes and passenger bookings ([Booking: ...]).
 */
function parseNotesAndBookings(rawNotes) {
  const text = String(rawNotes || "");
  const bookings = [];
  const cleanNotes = text
    .replace(/\|?\s*\[Booking:\s*([^\]]+)\]/g, (_, info) => {
      bookings.push(info.trim());
      return "";
    })
    .trim();
  return { cleanNotes, bookings };
}

function escapeHtml(unsafeText) {
  return String(unsafeText ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getInitials(name) {
  const parts = String(name || "Driver")
    .trim()
    .split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error("Non-200 response");
    updateStatusBadge(true);
  } catch {
    apiStatusEl.textContent = "api offline";
    apiStatusEl.className =
      "text-xs font-medium text-red-700 bg-red-100 px-3 py-1 rounded-full";
  }
}

function updateStatusBadge(online = true) {
  if (!online) return;
  apiStatusEl.innerHTML = `
    <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 align-middle"></span>
    <span>${demoAdminMode ? "live api · driver view (all)" : "live api · passenger view"}</span>
  `;
  apiStatusEl.title =
    "Click to toggle Demo Driver Mode (unlocks edit/delete for all rides)";
  apiStatusEl.className =
    "cursor-pointer select-none text-xs font-medium text-stone-700 bg-stone-200/80 hover:bg-stone-300/80 px-3 py-1 rounded-full transition";
}

// Click the status pill to toggle Demo Admin Mode during presentations
apiStatusEl.addEventListener("click", () => {
  demoAdminMode = !demoAdminMode;
  updateStatusBadge(true);
  loadRides(searchInput.value.trim());
  showToast(
    demoAdminMode
      ? "Driver Demo Mode ON: You can now manage all rides and view all passenger contacts."
      : "Standard Mode: You can only edit/delete rides created in this browser.",
  );
});

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
        Cannot reach backend (${escapeHtml(error.message)}).
      </div>
    `;
  }
}

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
      const isOwner = isRideOwner(ride.id);
      const initials = escapeHtml(getInitials(ride.driver_name));
      const { cleanNotes, bookings } = parseNotesAndBookings(ride.notes);

      // Clean ride copy without bookings for editing
      const editableRide = { ...ride, notes: cleanNotes };

      return `
        <article class="bg-white p-5 rounded-2xl border border-stone-200/90 hover:border-stone-400 transition shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col gap-4">
          <div class="flex flex-col sm:flex-row justify-between gap-5">
            <!-- Left: Route Timeline & Details -->
            <div class="flex gap-4">
              <div class="flex flex-col items-center pt-1.5 shrink-0">
                <span class="w-2.5 h-2.5 rounded-full border-2 border-stone-400 bg-white"></span>
                <span class="w-0.5 h-6 bg-stone-200 my-1"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
              </div>

              <div class="space-y-2.5">
                <div class="space-y-1">
                  <div class="text-sm font-semibold text-stone-900 leading-tight">
                    ${escapeHtml(ride.origin)}
                  </div>
                  <div class="text-sm font-semibold text-stone-900 leading-tight">
                    ${escapeHtml(ride.destination)}
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 pt-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="w-6 h-6 rounded-full bg-stone-900 text-white font-display text-[10px] font-bold flex items-center justify-center">
                      ${initials}
                    </span>
                    <span class="text-xs font-medium text-stone-700">${escapeHtml(ride.driver_name)}</span>
                    ${
                      isOwner
                        ? `<span class="text-[10px] font-semibold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">Your offer</span>`
                        : ""
                    }
                  </div>

                  <span class="text-xs font-medium bg-[#f7f6f2] text-stone-700 px-2.5 py-0.5 rounded-md border border-stone-200">
                    ${escapeHtml(ride.departure_time)}
                  </span>

                  ${renderSeatDots(ride.available_seats)}
                </div>

                ${
                  cleanNotes
                    ? `<p class="text-xs text-stone-500">${escapeHtml(cleanNotes)}</p>`
                    : ""
                }
              </div>
            </div>

            <!-- Right: Price & Actions -->
            <div class="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100 shrink-0">
              <div class="text-left sm:text-right">
                <span class="font-display text-xl font-bold text-stone-900">
                  ${Number(ride.price_pln).toFixed(0)}
                </span>
                <span class="text-xs font-medium text-stone-500">PLN</span>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  onclick="toggleBookingDrawer('${escapeHtml(ride.id)}')"
                  ${isFull ? "disabled" : ""}
                  class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isFull
                      ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                      : "bg-orange-600 hover:bg-orange-500 text-white"
                  }"
                >
                  ${isFull ? "Sold out" : "Book seat"}
                </button>

                ${
                  isOwner
                    ? `
                  <button
                    onclick='startEditRide(${JSON.stringify(editableRide).replace(/'/g, "&#39;")})'
                    class="bg-[#f7f6f2] hover:bg-stone-200/80 text-stone-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition"
                  >
                    Edit
                  </button>
                  <button
                    onclick="deleteRide('${escapeHtml(ride.id)}')"
                    title="Remove your ride"
                    class="bg-[#f7f6f2] hover:bg-red-100 text-stone-400 hover:text-red-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition"
                  >
                    &times;
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>

          <!-- Inline Passenger Booking Drawer (hidden by default) -->
          <div id="book-drawer-${escapeHtml(ride.id)}" class="hidden bg-[#f7f6f2] p-3.5 rounded-xl border border-stone-200 space-y-2.5">
            <div class="text-xs font-semibold text-stone-800">
              Leave pickup details for ${escapeHtml(ride.driver_name)}:
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                id="p-name-${escapeHtml(ride.id)}"
                placeholder="Your name (e.g. Ania)"
                class="bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:border-stone-900 focus:outline-none"
              />
              <input
                type="text"
                id="p-contact-${escapeHtml(ride.id)}"
                placeholder="Phone / Messenger"
                class="bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:border-stone-900 focus:outline-none"
              />
              <input
                type="text"
                id="p-spot-${escapeHtml(ride.id)}"
                placeholder="Pickup spot (e.g. Sopot PKP)"
                class="bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:border-stone-900 focus:outline-none"
              />
            </div>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                onclick="toggleBookingDrawer('${escapeHtml(ride.id)}')"
                class="text-xs text-stone-500 hover:text-stone-800 px-2.5 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onclick="confirmBookSeat('${escapeHtml(ride.id)}')"
                class="bg-[#161615] hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition"
              >
                Confirm reservation
              </button>
            </div>
          </div>

          <!-- Driver-Only View: List of Booked Passengers & Pickup Spots -->
          ${
            isOwner && bookings.length > 0
              ? `
            <div class="bg-stone-50 border-t border-stone-200/80 pt-2.5 px-3 py-2 rounded-lg text-xs">
              <span class="font-semibold text-stone-700">Passengers to pick up (${bookings.length}):</span>
              <ul class="mt-1 space-y-0.5 text-stone-600 list-disc list-inside">
                ${bookings.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
              </ul>
            </div>
          `
              : ""
          }
        </article>
      `;
    })
    .join("");
}

/**
 * Show/hide the inline passenger details drawer for a specific ride card.
 */
function toggleBookingDrawer(rideId) {
  const drawer = document.getElementById(`book-drawer-${rideId}`);
  if (drawer) drawer.classList.toggle("hidden");
}

/**
 * Submit passenger contact & pickup spot via PATCH /api/rides/{id}/book.
 */
async function confirmBookSeat(rideId) {
  const passenger_name =
    document.getElementById(`p-name-${rideId}`)?.value.trim() || "Pasażer";
  const passenger_contact =
    document.getElementById(`p-contact-${rideId}`)?.value.trim() ||
    "Brak kontaktu";
  const pickup_spot =
    document.getElementById(`p-spot-${rideId}`)?.value.trim() || "Na trasie";

  try {
    const response = await fetch(`${API_BASE_URL}/rides/${rideId}/book`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passenger_name, passenger_contact, pickup_spot }),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Booking failed");
    }
    showToast(
      `Seat booked! Driver received your pickup spot (${pickup_spot}).`,
    );
    await loadRides(searchInput.value.trim());
  } catch (error) {
    showToast(`Booking error: ${error.message}`, true);
  }
}

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

    const savedRide = await response.json();
    markRideAsOwned(savedRide.id);

    showToast(
      isEditing
        ? "Ride updated."
        : "Ride published. You can manage it from this browser.",
    );
    resetForm();
    await loadRides(searchInput.value.trim());
  } catch (error) {
    showToast(`Save failed: ${error.message}`, true);
  } finally {
    submitBtn.disabled = false;
  }
});

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

function resetForm() {
  rideForm.reset();
  document.getElementById("ride-id").value = "";
  formTitle.textContent = "Post a Ride";
  submitBtn.textContent = "Publish Ride";
  cancelEditBtn.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", resetForm);

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

sampleAiBtn.addEventListener("click", () => {
  aiRawText.value =
    "Cześć, jestem Michał, jutro o 7:45 jadę z Gdyni Redłowo pod Olivia Star w Gdańsku, mam 3 wolne miejsca po 12 zł, mogę zabrać kogoś po drodze z Sopotu.";
});

searchInput.addEventListener("input", (e) => {
  loadRides(e.target.value.trim());
});

refreshBtn.addEventListener("click", () => {
  loadRides(searchInput.value.trim());
});

checkHealth();
loadRides();
