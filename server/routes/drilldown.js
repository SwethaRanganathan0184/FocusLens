import { Router } from "express";
import { getActivityByCategory } from "../models/db.js";

const router = Router();

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day + 6) % 7);
  return d.toISOString().split("T")[0];
}

const CATEGORY_COLORS = {
  Engineering: "#6366f1", Documentation: "#22d3ee", Communication: "#f59e0b",
  Productivity: "#34d399", Social: "#f472b6", News: "#fb923c",
  Entertainment: "#a78bfa", Education: "#4ade80", Finance: "#facc15",
  Shopping: "#f87171", Health: "#6ee7b7", Other: "#64748b",
};

const BROAD_COLORS = {
  "Education": "#4ade80", "Entertainment": "#a78bfa", "Sports": "#fb923c",
  "Music": "#f472b6", "News & Politics": "#fb923c", "Gaming": "#6366f1",
  "Finance": "#facc15", "Health & Fitness": "#6ee7b7", "Technology": "#22d3ee",
  "Comedy": "#fbbf24", "Travel": "#34d399", "Food": "#f97316",
  "Science": "#818cf8", "Other": "#64748b",
};

router.get("/", async (req, res) => {
  const category = req.query.category || "Entertainment";
  const start    = req.query.start    || getMonday();
  const end      = req.query.end      || new Date().toISOString().split("T")[0];
  const broad    = req.query.broad    || null;

  const rows = await getActivityByCategory(category, start, end);

  const filteredRows = broad
    ? rows.filter(r => r.broad_category === broad)
    : rows;

  const broadMap = {};
  for (const r of rows) {
    const key = r.broad_category || "Uncategorised";
    broadMap[key] = (broadMap[key] || 0) + r.duration;
  }
  const broadBreakdown = Object.entries(broadMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, secs]) => ({ name, minutes: Math.round(secs / 60) }));

  const subtopicMap = {};
  for (const r of filteredRows) {
    const key = r.subtopic || "Other";
    if (!subtopicMap[key]) subtopicMap[key] = { minutes: 0, titles: [] };
    subtopicMap[key].minutes += Math.round(r.duration / 60);
    if (r.page_title && !subtopicMap[key].titles.includes(r.page_title)) {
      subtopicMap[key].titles.push(r.page_title);
    }
  }
  const subtopicBreakdown = Object.entries(subtopicMap)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .map(([name, data]) => ({ name, ...data }));

  const totalMins = Math.round(rows.reduce((s, r) => s + r.duration, 0) / 60);
  const catColor  = CATEGORY_COLORS[category] || "#6366f1";

  const domainMap = {};
  for (const r of filteredRows) {
    domainMap[r.domain] = (domainMap[r.domain] || 0) + r.duration;
  }
  const topDomains = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, secs]) => ({ domain, minutes: Math.round(secs / 60) }));

  const html = buildHTML({
    category, start, end, broad, catColor,
    totalMins, broadBreakdown, subtopicBreakdown, topDomains,
  });

  res.send(html);
});

