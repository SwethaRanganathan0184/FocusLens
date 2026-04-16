import {
  getActivityByDate,
  getActivityByRange,
  getGoals,
} from "../models/db.js";
import { getUserGoal } from "./userGoalStore.js";
import { GOAL_CATEGORY_MAP } from "../../config/goalCategoryMap.js";
import { PRODUCTIVITY_RULES } from "../config/productivityRules.js";

const CATEGORY_WEIGHT = {
  Engineering: 1.0,
  Documentation: 0.9,
  Education: 0.8,
  Finance: 0.5,
  Health: 0.5,
  News: 0.0,
  Shopping: -0.3,
  Social: -0.5,
  Entertainment: -0.3,
  Communication: 0.6,
  Productivity: 0.8,
  Other: 0.1,
};

const DEFAULT_DEEP_WORK_CATEGORIES = new Set([
  "Engineering",
  "Documentation",
  "Education",
  "Productivity",
]);
const DEFAULT_NON_PRODUCTIVE_WEIGHT = -0.5;
const PRODUCTIVITY_WEIGHT = {
  Productive: 1,
  Neutral: 0,
  Distracting: -1,
};

function containsAnyKeyword(haystack, keywords) {
  const text = (haystack || "").toLowerCase();
  if (!text) return false;

  const escapeRegExp = (str) =>
    String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (keywords || []).some((k) => {
    const kw = String(k).toLowerCase().trim();
    if (!kw) return false;

    if (/^[a-z0-9]+$/.test(kw)) {
      const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i");
      return re.test(haystack);
    }

    return text.includes(kw);
  });
}

function determineProductivityLabelAndMatched({ rules, pageTitle }) {
  if (!rules) return { productivityLabel: "Neutral", matched: false };

  const productiveHit = containsAnyKeyword(
    pageTitle,
    rules.productive_keywords || [],
  );
  if (productiveHit) return { productivityLabel: "Productive", matched: true };

  const distractingHit = containsAnyKeyword(
    pageTitle,
    rules.distracting_keywords || [],
  );
  if (distractingHit)
    return { productivityLabel: "Distracting", matched: true };

  return { productivityLabel: "Neutral", matched: false };
}

function normalizeGoalKey(goal, allowedKeys) {
  if (typeof goal !== "string") return null;
  const g = goal.trim();
  if (!g) return null;

  const normalized = g
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  if (Array.isArray(allowedKeys)) {
    return allowedKeys.includes(normalized) ? normalized : null;
  }

  if (allowedKeys && typeof allowedKeys === "object") {
    return Object.prototype.hasOwnProperty.call(allowedKeys, normalized)
      ? normalized
      : null;
  }

  return null;
}

function normalizeGoalKeyForCategory(userGoal) {
  if (typeof userGoal !== "string") return null;
  const g = userGoal.trim();
  if (!g) return null;
  return normalizeGoalKey(g, GOAL_CATEGORY_MAP);
}

function normalizeGoalKeyForProductivity(userGoal) {
  if (typeof userGoal !== "string") return null;
  const g = userGoal.trim();
  if (!g) return null;
  return normalizeGoalKey(g, PRODUCTIVITY_RULES);
}

function getScoringStrategy(userGoal) {
  const goalKey = normalizeGoalKeyForCategory(userGoal);
  if (!goalKey) {
    return {
      productiveCategoriesSet: DEFAULT_DEEP_WORK_CATEGORIES,
      categoryWeightFor: (category) => CATEGORY_WEIGHT[category] ?? 0,
    };
  }

  const productiveCategories = GOAL_CATEGORY_MAP[goalKey] || [];
  const productiveCategoriesSet = new Set(
    productiveCategories.filter((c) =>
      Object.prototype.hasOwnProperty.call(CATEGORY_WEIGHT, c),
    ),
  );

  return {
    productiveCategoriesSet,
    categoryWeightFor: (category) => {
      if (productiveCategoriesSet.has(category)) return 1.0;
      const base = CATEGORY_WEIGHT[category] ?? 0;

      // Most categoriser outputs for "unmatched" content end up as "Other".
      // Treat that as distracting when it's not part of the productive set.
      if (category === "Other") return DEFAULT_NON_PRODUCTIVE_WEIGHT;

      // Preserve the default "negative" categories, otherwise treat as neutral.
      if (base <= 0) return base;
      return 0;
    },
  };
}

