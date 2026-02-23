import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SentimentResult {
  grade: string; // A-F
  justification: string;
}

export async function analyzeSentiment(
  text: string,
  context?: string
): Promise<SentimentResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Analyze the sentiment and quality of this beta tester's free-text response. Rate it with a letter grade (A, B, C, D, or F) and provide a brief 1-sentence justification.

${context ? `Context: This is a response to "${context}"\n` : ""}
Response to analyze:
"${text}"

Reply in this exact JSON format:
{"grade": "B", "justification": "Brief explanation here"}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  try {
    const parsed = JSON.parse(content.text);
    return {
      grade: parsed.grade || "C",
      justification: parsed.justification || "No justification provided",
    };
  } catch {
    // Try to extract grade from text
    const gradeMatch = content.text.match(/[ABCDF]/);
    return {
      grade: gradeMatch ? gradeMatch[0] : "C",
      justification: content.text.slice(0, 200),
    };
  }
}

/**
 * Batch analyze with concurrency limiting (5 concurrent requests).
 */
export async function batchAnalyzeSentiment(
  items: { id: string; text: string; context?: string }[]
): Promise<Map<string, SentimentResult>> {
  const results = new Map<string, SentimentResult>();
  const concurrencyLimit = 5;

  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const result = await analyzeSentiment(item.text, item.context);
        return { id: item.id, result };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.set(r.value.id, r.value.result);
      }
    }
  }

  return results;
}
