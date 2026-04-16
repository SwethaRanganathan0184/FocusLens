import { Router } from "express";
import { getUserGoal, setUserGoal } from "../services/userGoalStore.js";

const router = Router();

router.get("/", async (_req, res) => {
  const goal = await getUserGoal();
  res.json({ goal });
});

router.post("/", async (req, res) => {
  try {
    const { goal } = req.body || {};
    if (typeof goal !== "string") {
      return res.status(400).json({ error: "goal must be a string" });
    }

    await setUserGoal(goal.trim());
    return res.json({ ok: true, goal });
  } catch (err) {
    console.error("[user-goal] save failed:", err);
    return res.status(500).json({ error: "Failed to save goal" });
  }
});

export default router;

