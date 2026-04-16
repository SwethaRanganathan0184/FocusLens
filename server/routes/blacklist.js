import { Router } from "express";
import { pool } from "../models/db.js";

const router = Router();

router.post("/", async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: "domain required" });
  try {
    await pool.query(
      `INSERT INTO blacklist (domain) VALUES ($1) ON CONFLICT DO NOTHING`, [domain]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[blacklist/post]", err);
    res.status(500).json({ error: "Failed to add to blacklist" });
  }
});

router.delete("/:domain", async (req, res) => {
  try {
    await pool.query(`DELETE FROM blacklist WHERE domain = $1`, [req.params.domain]);
    res.json({ ok: true });
  } catch (err) {
    console.error("[blacklist/delete]", err);
    res.status(500).json({ error: "Failed to remove from blacklist" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT domain FROM blacklist ORDER BY domain`);
    res.json(rows);
  } catch (err) {
    console.error("[blacklist/get]", err);
    res.status(500).json({ error: "Failed to get blacklist" });
  }
});

export default router;