import { parseSkinAnalysisText, SKIN_ANALYSIS_PROMPT, splitDataUrl } from "./prompt";
import type { SkinAnalysis } from "./types";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function analyzeSkinWithGemini(
  imageDataUrl: string
): Promise<{ ok: true; analysis: SkinAnalysis } | { ok: false; reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "GEMINI_API_KEY 未設定" };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const { mime, base64 } = splitDataUrl(imageDataUrl);

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
              inline_data: {
                mime_type: mime,
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
    }),
  });

  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    return {
      ok: false,
      reason: data.error?.message ?? `Gemini HTTP ${res.status}`,
    };
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    return { ok: false, reason: "Gemini応答が空" };
  }

  try {
    return { ok: true, analysis: parseSkinAnalysisText(text) };
  } catch {
    return { ok: false, reason: "Gemini応答のJSON解析に失敗" };
  }
}