function computeFocusScore(sessions, { categoryWeightFor, productivityRules }) {
  if (!sessions.length) return 0;
  let weightedSum = 0;
  let totalSecs = 0;
  for (const s of sessions) {
    let w;
    // Prefer AI-based productivity label if present
    if (
      s.productivity_label === "Productive" ||
      s.productivity_label === "Neutral" ||
      s.productivity_label === "Distracting"
    ) {
      w = PRODUCTIVITY_WEIGHT[s.productivity_label] ?? 0;
    } else if (productivityRules) {
      const { productivityLabel, matched } =
        determineProductivityLabelAndMatched({
          rules: productivityRules,
          pageTitle: s.page_title || "",
        });
      if (matched) {
        w = PRODUCTIVITY_WEIGHT[productivityLabel] ?? 0;
      } else {
        w = categoryWeightFor(s.category) ?? 0;
      }
    } else {
      w = categoryWeightFor(s.category) ?? 0;
    }
    weightedSum += w * s.duration;
    totalSecs += s.duration;
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

function getProductivityBreakdown(sessions, productivityRules) {
  const secsByLabel = { Productive: 0, Neutral: 0, Distracting: 0 };

  for (const s of sessions) {
    let label = "Neutral";
    if (productivityRules) {
      const { productivityLabel } = determineProductivityLabelAndMatched({
        rules: productivityRules,
        pageTitle: s.page_title || "",
      });
      label = productivityLabel;
    }
    secsByLabel[label] = (secsByLabel[label] || 0) + s.duration;
  }

  const productiveMinutes = Math.round(secsByLabel.Productive / 60);
  const neutralMinutes = Math.round(secsByLabel.Neutral / 60);
  const distractingMinutes = Math.round(secsByLabel.Distracting / 60);

  // Dominant label for visual indicator.
  const prod = secsByLabel.Productive;
  const neut = secsByLabel.Neutral;
  const dist = secsByLabel.Distracting;
  let dominantLabel = "Neutral";
  if (prod >= neut && prod >= dist) dominantLabel = "Productive";
  else if (neut >= prod && neut >= dist) dominantLabel = "Neutral";
  else dominantLabel = "Distracting";

  return {
    productiveMinutes,
    neutralMinutes,
    distractingMinutes,
    dominantLabel,
  };
}

function detectDeepWorkBlocks(
  sessions,
  isProductiveSession,
  minBlockMins = 25,
) {
  const blocks = [];
  let blockStart = null;
  let blockSecs = 0;
  for (const s of sessions) {
    if (isProductiveSession(s)) {
      if (!blockStart) blockStart = s.start_time;
      blockSecs += s.duration;
    } else {
      if (blockSecs >= minBlockMins * 60) {
        blocks.push({
          start: blockStart,
          durationMins: Math.round(blockSecs / 60),
        });
      }
      blockStart = null;
      blockSecs = 0;
    }
  }
  if (blockSecs >= minBlockMins * 60 && blockStart) {
    blocks.push({
      start: blockStart,
      durationMins: Math.round(blockSecs / 60),
    });
  }
  return blocks;
}

// ── Day report ────────────────────────────────────────────────
export async function getDayReport(date) {
  const sessions = await getActivityByDate(date);
  const userGoal = await getUserGoal();
  const { categoryWeightFor } = getScoringStrategy(userGoal);

  const productGoalKey = normalizeGoalKeyForProductivity(userGoal);
  const productivityRules = productGoalKey
    ? PRODUCTIVITY_RULES[productGoalKey]
    : null;
  const categories = groupByCategory(sessions);
  const focusScore = computeFocusScore(sessions, {
    categoryWeightFor,
    productivityRules,
  });

  const isProductiveSession = productivityRules
    ? (s) =>
        determineProductivityLabelAndMatched({
          rules: productivityRules,
          pageTitle: s.page_title || "",
        }).productivityLabel === "Productive"
    : (s) => productiveCategoriesSet.has(s.category);

  const deepWork = detectDeepWorkBlocks(sessions, isProductiveSession);
  const productivityBreakdown = getProductivityBreakdown(
    sessions,
    productivityRules,
  );
  const totalMinutes = Math.round(
    sessions.reduce((a, s) => a + s.duration, 0) / 60,
  );

  return {
    date,
    focusScore,
    totalMinutes,
    categories,
    deepWork,
    productivityBreakdown,
  };
}

// ── Week report ───────────────────────────────────────────────
export async function getWeekReport(startDate) {
  const end = new Date().toISOString().split("T")[0];
  const sessions = await getActivityByRange(startDate, end);
  const goals = await getGoals(startDate);
  const userGoal = await getUserGoal();
  const { productiveCategoriesSet, categoryWeightFor } =
    getScoringStrategy(userGoal);

  const productGoalKey = normalizeGoalKeyForProductivity(userGoal);
  const productivityRules = productGoalKey
    ? PRODUCTIVITY_RULES[productGoalKey]
    : null;

  const byDay = {};
  for (const s of sessions) {
    const day =
      typeof s.date === "string"
        ? s.date
        : new Date(s.date).toISOString().split("T")[0];
    (byDay[day] = byDay[day] || []).push(s);
  }

  const days = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySessions]) => ({
      date,
      focusScore: computeFocusScore(daySessions, {
        categoryWeightFor,
        productivityRules,
      }),
      totalMinutes: Math.round(
        daySessions.reduce((a, s) => a + s.duration, 0) / 60,
      ),
      categories: groupByCategory(daySessions),
      productivity: getProductivityBreakdown(daySessions, productivityRules),
    }));

  const weekCategories = groupByCategory(sessions);
  const avgFocusScore = days.length
    ? Math.round(days.reduce((a, d) => a + d.focusScore, 0) / days.length)
    : 0;
  const totalMinutes = Math.round(
    sessions.reduce((a, s) => a + s.duration, 0) / 60,
  );

  const goalProgress = goals.map((g) => {
    const actual = weekCategories.find((c) => c.name === g.category);
    const actualHrs = (actual?.minutes || 0) / 60;
    return {
      category: g.category,
      targetHrs: Number(g.target_hrs),
      actualHrs: Math.round(actualHrs * 10) / 10,
      pct: Math.min(100, Math.round((actualHrs / g.target_hrs) * 100)),
    };
  });

  return {
    weekStart: startDate, // ← fixed: was "start", weekly-report.js needs "weekStart"
    weekEnd: end,
    avgFocusScore,
    totalMinutes,
    activeDays: days.length,
    categories: weekCategories, // ← fixed: was "weekCategories"
    days,
    productivityBreakdown: getProductivityBreakdown(
      sessions,
      productivityRules,
    ),
    goalProgress,
  };
}
