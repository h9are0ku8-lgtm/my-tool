import { fallbackAnalysis } from "./analysis";
import { analyzeSkinWithGemini } from "./gemini";
import { parseSkinAnalysisText, SKIN_ANALYSIS_PROMPT } from "./prompt";
import type { SkinAnalysis } from "./types";

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

async function analyzeSkinWithOpenAI(
  imageDataUrl: string
): Promise<{ ok: true; analysis: SkinAnalysis } | { ok: false; reason: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "OPENAI_API_KEY 未設定" };
  }

  const content: OpenAIContentPart[] = [
    { type: "text", text: SKIN_ANALYSIS_PROMPT },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      store: false,
      messages: [
        {
          role: "system",
          content:
            "You are a Japanese beauty concierge. Never claim medical diagnosis. Never output personal identifiers. Reply with JSON only.",
        },
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  const data = (await res.json()) as OpenAIResponse;
  if (!res.ok) {
    return { ok: false, reason: data.error?.message ?? `OpenAI HTTP ${res.status}` };
  }

  const contentText = data.choices?.[0]?.message?.content;
  if (!contentText) {
    return { ok: false, reason: "OpenAI応答が空" };
  }

  try {
    return { ok: true, analysis: parseSkinAnalysisText(contentText) };
  } catch {
    return { ok: false, reason: "OpenAI応答のJSON解析に失敗" };
  }
}

export async function analyzeSkin(imageDataUrl: string): Promise<SkinAnalysis> {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  const tryGeminiFirst = provider !== "openai";

  if (tryGeminiFirst) {
    const gemini = await analyzeSkinWithGemini(imageDataUrl);
    if (gemini.ok) return gemini.analysis;

    const openai = await analyzeSkinWithOpenAI(imageDataUrl);
    if (openai.ok) return openai.analysis;

    return fallbackAnalysis(
      `AI解析に失敗したためデモ結果を表示しています（Gemini: ${gemini.reason} / OpenAI: ${openai.reason}）。`
    );
  }

  const openai = await analyzeSkinWithOpenAI(imageDataUrl);
  if (openai.ok) return openai.analysis;

  const gemini = await analyzeSkinWithGemini(imageDataUrl);
  if (gemini.ok) return gemini.analysis;

  return fallbackAnalysis(
    `AI解析に失敗したためデモ結果を表示しています（OpenAI: ${openai.reason} / Gemini: ${gemini.reason}）。`
  );
}
