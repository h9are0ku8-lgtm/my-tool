import { parseSkinAnalysisText, SKIN_ANALYSIS_PROMPT, splitDataUrl } from "./prompt";
import type { SkinAnalysis } from "./types";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  error?: {
    message?: string;
  };
};

function extractGeminiText(data: GeminiResponse): string | null {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();
  return text || null;
}

function describeGeminiFailure(data: GeminiResponse, status: number): string {
  if (data.error?.message) return data.error.message;
  if (data.promptFeedback?.blockReason) {
    return `安全フィルタでブロックされました（${data.promptFeedback.blockReason}）。顔全体が写る写真か、別角度で再試行してください。`;
  }
  const finish = data.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    return `Geminiが応答を完了できませんでした（${finish}）。別の肌写真で再試行してください。`;
  }
  if (!data.candidates?.length) {
    return "Gemini応答が空でした。別の写真で再試行してください。";
  }
  return `Gemini HTTP ${status}`;
}

async function callGemini(
  apiKey: string,
  model: string,
  mime: string,
  base64: string
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: SKIN_ANALYSIS_PROMPT },
            {
              // REST JSON uses camelCase
              inlineData: {
                mimeType: mime,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
      // Beauty close-ups can be over-blocked; keep harm filters but loosen for this use case.
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    }),
  });

  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    return { ok: false, reason: describeGeminiFailure(data, res.status) };
  }

  const text = extractGeminiText(data);
  if (!text) {
    return { ok: false, reason: describeGeminiFailure(data, res.status) };
  }
  return { ok: true, text };
}

export async function analyzeSkinWithGemini(
  imageDataUrl: string
): Promise<{ ok: true; analysis: SkinAnalysis } | { ok: false; reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "GEMINI_API_KEY 未設定" };
  }

  const preferred = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  // Try several models because free-tier quotas can differ by model/account.
  const models = Array.from(
    new Set([
      preferred,
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.5-flash",
    ])
  );

  const { mime, base64 } = splitDataUrl(imageDataUrl);
  const errors: string[] = [];

  for (const model of models) {
    try {
      const result = await callGemini(apiKey, model, mime, base64);
      if (!result.ok) {
        errors.push(`${model}: ${result.reason}`);
        continue;
      }
      try {
        return { ok: true, analysis: parseSkinAnalysisText(result.text) };
      } catch {
        errors.push(`${model}: JSON解析に失敗`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      errors.push(`${model}: ${message}`);
    }
  }

  return {
    ok: false,
    reason: errors[0] || "Gemini解析に失敗",
  };
}
