import { getActivityByDate, getActivityByRange, getGoals } from "../models/db.js";

const CATEGORY_WEIGHT = {
  Engineering:     1.0,
  Documentation:   0.9,
  Education:       0.8,
  Finance:         0.5,
  Health:          0.5,
  News:            0.0,
  Shopping:       -0.3,
  Social:         -0.5,
  Entertainment:  -0.3,
  Communication:   0.6,
  Productivity:    0.8,
  Other:           0.1,
};

function computeFocusScore(sessions) {
  if (!sessions.length) return 0;
  let weightedSum = 0;
  let totalSecs   = 0;
  for (const s of sessions) {
    const w = CATEGORY_WEIGHT[s.category] ?? 0;
    weightedSum += w * s.duration;
    totalSecs   += s.duration;
  }
  if (totalSecs === 0) return 0;
  const raw = (weightedSum / totalSecs + 1) / 2;
  return Math.round(raw * 100);
}

function groupByCategory(sessions) {
  const map = {};
  for (const s of sessions) {
    map[s.category] = (map[s.category] || 0) + s.duration;
  }
  return Object.entries(map)
    .map(([name, secs]) => ({ name, minutes: Math.round(secs / 60) }))
    .sort((a, b) => b.minutes - a.minutes);
}

function detectDeepWorkBlocks(sessions, minBlockMins = 25) {
  const PRODUCTIVE = new Set(["Engineering", "Documentation", "Education", "Productivity"]);
  const blocks = [];
  let blockStart = null;
  let blockSecs  = 0;
  for (const s of sessions) {
    if (PRODUCTIVE.has(s.category)) {
      if (!blockStart) blockStart = s.start_time;
      blockSecs += s.duration;
    } else {
      if (blockSecs >= minBlockMins * 60) {
        blocks.push({ start: blockStart, durationMins: Math.round(blockSecs / 60) });
      }
      blockStart = null;
      blockSecs  = 0;
    }
  }
  if (blockSecs >= minBlockMins * 60 && blockStart) {
    blocks.push({ start: blockStart, durationMins: Math.round(blockSecs / 60) });
  }
  return blocks;
}

// ── Day report ────────────────────────────────────────────────
export async function getDayReport(date) {
  const sessions     = await getActivityByDate(date);
  const categories   = groupByCategory(sessions);
  const focusScore   = computeFocusScore(sessions);
  const deepWork     = detectDeepWorkBlocks(sessions);
  const totalMinutes = Math.round(sessions.reduce((a, s) => a + s.duration, 0) / 60);

  return { date, focusScore, totalMinutes, categories, deepWork };
}

// ── Week report ───────────────────────────────────────────────
export async function getWeekReport(startDate) {
  const end      = new Date().toISOString().split("T")[0];
  const sessions = await getActivityByRange(startDate, end);
  const goals    = await getGoals(startDate);

  const byDay = {};
  for (const s of sessions) {
    const day = typeof s.date === "string"
      ? s.date
      : new Date(s.date).toISOString().split("T")[0];
    (byDay[day] = byDay[day] || []).push(s);
  }

  const days = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySessions]) => ({
      date,
      focusScore:   computeFocusScore(daySessions),
      totalMinutes: Math.round(daySessions.reduce((a, s) => a + s.duration, 0) / 60),
      categories:   groupByCategory(daySessions),
    }));

  const weekCategories = groupByCategory(sessions);
  const avgFocusScore  = days.length
    ? Math.round(days.reduce((a, d) => a + d.focusScore, 0) / days.length)
    : 0;
  const totalMinutes   = Math.round(sessions.reduce((a, s) => a + s.duration, 0) / 60);

  const goalProgress = goals.map(g => {
    const actual    = weekCategories.find(c => c.name === g.category);
    const actualHrs = (actual?.minutes || 0) / 60;
    return {
      category:  g.category,
      targetHrs: Number(g.target_hrs),
      actualHrs: Math.round(actualHrs * 10) / 10,
      pct:       Math.min(100, Math.round((actualHrs / g.target_hrs) * 100)),
    };
  });

  return {
    weekStart:    startDate,   // ← fixed: was "start", weekly-report.js needs "weekStart"
    weekEnd:      end,
    avgFocusScore,
    totalMinutes,
    activeDays:   days.length,
    categories:   weekCategories,  // ← fixed: was "weekCategories"
    days,
    goalProgress,
  };
}