import { getCategoryForDomain } from "../../shared/categories.js";
import { updateCategory } from "../models/db.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

const CONTENT_RICH_DOMAINS = [
  "youtube.com", "youtu.be", "twitch.tv",
  "coursera.org", "udemy.com", "edx.org", "khanacademy.org",
  "medium.com", "dev.to", "substack.com",
  "netflix.com", "primevideo.com", "hotstar.com",
  "spotify.com", "reddit.com",
];

const VALID_CATEGORIES = [
  "Engineering", "Documentation", "Communication",
  "Productivity", "Social", "News", "Entertainment",
  "Education", "Finance", "Shopping", "Health", "Other",
];

const VALID_BROAD = [
  "Education", "Entertainment", "Sports", "Music",
  "News & Politics", "Gaming", "Finance", "Health & Fitness",
  "Technology", "Comedy", "Travel", "Food", "Science", "Other",
];

const TITLE_RULES = [
  { keywords: ["tutorial", "explained", "how to", "course", "lecture", "lesson",
               "learn ", "learning", "guide", "introduction to", "mit ", "stanford",
               "neural network", "machine learning", "deep learning", "algorithm",
               "transformer", "paper explained", "research", "study", "education"],
    category: "Education" },
  { keywords: ["highlights", "goals", "match", "trailer", "movie", "episode",
               "season ", "music video", "official video", "lyrics", "vlog", "funny",
               "compilation", "reaction", "podcast"],
    category: "Entertainment" },
  { keywords: ["coding", "programming", "react", "python", "javascript", "typescript",
               "github", "api ", "backend", "frontend", "debug", "deploy", "devops",
               "docker", "kubernetes", "sql", "database"],
    category: "Engineering" },
  { keywords: ["news", "breaking", "update", "analysis", "politics", "election"],
    category: "News" },
];

function classifyByTitle(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const rule of TITLE_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return rule.category;
    }
  }
  return null;
}

const categoryCache = new Map();
const contentCache  = new Map();

function isContentRich(domain) {
  const clean = (domain || "").replace(/^www\./, "");
  return CONTENT_RICH_DOMAINS.some(d => clean === d || clean.endsWith("." + d));
}

export async function categoriseBatch(entries) {
  if (!GROQ_API_KEY) {
    console.warn("[categoriser] GROQ_API_KEY is not set — falling back to rule-based only");
  }

  const results = [];

  for (const entry of entries) {
    const contentRich = isContentRich(entry.domain);
    const hasTitle    = entry.pageTitle && entry.pageTitle.trim().length > 3;

    console.log(`[categoriser] Processing: ${entry.domain} | title: "${entry.pageTitle || "(none)"}" | contentRich: ${contentRich}`);

    let category;

    if (contentRich && hasTitle) {
      const cacheKey = entry.pageTitle.toLowerCase().trim();

      if (categoryCache.has(cacheKey)) {
        category = categoryCache.get(cacheKey);
        console.log(`[categoriser] Cache hit → ${category}`);
      } else {
        // 1. Try keyword rules first (free, instant, no API)
        const ruleResult = classifyByTitle(entry.pageTitle);
        if (ruleResult) {
          category = ruleResult;
          categoryCache.set(cacheKey, category);
          console.log(`[categoriser] Rule-based title match → ${category}`);
        } else {
          // 2. Fall back to Groq for ambiguous titles
          const result = await askGroqCategoryFromTitle(entry.domain, entry.pageTitle);
          if (result.success) {
            category = result.value;
            categoryCache.set(cacheKey, category);
            console.log(`[categoriser] Groq title category → ${category}`);
          } else {
            category = getCategoryForDomain(entry.domain) || "Entertainment";
            console.warn(`[categoriser] Groq failed, temporary fallback → ${category} (will retry)`);
          }
        }
      }
    } else {
      category = getCategoryForDomain(entry.domain);
      if (!category) {
        if (categoryCache.has(entry.domain)) {
          category = categoryCache.get(entry.domain);
        } else {
          const result = await askGroqCategory(entry.domain, entry.pageTitle);
          if (result.success) {
            category = result.value;
            categoryCache.set(entry.domain, category);
            try { await updateCategory(entry.domain, category); } catch {}
          } else {
            category = "Other";
          }
        }
      }
      console.log(`[categoriser] Rule/domain category → ${category}`);
    }

    let broadCategory = null;
    let subtopic      = null;

    if (contentRich && hasTitle) {
      const cacheKey = entry.pageTitle.toLowerCase().trim();
      if (contentCache.has(cacheKey)) {
        ({ broadCategory, subtopic } = contentCache.get(cacheKey));
      } else {
        const result = await askGroqContent(entry.pageTitle, entry.domain);
        if (result.success) {
          broadCategory = result.value.broadCategory;
          subtopic      = result.value.subtopic;
          contentCache.set(cacheKey, { broadCategory, subtopic });
          console.log(`[categoriser] Groq broad/subtopic → ${broadCategory} / ${subtopic}`);
        } else {
          console.warn(`[categoriser] Groq broad/subtopic failed — will retry next flush`);
        }
      }
    }

    results.push({ ...entry, category, broadCategory, subtopic });
  }

  return results;
}

