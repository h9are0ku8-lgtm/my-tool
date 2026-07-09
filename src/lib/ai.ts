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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "OPENAI_API_KEY 未設定" };
  }

  // Guard against accidentally pasting a Gemini/Google key into OPENAI_API_KEY.
  if (!apiKey.startsWith("sk-")) {
    return {
      ok: false,
      reason:
        "OPENAI_API_KEY の形式が不正です（sk- で始まる OpenAI キーを設定してください。Geminiキーは GEMINI_API_KEY へ）。",
    };
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

function friendlyFailureMessage(geminiReason: string, openaiReason: string): string {
  const geminiQuota =
    /quota|rate.?limit|exceeded/i.test(geminiReason) ||
    geminiReason.includes("limit: 0");
  const openaiBadKey =
    /Incorrect API key|形式が不正|sk-/i.test(openaiReason) ||
    openaiReason.includes("OPENAI_API_KEY");

  if (geminiQuota && openaiBadKey) {
    return [
      "AI解析に失敗したためデモ結果を表示しています。",
      "原因: Geminiの無料枠が上限です。加えて OpenAI キーが不正（Geminiキーが混入している可能性）です。",
      "対処: Google AI Studio で課金/枠を確認するか、別の Gemini キーを使う。OpenAI を使うなら sk- で始まるキーを OPENAI_API_KEY に設定してください。",
    ].join(" ");
  }

  if (geminiQuota) {
    return `AI解析に失敗したためデモ結果を表示しています。Geminiの利用枠が上限です（約1分後に再試行、または課金設定を確認）。詳細: ${geminiReason}`;
  }

  return `AI解析に失敗したためデモ結果を表示しています（Gemini: ${geminiReason} / OpenAI: ${openaiReason}）。`;
}

export async function analyzeSkin(imageDataUrl: string): Promise<SkinAnalysis> {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  const tryGeminiFirst = provider !== "openai";

  if (tryGeminiFirst) {
    const gemini = await analyzeSkinWithGemini(imageDataUrl);
    if (gemini.ok) return gemini.analysis;

    const openai = await analyzeSkinWithOpenAI(imageDataUrl);
    if (openai.ok) return openai.analysis;

    return fallbackAnalysis(friendlyFailureMessage(gemini.reason, openai.reason));
  }

  const openai = await analyzeSkinWithOpenAI(imageDataUrl);
  if (openai.ok) return openai.analysis;

  const gemini = await analyzeSkinWithGemini(imageDataUrl);
  if (gemini.ok) return gemini.analysis;

  return fallbackAnalysis(friendlyFailureMessage(gemini.reason, openai.reason));
}
