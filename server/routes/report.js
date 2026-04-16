import { Router } from "express";
import { getDayReport, getWeekReport } from "../services/reportGenerator.js";

const router = Router();

// GET /api/report/day?date=YYYY-MM-DD   (defaults to today)
router.get("/day", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  try {
    const report = await getDayReport(date);
    res.json(report);
  } catch (err) {
    console.error("[report/day]", err);
    res.status(500).json({ error: "Failed to generate day report" });
  }
});

// GET /api/report/week?start=YYYY-MM-DD  (defaults to this Monday)
router.get("/week", async (req, res) => {
  const start = req.query.start || getMonday();
  try {
    const report = await getWeekReport(start);
    res.json(report);
  } catch (err) {
    console.error("[report/week]", err);
    res.status(500).json({ error: "Failed to generate week report" });
  }
});

function getMonday() {
  const d  = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export default router;