// ── Groq: classify content-rich page by title ─────────────────────────────────

async function askGroqCategoryFromTitle(domain, pageTitle) {
  if (!GROQ_API_KEY) return { success: false };

  const prompt = `You are classifying browser activity for a productivity tracker.
Domain: ${domain}
Page title: "${pageTitle}"

Based on the PAGE TITLE (not just the domain), classify into ONE category:
${VALID_CATEGORIES.join(", ")}

Examples:
- "Attention Is All You Need - Paper Explained" → Education
- "Transformer Neural Networks, ChatGPT's foundation, Clearly Explained!!!" → Education
- "How Diffusion Models Work" → Education
- "MIT 6.006 Introduction to Algorithms" → Education
- "React Hooks Tutorial" → Engineering
- "Premier League Highlights" → Entertainment
- "Drake - God's Plan" → Entertainment

Reply with ONLY the category name. Nothing else.`;

  try {
    const text  = await callGroq(prompt);
    const clean = text.trim();
    const value = VALID_CATEGORIES.includes(clean) ? clean : "Entertainment";
    return { success: true, value };
  } catch (err) {
    console.error("[categoriser] askGroqCategoryFromTitle failed:", err.message);
    return { success: false };
  }
}

// ── Groq: classify unknown domain ────────────────────────────────────────────

async function askGroqCategory(domain, pageTitle) {
  if (!GROQ_API_KEY) return { success: false };

  const prompt = `Classify this website into exactly ONE category.
Domain: ${domain}
${pageTitle ? `Page title: ${pageTitle}` : ""}
Categories: ${VALID_CATEGORIES.join(", ")}
Reply with ONLY the category name. Nothing else.`;

  try {
    const text  = await callGroq(prompt);
    const clean = text.trim();
    const value = VALID_CATEGORIES.includes(clean) ? clean : "Other";
    return { success: true, value };
  } catch (err) {
    console.error("[categoriser] askGroqCategory failed:", err.message);
    return { success: false };
  }
}

// ── Groq: broad category + subtopic from page title ───────────────────────────

async function askGroqContent(pageTitle, domain) {
  if (!GROQ_API_KEY) return { success: false };

  const prompt = `You are a content classifier for a productivity tracker.
Given a page title from ${domain}, classify it into:
1. A broad category (pick ONE): ${VALID_BROAD.join(", ")}
2. A specific subtopic (2-4 words, be specific e.g. "Machine Learning", "Cricket", "React Development", "Cooking Recipes")

Page title: "${pageTitle}"

Respond ONLY with valid JSON, no markdown:
{"broadCategory": "...", "subtopic": "..."}`;

  try {
    const text   = await callGroq(prompt);
    const clean  = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const broadCategory = VALID_BROAD.includes(parsed.broadCategory) ? parsed.broadCategory : "Other";
    const subtopic = typeof parsed.subtopic === "string" && parsed.subtopic.length > 0
      ? parsed.subtopic.slice(0, 60) : null;
    return { success: true, value: { broadCategory, subtopic } };
  } catch (err) {
    console.error("[categoriser] askGroqContent failed:", err.message);
    return { success: false };
  }
}

// ── Groq HTTP helper ──────────────────────────────────────────────────────────

async function callGroq(prompt) {
  if (!GROQ_API_KEY) throw new Error("No GROQ_API_KEY");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens:  100,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty Groq response: ${JSON.stringify(data).slice(0, 200)}`);
  return text;
}