import { Router } from "express";
import { getWeekReport } from "../services/reportGenerator.js";

const router = Router();

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

router.get("/", async (req, res) => {
  const start = req.query.start || getMonday();
  const report = await getWeekReport(start);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FocusLens — Weekly Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 32px 16px;
    }

    .container { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }

    header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .week-label { color: #64748b; font-size: 13px; }

    .card { background: #1e2330; border-radius: 14px; padding: 20px 24px; }
    .card__title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
      margin-bottom: 16px;
    }

    .score-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .score-box {
      flex: 1;
      min-width: 120px;
      background: #0f1117;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }
    .score-box__value { font-size: 36px; font-weight: 800; color: #6366f1; }
    .score-box__label { font-size: 11px; color: #64748b; margin-top: 4px; }

    .chart-wrap { position: relative; height: 200px; }

    .cat-list { display: flex; flex-direction: column; gap: 10px; }
    .cat-row  { display: flex; flex-direction: column; gap: 4px; }
    .cat-meta { display: flex; justify-content: space-between; font-size: 13px; }
    .bar-track { height: 6px; background: #2d3748; border-radius: 99px; overflow: hidden; }
    .bar-fill  { height: 100%; border-radius: 99px; }

    .bar--Engineering { background: #6366f1; }
    .bar--Docs        { background: #22d3ee; }
    .bar--Social      { background: #f472b6; }
    .bar--News        { background: #fb923c; }
    .bar--Video       { background: #a78bfa; }
    .bar--Education   { background: #34d399; }
    .bar--Finance     { background: #facc15; }
    .bar--Shopping    { background: #f87171; }
    .bar--Other       { background: #64748b; }

    .goal-list  { display: flex; flex-direction: column; gap: 12px; }
    .goal-row   { display: flex; flex-direction: column; gap: 5px; }
    .goal-meta  { display: flex; justify-content: space-between; font-size: 13px; }
    .goal-pct   { color: #6366f1; font-weight: 600; }
    .goal-track { height: 8px; background: #2d3748; border-radius: 99px; overflow: hidden; }
    .goal-bar   { height: 100%; background: #6366f1; border-radius: 99px; transition: width 0.6s ease; }
    .goal-bar--done { background: #34d399; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; color: #64748b; font-weight: 500; padding: 6px 8px; border-bottom: 1px solid #2d3748; }
    td { padding: 8px; border-bottom: 1px solid #1a1f2e; }

    .score-chip { display: inline-block; padding: 2px 10px; border-radius: 99px; font-weight: 700; font-size: 12px; }
    .score-chip--high { background: #1a2e1a; color: #4ade80; }
    .score-chip--mid  { background: #2a2a1a; color: #facc15; }
    .score-chip--low  { background: #2e1a1a; color: #f87171; }

    .empty { color: #475569; text-align: center; padding: 24px; font-size: 13px; }
    code   { background: #2d3748; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
<div class="container">

  <header>
    <div class="logo">🔍 FocusLens</div>
    <a href="/settings" class="nav-link">⚙️ Settings</a>
    <div class="week-label">Week of ${report.weekStart}</div>
  </header>

  <div class="card">
    <p class="card__title">Week at a Glance</p>
    <div class="score-row">
      <div class="score-box">
        <div class="score-box__value">${report.avgFocusScore}</div>
        <div class="score-box__label">Avg Focus Score</div>
      </div>
      <div class="score-box">
        <div class="score-box__value">${Math.round(report.totalMins / 60)}</div>
        <div class="score-box__label">Total Hours</div>
      </div>
      <div class="score-box">
        <div class="score-box__value">${report.days.length}</div>
        <div class="score-box__label">Active Days</div>
      </div>
    </div>
  </div>

  <div class="card">
    <p class="card__title">Daily Focus Score</p>
    <div class="chart-wrap">
      <canvas id="focusChart"></canvas>
    </div>
  </div>

  <div class="card">
    <p class="card__title">Time by Category</p>
    ${report.categories.length === 0
      ? `<p class="empty">No data yet this week</p>`
      : `<div class="cat-list">
          ${(() => {
            const max = Math.max(...report.categories.map(c => c.minutes));
            return report.categories
              .sort((a, b) => b.minutes - a.minutes)
              .map(({ category, minutes }) => {
                const hrs   = Math.floor(minutes / 60);
                const mins  = minutes % 60;
                const label = hrs > 0 ? hrs + "h " + mins + "m" : mins + "m";
                const pct   = Math.round((minutes / max) * 100);
                return `<div class="cat-row">
                  <div class="cat-meta"><span>${category}</span><span>${label}</span></div>
                  <div class="bar-track">
                    <div class="bar-fill bar--${category}" style="width:${pct}%"></div>
                  </div>
                </div>`;
              }).join("")
          })()}
        </div>`
    }
  </div>

  <div class="card">
    <p class="card__title">Goal Progress</p>
    ${report.goalProgress.length === 0
      ? `<p class="empty">No goals set yet.<br><br>
         Add one via: <code>POST /api/goals</code> with <code>{ category, targetHrs, weekStart }</code></p>`
      : `<div class="goal-list">
          ${report.goalProgress.map(g => `
            <div class="goal-row">
              <div class="goal-meta">
                <span>${g.category}</span>
                <span><span class="goal-pct">${g.pct}%</span> &nbsp;${g.actualHrs}h / ${g.targetHrs}h</span>
              </div>
              <div class="goal-track">
                <div class="goal-bar ${g.pct >= 100 ? "goal-bar--done" : ""}"
                     style="width:${Math.min(g.pct, 100)}%"></div>
              </div>
            </div>`).join("")}
        </div>`
    }
  </div>

  <div class="card">
    <p class="card__title">Day by Day</p>
    ${report.days.length === 0
      ? `<p class="empty">No data yet this week</p>`
      : `<table>
          <thead>
            <tr><th>Date</th><th>Focus Score</th><th>Time Tracked</th></tr>
          </thead>
          <tbody>
            ${report.days.map(d => {
              const chipClass = d.focusScore >= 70 ? "score-chip--high"
                              : d.focusScore >= 40 ? "score-chip--mid"
                              : "score-chip--low";
              const hrs  = Math.floor(d.totalMins / 60);
              const mins = d.totalMins % 60;
              return `<tr>
                <td>${d.date}</td>
                <td><span class="score-chip ${chipClass}">${d.focusScore}</span></td>
                <td>${hrs > 0 ? hrs + "h " : ""}${mins}m</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`
    }
  </div>

</div>
<script>
  const days = ${JSON.stringify(report.days)};
  const ctx  = document.getElementById("focusChart").getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: days.map(d => d.date.slice(5)),
      datasets: [{
        label: "Focus Score",
        data:  days.map(d => d.focusScore),
        backgroundColor: days.map(d =>
          d.focusScore >= 70 ? "#6366f1" :
          d.focusScore >= 40 ? "#f59e0b" : "#f87171"
        ),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { color: "#64748b" },
          grid:  { color: "#1e2330" }
        },
        x: {
          ticks: { color: "#64748b" },
          grid:  { display: false }
        }
      }
    }
  });
</script>
</body>
</html>`);
});

export default router;