import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/focuslens",
});

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS activity (
    id             SERIAL PRIMARY KEY,
    domain         TEXT NOT NULL,
    url            TEXT,
    page_title     TEXT,
    category       TEXT DEFAULT 'Other',
    broad_category TEXT DEFAULT NULL,
    subtopic       TEXT DEFAULT NULL,
    duration       INTEGER NOT NULL,
    date           DATE NOT NULL,
    start_time     BIGINT NOT NULL,
    created_at     TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_activity_date     ON activity(date);
  CREATE INDEX IF NOT EXISTS idx_activity_domain   ON activity(domain);
  CREATE INDEX IF NOT EXISTS idx_activity_category ON activity(category);

  CREATE TABLE IF NOT EXISTS goals (
    id          SERIAL PRIMARY KEY,
    category    TEXT NOT NULL,
    target_hrs  NUMERIC(5,2) NOT NULL,
    week_start  DATE NOT NULL,
    UNIQUE(category, week_start)
  );

  CREATE TABLE IF NOT EXISTS blacklist (
    domain TEXT PRIMARY KEY
  );

  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity' AND column_name='page_title')
    THEN ALTER TABLE activity ADD COLUMN page_title TEXT; END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity' AND column_name='broad_category')
    THEN ALTER TABLE activity ADD COLUMN broad_category TEXT; END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity' AND column_name='subtopic')
    THEN ALTER TABLE activity ADD COLUMN subtopic TEXT; END IF;
  END $$;
`;

export async function initDb() {
  await pool.query(CREATE_TABLES);
  console.log("[FocusLens] Database ready");
}

export async function insertBatch(entries) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const e of entries) {
      await client.query(
        `INSERT INTO activity (domain, url, page_title, category, broad_category, subtopic, duration, date, start_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [e.domain, e.url||null, e.pageTitle||null, e.category||"Other", e.broadCategory||null, e.subtopic||null, e.duration, e.date, e.startTime]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getActivityByDate(date) {
  const res = await pool.query(
    `SELECT domain, url, page_title, category, broad_category, subtopic, duration, start_time FROM activity WHERE date = $1 ORDER BY start_time ASC`,
    [date]
  );
  return res.rows;
}

export async function getActivityByRange(startDate, endDate) {
  const res = await pool.query(
    `SELECT domain, url, page_title, category, broad_category, subtopic, duration, date, start_time FROM activity WHERE date BETWEEN $1 AND $2 ORDER BY date ASC, start_time ASC`,
    [startDate, endDate]
  );
  return res.rows;
}

export async function getActivityByCategory(category, startDate, endDate) {
  const res = await pool.query(
    `SELECT domain, url, page_title, category, broad_category, subtopic, duration, date FROM activity WHERE category = $1 AND date BETWEEN $2 AND $3 ORDER BY date ASC`,
    [category, startDate, endDate]
  );
  return res.rows;
}

export async function updateCategory(domain, category) {
  await pool.query(`UPDATE activity SET category = $1 WHERE domain = $2`, [category, domain]);
}

export async function getGoals(weekStart) {
  const res = await pool.query(`SELECT * FROM goals WHERE week_start = $1`, [weekStart]);
  return res.rows;
}

export async function upsertGoal(category, targetHrs, weekStart) {
  await pool.query(
    `INSERT INTO goals (category, target_hrs, week_start) VALUES ($1,$2,$3) ON CONFLICT (category, week_start) DO UPDATE SET target_hrs = EXCLUDED.target_hrs`,
    [category, targetHrs, weekStart]
  );
}

export async function getBlacklist() {
  const res = await pool.query(`SELECT domain FROM blacklist ORDER BY domain`);
  return res.rows.map(r => r.domain);
}

export async function addToBlacklist(domain) {
  await pool.query(`INSERT INTO blacklist (domain) VALUES ($1) ON CONFLICT DO NOTHING`, [domain]);
}

export async function removeFromBlacklist(domain) {
  await pool.query(`DELETE FROM blacklist WHERE domain = $1`, [domain]);
}

export { pool };