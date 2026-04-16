import { groqClient } from "../utils/groqClient.js";
import { getUserGoal } from "./userGoalStore.js";

// Simple in-memory cache
const productivityCache = new Map();

function getCacheKey(goal, subtopic, title) {
  return `${goal}::${subtopic}::${title}`;
}

/**
 * Classifies session as Productive, Neutral, or Distracting based on user goal and session context.
 * Caches results to minimize Groq API calls.
 * Falls back to category weights if Groq or goal is unavailable.
 */
export async function determineProductivity(session) {
  let goal;
  try {
    goal = await getUserGoal();
  } catch (e) {
    goal = null;
  }

  // Fallback if goal is missing
  if (!goal) return null;

  const cacheKey = getCacheKey(goal, session.subtopic, session.page_title);
  if (productivityCache.has(cacheKey)) {
    return productivityCache.get(cacheKey);
  }

  const prompt = `
You are a productivity assistant.

Determine whether the following browsing activity is productive for the user.

User goal:
${goal}

Activity:
Category: ${session.category}
Subtopic: ${session.subtopic}
Title: ${session.page_title}

Respond with ONLY one word:

Productive
Neutral
Distracting
`;

  try {
    const response = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
    });
    const label = response.choices[0].message.content.trim();
    productivityCache.set(cacheKey, label);
    return label;
  } catch (e) {
    // Fallback: let caller handle fallback logic
    return null;
  }
}
