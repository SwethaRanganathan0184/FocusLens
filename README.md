# 🔍 FocusLens

A Chrome extension + local server that silently tracks your browser activity and generates a weekly productivity report with AI-powered categorisation and deep drill-down analytics.

---

## What it does

- Tracks every website you visit and how long you spend on it
- Automatically categorises sites (Engineering, Education, Entertainment, Social, etc.)
- For content-rich sites like YouTube, uses AI to extract **what** you were watching (e.g. "Transformer Neural Networks" → Education → Machine Learning)
- Generates a weekly report with a focus score, time breakdowns, and day-by-day stats
- Lets you drill down from category → broad type → specific subtopic → individual page titles
- Supports weekly goal setting per category
- Supports domain blacklisting (private sites never appear in reports)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | Manifest V3, Vanilla JS |
| Server | Node.js + Express (ESM) |
| Database | PostgreSQL |
| AI Categorisation | Groq API (LLaMA 3.3 70B) |
| Charts | Chart.js |

---

## AI — How it works

FocusLens uses the **Groq API** (free tier) with the `llama-3.3-70b-versatile` model for two things:

### 1. Domain categorisation
When a website isn't in the built-in rule-based lookup table (`shared/categories.js`), the AI classifies it into one of:
`Engineering, Documentation, Communication, Productivity, Social, News, Entertainment, Education, Finance, Shopping, Health, Other`

### 2. Content analysis for rich sites
For sites like YouTube, Twitch, Coursera, Netflix, Reddit, Medium etc., FocusLens sends the **page title** to the AI and gets back:
- A **broad category** (e.g. Education, Sports, Music, Gaming, Technology)
- A **specific subtopic** (e.g. "Machine Learning", "Cricket", "React Development")

This is what powers the drill-down: YouTube → Education → Machine Learning → list of videos watched.

### Rule-based first
Before calling the AI, FocusLens always tries:
1. The built-in domain lookup table (instant, free)
2. Keyword rules on the page title (instant, free)

The AI is only called for unknowns or ambiguous titles, keeping API usage minimal.

### Getting a free Groq API key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up / log in
3. Go to **API Keys** → **Create new key**
4. Copy the key and paste it in your `.env` file (see setup below)

---

## Prerequisites

- **Node.js** v18.17+ or v20+ (v18.16 works but throws npm warnings)
- **PostgreSQL** running locally
- **Google Chrome** browser
- **Groq API key** (free — see above)

---

## Setup Guide

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/FocusLens.git
cd FocusLens
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your PostgreSQL database

```bash
psql postgres -c "CREATE DATABASE focuslens;"
```

### 4. Create your `.env` file

Create a file called `.env` in the root of the project:

```env
DATABASE_URL=postgresql://localhost:5432/focuslens
GROQ_API_KEY=your_groq_key_here
PORT=3000
```

Replace `your_groq_key_here` with your actual Groq API key.

### 5. Initialise the database

```bash
npm run db:init
```

You should see: `[FocusLens] Database ready`

### 6. Start the server

```bash
npm run dev
```

You should see:
[FocusLens] Database ready
[FocusLens] Server at http://localhost:3000

### 7. Load the Chrome extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `FocusLens` root folder (the one containing `manifest.json`)
5. The FocusLens icon should appear in your toolbar

### 8. Verify it's working

- Click the FocusLens extension icon — you should see today's stats
- Browse a few websites
- Wait up to 5 minutes for the first flush (or check server logs for `[FocusLens] Flushed X entries`)
- Open `http://localhost:3000/report` to see your weekly report

---

## Available Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start server with nodemon (auto-restarts on file changes) |
| `npm run db:init` | Create all database tables |

---

## How the focus score is calculated

Each category has a weight between -1.0 and +1.0:

| Category | Weight |
|---|---|
| Engineering | 1.0 |
| Documentation | 0.9 |
| Education | 0.8 |
| Productivity | 0.8 |
| Communication | 0.6 |
| Finance | 0.5 |
| Health | 0.5 |
| News | 0.0 |
| Shopping | -0.3 |
| Entertainment | -0.3 |
| Social | -0.5 |
| Other | 0.1 |

The score is a weighted average of time spent, normalised to 0–100.

- **70+** → Green (high focus)
- **40–69** → Yellow (medium focus)
- **Below 40** → Red (low focus)

---

## How tracking works

1. The background service worker monitors which tab is active
2. When you switch tabs or go idle (3 min threshold), the session ends and duration is accumulated per domain per day
3. Every 5 minutes, accumulated sessions are flushed to the local server
4. The server runs AI categorisation on each entry and stores it in PostgreSQL
5. The weekly report and drill-downs are generated from this data

---

## Privacy

- **Everything runs locally** — your browsing data never leaves your machine
- The only external API call is to Groq, which receives only the **page title** (not the full URL) for content-rich sites like YouTube
- Blacklisted domains are filtered out before the flush and never sent to the server
- No analytics, no telemetry, no third-party tracking of any kind

---

## Known Limitations

- The server must be running locally for tracking to work — if you close the terminal, data is buffered in the extension and flushed when you restart
- Tracked time reflects **time on page**, not video duration — if you switch tabs mid-video, only active time is counted
- Subtopic drill-down requires Groq API key — without it, everything shows as "Uncategorised"Sonnet 4.6
