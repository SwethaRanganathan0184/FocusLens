import { readFile, writeFile, mkdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.resolve(__dirname, "../../config");
const USER_GOAL_PATH = path.join(CONFIG_DIR, "userGoal.json");

let cache = {
  goal: "",
  mtimeMs: 0,
};

async function ensureFile() {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
  } catch {}

  try {
    const s = await stat(USER_GOAL_PATH);
    return s.mtimeMs;
  } catch {
    // Create a default file if missing.
    const initial = { goal: "" };
    await writeFile(USER_GOAL_PATH, JSON.stringify(initial, null, 2), "utf8");
    const s = await stat(USER_GOAL_PATH);
    return s.mtimeMs;
  }
}

export async function getUserGoal() {
  const mtimeMs = await ensureFile();
  if (cache.mtimeMs === mtimeMs) return cache.goal || "";

  const raw = await readFile(USER_GOAL_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { goal: "" };
  }

  const goal = typeof parsed?.goal === "string" ? parsed.goal : "";
  cache = { goal, mtimeMs };
  return goal;
}

export async function setUserGoal(goal) {
  const nextGoal = typeof goal === "string" ? goal : "";
  const mtimeMs = await ensureFile();

  cache.goal = nextGoal;
  cache.mtimeMs = mtimeMs; // refreshed below once write completes

  await writeFile(USER_GOAL_PATH, JSON.stringify({ goal: nextGoal }, null, 2), "utf8");
  const s = await stat(USER_GOAL_PATH);
  cache.mtimeMs = s.mtimeMs;

  return nextGoal;
}

