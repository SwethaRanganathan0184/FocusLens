import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./models/db.js";
import activityRouter  from "./routes/activity.js";
import reportRouter    from "./routes/report.js";
import goalsRouter     from "./routes/goals.js";
import blacklistRouter from "./routes/blacklist.js";
import drilldownRouter from "./routes/drilldown.js";
import settingsRouter from "./routes/settings.js";
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/activity",  activityRouter);
app.use("/api/report",    reportRouter);
app.use("/api/goals",     goalsRouter);
app.use("/api/blacklist", blacklistRouter);
app.use("/drilldown",     drilldownRouter);
app.use("/settings", settingsRouter);
// Weekly report HTML page
app.get("/report", (_req, res) => res.send(buildReportPage()));
app.get("/health", (_req, res) => res.json({ ok: true }));

async function start() {
  await initDb();
  app.listen(PORT, () => console.log(`[FocusLens] Server at http://localhost:${PORT}`));
}
start().catch(console.error);

// ── Weekly Report HTML ────────────────────────────────────────────────────────
function buildReportPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>FocusLens — Weekly Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh;padding:28px 16px}
    .container{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
    header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
    .logo{font-size:20px;font-weight:800}
    .week-label{font-size:12px;color:#475569}
    .nav-link{color:#6366f1;font-size:13px;text-decoration:none;padding:6px 14px;border:1px solid #6366f133;border-radius:6px}
    .nav-link:hover{background:#6366f122}
    .card{background:#1e2330;border-radius:14px;padding:20px 24px}
    .card__title{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:14px}
    .score-row{display:flex;gap:14px;flex-wrap:wrap}
    .score-box{flex:1;min-width:110px;background:#141820;border-radius:10px;padding:14px;text-align:center}
    .score-box__value{font-size:32px;font-weight:800;color:#6366f1}
    .score-box__label{font-size:11px;color:#64748b;margin-top:3px}
    .chart-wrap{position:relative;height:200px}
    .cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
    .cat-card{background:#141820;border-radius:10px;padding:14px 16px;cursor:pointer;transition:background .15s,transform .1s;text-decoration:none;display:block}
    .cat-card:hover{background:#1e2a3a;transform:translateY(-2px)}
    .cat-card-header{display:flex;align-items:center;gap:8px;margin-bottom:10px}
    .cat-dot{width:9px;height:9px;border-radius:50%}
    .cat-card-name{font-size:13px;font-weight:500;color:#e2e8f0}
    .cat-card-time{font-size:22px;font-weight:700;color:#e2e8f0;margin-bottom:2px}
    .cat-card-sub{font-size:11px;color:#475569}
    .cat-bar-wrap{height:3px;background:#2d3748;border-radius:99px;margin-top:10px;overflow:hidden}
    .cat-bar{height:100%;border-radius:99px}
    .hint{font-size:11px;color:#475569;margin-top:-10px;text-align:right}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;color:#64748b;font-weight:500;padding:6px 8px;border-bottom:1px solid #2d3748}
    td{padding:8px;border-bottom:1px solid #141820}
    .chip{display:inline-block;padding:2px 10px;border-radius:99px;font-weight:700;font-size:12px}
    .chip-h{background:#1a2e1a;color:#4ade80}
    .chip-m{background:#2a2a1a;color:#facc15}
    .chip-l{background:#2e1a1a;color:#f87171}
    .empty{color:#475569;text-align:center;padding:20px;font-size:13px}
    #loading{text-align:center;padding:60px;color:#475569;font-size:14px}
  </style>
</head>
<body>
<div id="loading">Loading your report...</div>
<div class="container" id="app" style="display:none">
  <header>
    <div class="logo">🔍 FocusLens</div>
    <div style="display:flex;gap:10px;align-items:center">
      <span class="week-label" id="week-label"></span>
      <a href="/settings" class="nav-link">⚙ Settings</a>
    </div>
  </header>

  <div class="card">
    <p class="card__title">Week at a glance</p>
    <div class="score-row">
      <div class="score-box"><div class="score-box__value" id="avg-score">--</div><div class="score-box__label">Avg focus score</div></div>
      <div class="score-box"><div class="score-box__value" id="total-hrs">--</div><div class="score-box__label">Total hours</div></div>
      <div class="score-box"><div class="score-box__value" id="active-days">--</div><div class="score-box__label">Active days</div></div>
    </div>
  </div>

  <div class="card">
    <p class="card__title">Daily focus score</p>
    <div class="chart-wrap"><canvas id="focusChart"></canvas></div>
  </div>

  <div class="card">
    <p class="card__title">Time by category — <span style="color:#6366f1">click any card to drill down</span></p>
    <div class="cat-grid" id="cat-grid"></div>
  </div>

  <div class="card">
    <p class="card__title">Day by day</p>
    <table>
      <thead><tr><th>Date</th><th>Focus score</th><th>Time tracked</th></tr></thead>
      <tbody id="day-table"></tbody>
    </table>
  </div>
</div>

<script>
const COLORS = {
  Engineering:"#6366f1",Documentation:"#22d3ee",Communication:"#f59e0b",
  Productivity:"#34d399",Social:"#f472b6",News:"#fb923c",
  Entertainment:"#a78bfa",Education:"#4ade80",Finance:"#facc15",
  Shopping:"#f87171",Health:"#6ee7b7",Other:"#64748b",
};

function fmtMins(m) {
  if (m < 60) return m + "m";
  return Math.floor(m/60) + "h " + (m%60) + "m";
}

function getMonday() {
  const d = new Date();
  d.setDate(d.getDate() - (d.getDay()+6)%7);
  return d.toISOString().split("T")[0];
}

async function load() {
  const start = getMonday();
  const end   = new Date().toISOString().split("T")[0];
  const res   = await fetch("/api/report/week?start=" + start + "&end=" + end);
  const data  = await res.json();

  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display     = "flex";

  document.getElementById("week-label").textContent  = "Week of " + (data.start || start);
  document.getElementById("avg-score").textContent   = data.avgFocusScore ?? "--";
  document.getElementById("total-hrs").textContent   = Math.round((data.totalMinutes||0)/60) + "h";
  document.getElementById("active-days").textContent = data.activeDays ?? "--";

  // ✅ fixed
  const cats = data.categories || [];
  const max  = Math.max(...cats.map(c=>c.minutes), 1);
  const grid = document.getElementById("cat-grid");
  grid.innerHTML = cats.map(c => {
    const color = COLORS[c.name] || "#64748b";
    const pct   = Math.round((c.minutes/max)*100);
    return \`<a class="cat-card" href="/drilldown?category=\${encodeURIComponent(c.name)}&start=\${start}&end=\${end}">
      <div class="cat-card-header">
        <div class="cat-dot" style="background:\${color}"></div>
        <span class="cat-card-name">\${c.name}</span>
      </div>
      <div class="cat-card-time">\${fmtMins(c.minutes)}</div>
      <div class="cat-card-sub">\${Math.round(c.minutes/60*10)/10} hours this week</div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:\${pct}%;background:\${color}"></div></div>
    </a>\`;
  }).join("");

  const days = data.days || [];
  document.getElementById("day-table").innerHTML = days.map(d => {
    const chip = d.focusScore >= 70 ? "chip chip-h" : d.focusScore >= 40 ? "chip chip-m" : "chip chip-l";
    return \`<tr><td>\${d.date}</td><td><span class="\${chip}">\${d.focusScore}</span></td><td>\${fmtMins(d.totalMinutes||0)}</td></tr>\`;
  }).join("") || '<tr><td colspan="3" class="empty">No data yet this week</td></tr>';

  if (days.length) {
    const ctx = document.getElementById("focusChart").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: days.map(d => d.date.slice(5)),
        datasets: [{ label:"Focus Score", data: days.map(d=>d.focusScore),
          backgroundColor: days.map(d => d.focusScore>=70?"#6366f1":d.focusScore>=40?"#f59e0b":"#f87171"),
          borderRadius: 6 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }},
        scales:{
          y:{ min:0,max:100, ticks:{color:"#64748b"}, grid:{color:"#1e2330"}},
          x:{ ticks:{color:"#64748b"}, grid:{display:false}}
        }
      }
    });
  }
}

load().catch(() => {
  document.getElementById("loading").textContent = "Error loading report — is the server running?";
});
</script>
</body>
</html>`;
}