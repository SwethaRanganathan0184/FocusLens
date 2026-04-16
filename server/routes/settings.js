import { Router } from "express";
import { upsertGoal, getGoals, pool } from "../models/db.js";

const router = Router();

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

router.get("/", async (req, res) => {
  const weekStart = getMonday();
  const goals = await getGoals(weekStart);
  const { rows: blacklist } = await pool.query(`SELECT domain FROM blacklist ORDER BY domain`);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FocusLens — Settings</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f1117; color: #e2e8f0;
      min-height: 100vh; padding: 32px 16px;
    }
    .container { max-width: 620px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
    header { display: flex; justify-content: space-between; align-items: center; }
    .logo  { font-size: 20px; font-weight: 800; }
    .nav-link { color: #6366f1; font-size: 13px; text-decoration: none; }
    .nav-link:hover { text-decoration: underline; }
    .card { background: #1e2330; border-radius: 14px; padding: 20px 24px; }
    .card__title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 4px; }
    .card__subtitle { font-size: 12px; color: #475569; margin-bottom: 16px; }
    .explain {
      background: #0f1117; border-left: 3px solid #6366f1;
      border-radius: 0 8px 8px 0; padding: 10px 14px;
      font-size: 12px; color: #64748b; line-height: 1.6; margin-bottom: 16px;
    }
    .explain strong { color: #94a3b8; }
    .goal-grid { display: flex; flex-direction: column; gap: 10px; }
    .goal-row {
      display: flex; align-items: center; gap: 10px;
      background: #0f1117; border-radius: 8px; padding: 10px 12px;
    }
    .goal-row label { flex: 1; font-size: 13px; color: #cbd5e1; }
    .cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .goal-input {
      width: 70px; background: #1e2330; border: 1px solid #2d3748;
      border-radius: 6px; padding: 5px 8px; color: #e2e8f0;
      font-size: 13px; text-align: center; outline: none;
    }
    .goal-input:focus { border-color: #6366f1; }
    .goal-unit { font-size: 12px; color: #475569; }
    .btn-save {
      margin-top: 14px; width: 100%; background: #6366f1; color: #fff;
      border: none; border-radius: 8px; padding: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-save:hover { background: #4f46e5; }
    .blacklist-add { display: flex; gap: 8px; margin-bottom: 12px; }
    .blacklist-add input {
      flex: 1; background: #0f1117; border: 1px solid #2d3748;
      border-radius: 8px; padding: 8px 12px; color: #e2e8f0;
      font-size: 13px; outline: none;
    }
    .blacklist-add input:focus { border-color: #6366f1; }
    .blacklist-add button {
      background: #6366f1; color: #fff; border: none;
      border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer;
    }
    .blacklist-add button:hover { background: #4f46e5; }
    .blacklist-list { display: flex; flex-direction: column; gap: 6px; }
    .blacklist-item {
      display: flex; justify-content: space-between; align-items: center;
      background: #0f1117; border-radius: 8px; padding: 8px 12px;
      font-size: 13px; color: #94a3b8;
    }
    .blacklist-item button {
      background: none; border: none; color: #f87171;
      cursor: pointer; font-size: 16px; line-height: 1;
    }
    .blacklist-empty { color: #475569; font-size: 13px; text-align: center; padding: 12px 0; }
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #22c55e; color: #fff; padding: 10px 24px;
      border-radius: 99px; font-size: 13px; font-weight: 600;
      opacity: 0; transition: opacity 0.3s; pointer-events: none;
    }
    .toast.show { opacity: 1; }
    .toast.error { background: #ef4444; }
  </style>
</head>
<body>
<div class="container">

  <header>
    <div class="logo">🔍 FocusLens — Settings</div>
    <a href="/report" class="nav-link">← Weekly Report</a>
  </header>

  <!-- Weekly Goals -->
  <div class="card">
    <p class="card__title">Weekly Goals</p>
    <p class="card__subtitle">Set target hours per category for this week</p>
    <div class="explain">
      <strong>How it works:</strong> Set a target (e.g. 20 hrs of Engineering).
      Your weekly report will show how close you are to hitting each goal.
    </div>
    <form class="goal-grid" id="goals-form">
      ${[
        { cat: "Engineering",   color: "#6366f1" },
        { cat: "Documentation", color: "#22d3ee" },
        { cat: "Communication", color: "#f59e0b" },
        { cat: "Productivity",  color: "#34d399" },
        { cat: "Education",     color: "#4ade80" },
        { cat: "Social",        color: "#f472b6" },
        { cat: "Entertainment", color: "#a78bfa" },
        { cat: "News",          color: "#fb923c" },
        { cat: "Finance",       color: "#facc15" },
        { cat: "Health",        color: "#6ee7b7" },
      ].map(({ cat, color }) => {
        const existing = goals.find(g => g.category === cat);
        const val = existing ? existing.target_hrs : "";
        return `
          <div class="goal-row">
            <div class="cat-dot" style="background:${color}"></div>
            <label>${cat}</label>
            <input class="goal-input" type="number" min="0" max="80" step="0.5"
                   name="${cat}" value="${val}" placeholder="—"/>
            <span class="goal-unit">hrs / wk</span>
          </div>`;
      }).join("")}
      <button type="submit" class="btn-save">Save Goals</button>
    </form>
  </div>

  <!-- Blacklist -->
  <div class="card">
    <p class="card__title">Domain Blacklist</p>
    <p class="card__subtitle">Blacklisted domains are excluded from your report entirely</p>
    <div class="explain">
      <strong>Why use this?</strong> Personal banking, health sites, or anything private
      can be blacklisted so it never appears in your weekly summary.
    </div>
    <div class="blacklist-add">
      <input type="text" id="bl-input" placeholder="e.g. reddit.com"/>
      <button onclick="addBlacklist()">Add</button>
    </div>
    <div class="blacklist-list" id="bl-list">
      ${blacklist.length === 0
        ? `<p class="blacklist-empty">No domains blacklisted yet</p>`
        : blacklist.map(({ domain }) => `
            <div class="blacklist-item" id="bl-${domain.replace(/\./g, "_")}">
              <span>🚫 ${domain}</span>
              <button onclick="removeBlacklist('${domain}')" title="Remove">×</button>
            </div>`).join("")
      }
    </div>
  </div>

</div>

<div class="toast" id="toast"></div>

<script>
  const weekStart = "${weekStart}";

  document.getElementById("goals-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputs = e.target.querySelectorAll("input[name]");
    const goals  = [];
    inputs.forEach(input => {
      if (input.value !== "" && Number(input.value) > 0) {
        goals.push({ category: input.name, targetHrs: Number(input.value), weekStart });
      }
    });
    try {
      await fetch("/api/goals/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals }),
      });
      showToast("Goals saved ✓");
    } catch {
      showToast("Failed to save", true);
    }
  });

  async function addBlacklist() {
    const input  = document.getElementById("bl-input");
    const domain = input.value.trim().toLowerCase().replace(/^www\\./, "");
    if (!domain) return;
    try {
      await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const list  = document.getElementById("bl-list");
      const empty = list.querySelector(".blacklist-empty");
      if (empty) empty.remove();
      const id = domain.replace(/\\./g, "_");
      list.insertAdjacentHTML("beforeend", \`
        <div class="blacklist-item" id="bl-\${id}">
          <span>🚫 \${domain}</span>
          <button onclick="removeBlacklist('\${domain}')" title="Remove">×</button>
        </div>\`);
      input.value = "";
      showToast("Domain blacklisted ✓");
    } catch {
      showToast("Failed to add", true);
    }
  }

  async function removeBlacklist(domain) {
    try {
      await fetch("/api/blacklist/" + domain, { method: "DELETE" });
      const id = domain.replace(/\\./g, "_");
      document.getElementById("bl-" + id)?.remove();
      const list = document.getElementById("bl-list");
      if (!list.children.length) {
        list.innerHTML = '<p class="blacklist-empty">No domains blacklisted yet</p>';
      }
      showToast("Removed ✓");
    } catch {
      showToast("Failed to remove", true);
    }
  }

  document.getElementById("bl-input").addEventListener("keydown", e => {
    if (e.key === "Enter") addBlacklist();
  });

  function showToast(msg, isError = false) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className   = "toast show" + (isError ? " error" : "");
    setTimeout(() => t.className = "toast", 2500);
  }
</script>
</body>
</html>`);
});

export default router;