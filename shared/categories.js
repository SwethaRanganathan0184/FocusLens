export const DOMAIN_CATEGORIES = {
  // Engineering / Dev
  "github.com":          "Engineering",
  "gitlab.com":          "Engineering",
  "stackoverflow.com":   "Engineering",
  "developer.mozilla.org": "Engineering",
  "codepen.io":          "Engineering",
  "replit.com":          "Engineering",
  "codesandbox.io":      "Engineering",
  "vercel.com":          "Engineering",
  "netlify.com":         "Engineering",
  "heroku.com":          "Engineering",
  "npmjs.com":           "Engineering",
  "pypi.org":            "Engineering",
  "leetcode.com":        "Engineering",
  "hackerrank.com":      "Engineering",

  // Docs / Reference
  "docs.google.com":     "Documentation",
  "notion.so":           "Documentation",
  "confluence.atlassian.com": "Documentation",
  "readthedocs.io":      "Documentation",
  "devdocs.io":          "Documentation",
  "docs.github.com":     "Documentation",
  "wikipedia.org":       "Documentation",

  // Communication
  "mail.google.com":     "Communication",
  "outlook.live.com":    "Communication",
  "slack.com":           "Communication",
  "discord.com":         "Communication",

  // Social
  "twitter.com":         "Social",
  "x.com":               "Social",
  "instagram.com":       "Social",
  "facebook.com":        "Social",
  "linkedin.com":        "Social",
  "reddit.com":          "Social",
  "tiktok.com":          "Social",
  "threads.net":         "Social",

  // Entertainment
  "youtube.com":         "Entertainment",
  "twitch.tv":           "Entertainment",
  "netflix.com":         "Entertainment",
  "primevideo.com":      "Entertainment",
  "disneyplus.com":      "Entertainment",
  "vimeo.com":           "Entertainment",

  // News
  "news.ycombinator.com": "News",
  "hn.algolia.com":      "News",
  "techcrunch.com":      "News",
  "theverge.com":        "News",
  "bbc.com":             "News",
  "cnn.com":             "News",
  "nytimes.com":         "News",
  "medium.com":          "News",
  "dev.to":              "News",

  // Shopping
  "amazon.com":          "Shopping",
  "flipkart.com":        "Shopping",
  "ebay.com":            "Shopping",
  "myntra.com":          "Shopping",

  // Finance
  "zerodha.com":         "Finance",
  "groww.in":            "Finance",
  "moneycontrol.com":    "Finance",
  "banking.com":         "Finance",

  // Education
  "coursera.org":        "Education",
  "udemy.com":           "Education",
  "edx.org":             "Education",
  "khanacademy.org":     "Education",
  "brilliant.org":       "Education",
};

// Named function that categoriser.js imports
export function getCategoryForDomain(domain) {
  if (!domain) return null;
  const clean = domain.replace(/^www\./, "").toLowerCase();
  return DOMAIN_CATEGORIES[clean] || null;
}