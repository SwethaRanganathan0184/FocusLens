import { Router } from "express";
import { upsertGoal } from "../models/db.js";

const router = Router();

// POST /api/goals/batch — save multiple goals at once
router.post("/batch", async (req, res) => {
  const { goals } = req.body;
  if (!Array.isArray(goals)) return res.status(400).json({ error: "goals array required" });

  try {
    for (const g of goals) {
      await upsertGoal(g.category, g.targetHrs, g.weekStart);
    }
    res.json({ saved: goals.length });
  } catch (err) {
    console.error("[goals/batch]", err);
    res.status(500).json({ error: "Failed to save goals" });
  }
});

router.get("/", async (req, res) => {
  const { weekStart } = req.query;
  if (!weekStart) return res.status(400).json({ error: "weekStart required" });
  try {
    const goals = await getGoals(weekStart);
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

export default router;