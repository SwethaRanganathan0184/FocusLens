import { Router } from "express";
import { insertBatch, getBlacklist } from "../models/db.js";
import { categoriseBatch } from "../services/categoriser.js";

const router = Router();

router.post("/batch", async (req, res) => {
  // Accept EITHER "entries" (new SW) or "sessions" (old SW) — handle both
  const payload = req.body.entries ?? req.body.sessions;

  if (!Array.isArray(payload) || payload.length === 0) {
    console.warn("[activity/batch] Empty or missing payload. Body keys:", Object.keys(req.body));
    return res.status(400).json({ error: "entries array required" });
  }

  try {
    const blacklist = await getBlacklist();
    const filtered  = payload.filter(s => s.domain && s.duration > 0 && !blacklist.includes(s.domain));

    if (filtered.length === 0) return res.json({ inserted: 0 });

    console.log(`[activity/batch] Received ${filtered.length} entries, first domain: ${filtered[0].domain}, title: ${filtered[0].pageTitle || "(no title)"}`);

    const categorised = await categoriseBatch(filtered);
    await insertBatch(categorised);

    console.log(`[activity/batch] Saved ${categorised.length} entries`);
    res.json({ inserted: categorised.length });
  } catch (err) {
    console.error("[activity/batch] Error:", err.message);
    res.status(500).json({ error: "Failed to store sessions" });
  }
});

export default router;