function fmtMins(m) {
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

function buildHTML({ category, start, end, broad, catColor, totalMins, broadBreakdown, subtopicBreakdown, topDomains }) {
  const maxBroad    = broadBreakdown[0]?.minutes || 1;
  const maxSubtopic = subtopicBreakdown[0]?.minutes || 1;

  const broadRows = broadBreakdown.map(b => {
    const pct   = Math.round((b.minutes / maxBroad) * 100);
    const color = BROAD_COLORS[b.name] || "#64748b";
    const isActive = broad === b.name;
    return `
      <div class="row ${isActive ? "row--active" : ""}" onclick="drillBroad('${encodeURIComponent(b.name)}')">
        <div class="row-label">
          <span class="dot" style="background:${color}"></span>
          <span>${b.name}</span>
          ${isActive ? '<span class="badge">Viewing</span>' : ""}
        </div>
        <div class="row-right">
          <div class="bar-wrap"><div class="bar" style="width:${pct}%;background:${color}"></div></div>
          <span class="row-time">${fmtMins(b.minutes)}</span>
        </div>
      </div>`;
  }).join("");

  const subtopicRows = subtopicBreakdown.map(s => {
    const pct = Math.round((s.minutes / maxSubtopic) * 100);
    const titles = s.titles.slice(0, 3).map(t => `<li>${t}</li>`).join("");
    const moreTitles = s.titles.length > 3 ? `<li class="more">+${s.titles.length - 3} more</li>` : "";
    return `
      <div class="subtopic-card" onclick="this.classList.toggle('open')">
        <div class="subtopic-header">
          <span class="subtopic-name">${s.name}</span>
          <div class="row-right">
            <div class="bar-wrap"><div class="bar" style="width:${pct}%;background:${catColor}"></div></div>
            <span class="row-time">${fmtMins(s.minutes)}</span>
            <span class="chevron">▾</span>
          </div>
        </div>
        <ul class="title-list">${titles}${moreTitles}</ul>
      </div>`;
  }).join("");

  const domainRows = topDomains.map(d => `
    <div class="domain-row">
      <span class="domain-name">${d.domain}</span>
      <span class="row-time">${fmtMins(d.minutes)}</span>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>FocusLens — ${category} Breakdown</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh;padding:28px 16px}
    .container{max-width:800px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
    header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
    .breadcrumb{display:flex;align-items:center;gap:8px;font-size:13px;color:#64748b}
    .breadcrumb a{color:#6366f1;text-decoration:none}
    .breadcrumb a:hover{text-decoration:underline}
    .crumb-sep{color:#2d3748}
    .active-crumb{color:#e2e8f0}
    .week-label{font-size:12px;color:#475569}
    .card{background:#1e2330;border-radius:14px;padding:20px 24px}
    .card__title{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:14px}
    .total-row{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
    .total-hrs{font-size:36px;font-weight:800;color:${catColor}}
    .total-label{font-size:13px;color:#64748b}
    .hint{font-size:12px;color:#475569;margin-top:6px}
    .row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:8px;cursor:pointer;gap:10px;transition:background .15s}
    .row:hover,.row--active{background:#252d40}
    .row-label{display:flex;align-items:center;gap:8px;font-size:13px;min-width:140px}
    .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .badge{background:#6366f133;color:#a5b4fc;font-size:10px;padding:2px 8px;border-radius:99px}
    .row-right{display:flex;align-items:center;gap:10px;flex:1;justify-content:flex-end}
    .bar-wrap{width:120px;height:5px;background:#2d3748;border-radius:99px;overflow:hidden}
    .bar{height:100%;border-radius:99px}
    .row-time{font-size:12px;color:#94a3b8;min-width:44px;text-align:right}
    .subtopic-card{border-radius:8px;background:#141820;margin-bottom:6px;cursor:pointer;overflow:hidden}
    .subtopic-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;gap:10px}
    .subtopic-name{font-size:13px;font-weight:500;min-width:120px}
    .chevron{font-size:11px;color:#475569;transition:transform .2s}
    .subtopic-card.open .chevron{transform:rotate(180deg)}
    .title-list{display:none;flex-direction:column;gap:4px;padding:0 14px 10px;border-top:1px solid #1e2330}
    .subtopic-card.open .title-list{display:flex}
    .title-list li{font-size:12px;color:#64748b;padding:3px 0;list-style:none;border-bottom:1px solid #1e2330}
    .title-list li:last-child{border-bottom:none}
    .title-list .more{color:#6366f1;font-style:italic}
    .domain-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1a1f2e;font-size:13px;color:#94a3b8}
    .domain-row:last-child{border-bottom:none}
    .domain-name{color:#cbd5e1}
    .empty{color:#475569;text-align:center;padding:20px;font-size:13px}
  </style>
</head>
<body>
<div class="container">
  <header>
    <div class="breadcrumb">
      <a href="/report">Weekly Report</a>
      <span class="crumb-sep">›</span>
      ${broad
        ? `<a href="/drilldown?category=${encodeURIComponent(category)}&start=${start}&end=${end}">${category}</a>
           <span class="crumb-sep">›</span>
           <span class="active-crumb">${broad}</span>`
        : `<span class="active-crumb">${category}</span>`}
    </div>
    <span class="week-label">${start} → ${end}</span>
  </header>

  <div class="card">
    <div class="total-row">
      <span class="total-hrs">${fmtMins(totalMins)}</span>
      <span class="total-label">total in ${broad || category}</span>
    </div>
    ${!broad ? `<p class="hint">Click a category below to drill in further ↓</p>` : ""}
  </div>

  ${!broad ? `
  <div class="card">
    <p class="card__title">Breakdown by type</p>
    ${broadBreakdown.length === 0
      ? `<p class="empty">No breakdown data available yet.<br>This data appears after Gemini categorises your activity.</p>`
      : broadRows}
  </div>` : ""}

  <div class="card">
    <p class="card__title">
      ${broad ? `Topics within ${broad}` : "All subtopics"} — click to see titles
    </p>
    ${subtopicBreakdown.length === 0
      ? `<p class="empty">No subtopic data yet. Subtopics are generated by Gemini from page titles — make sure your Gemini API key is set in .env</p>`
      : subtopicRows}
  </div>

  ${topDomains.length > 0 ? `
  <div class="card">
    <p class="card__title">Top sites</p>
    ${domainRows}
  </div>` : ""}
</div>
<script>
  function drillBroad(broad) {
    const params = new URLSearchParams(window.location.search);
    params.set("broad", decodeURIComponent(broad));
    window.location.href = "/drilldown?" + params.toString();
  }
</script>
</body>
</html>`;
}

export default router;