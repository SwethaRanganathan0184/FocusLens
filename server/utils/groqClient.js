// server/utils/groqClient.js
// Simple Groq API client for llama-3.3-70b-versatile

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
  console.warn("[groqClient] GROQ_API_KEY is not set. AI features will not work.");
}

export const groqClient = {
  chat: {
    completions: {
      async create({ model, messages, temperature = 0, max_tokens = 100 }) {
        if (!GROQ_API_KEY) throw new Error("No GROQ_API_KEY");
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }
        const data = await res.json();
        return data;
      },
    },
  },
};
