// FocusLens — Popup JS

const SERVER = "http://localhost:3000";

const CATEGORY_COLORS = {
  Engineering:"#6366f1", Documentation:"#22d3ee", Communication:"#f59e0b",
  Productivity:"#34d399", Social:"#f472b6", News:"#fb923c",
  Entertainment:"#a78bfa", Education:"#4ade80", Finance:"#facc15",
  Shopping:"#f87171", Health:"#6ee7b7", Other:"#64748b",
  Video:"#a78bfa", Docs:"#22d3ee",
};

document.getElementById("today-date").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "short", month: "short", day: "numeric"
});

// ── Init: end current session + flush + load ──────────────────
async function init() {
  try {
    // Tell SW to end active session and flush buffer
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "FLUSH_NOW" }, () => resolve());
      setTimeout(resolve, 4000); // fallback
    });
    // Small wait for server to process
    await new Promise(r => setTimeout(r, 600));
  } catch {}
  await loadTodayStats();
}

async function loadTodayStats() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const res   = await fetch(`${SERVER}/api/report/day?date=${today}`);
    const data  = await res.json();

    console.log("[FocusLens popup] data:", data);

    const totalMins = data.totalMinutes ?? data.totalMins ?? 0;
    const score     = data.focusScore ?? 0;

    document.getElementById("focus-score").textContent = score;
    document.getElementById("active-time").textContent = fmtMins(totalMins);

    const cats = (data.categories || []).map(c => ({
      name:    c.name ?? c.category,
      minutes: c.minutes,
    }));

    document.getElementById("top-category").textContent = cats[0]?.name ?? "--";
    renderCategories(cats);
  } catch (err) {
    console.error("[FocusLens popup] error:", err);
    document.getElementById("category-list").innerHTML =
      '<div class="empty">Server offline — run npm run dev</div>';
  }
}

function renderCategories(cats) {
  const el = document.getElementById("category-list");
  if (!cats.length) {
    el.innerHTML = '<div class="empty">No activity yet today</div>';
    return;
  }
  const max = Math.max(...cats.map(c => c.minutes));
  el.innerHTML = cats.map(c => {
    const color = CATEGORY_COLORS[c.name] || "#64748b";
    const pct   = Math.round((c.minutes / max) * 100);
    return `<div class="cat-row">
      <div class="cat-meta">
        <span style="display:flex;align-items:center;gap:6px">
          <span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block"></span>
          ${c.name}
        </span>
        <span style="color:#64748b">${fmtMins(c.minutes)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
  }).join("");
}

document.getElementById("btn-report").addEventListener("click", () => {
  chrome.tabs.create({ url: `${SERVER}/report` });
});

document.getElementById("btn-settings").addEventListener("click", () => {
  chrome.tabs.create({ url: `${SERVER}/settings` });
});

function fmtMins(m) {
  if (!m && m !== 0) return "--";
  if (m < 60) return Math.round(m) + "m";
  return Math.floor(m / 60) + "h " + Math.round(m % 60) + "m";
}

init();