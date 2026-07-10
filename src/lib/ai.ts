import { analyzeSkinWithGemini } from "./gemini";
import { parseSkinAnalysisText, SKIN_ANALYSIS_PROMPT } from "./prompt";
import { analyzeSkinWithRules } from "./rules";
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

export type AnalyzeSkinResult = {
  analysis: SkinAnalysis;
  mode: "ai" | "rules";
  modeLabel: string;
};

async function analyzeSkinWithOpenAI(
  imageDataUrl: string
): Promise<{ ok: true; analysis: SkinAnalysis } | { ok: false; reason: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "OPENAI_API_KEY 未設定" };
  }

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

function withRulesNote(analysis: SkinAnalysis, reason: string): SkinAnalysis {
  return {
    ...analysis,
    summary: `${analysis.summary}（無料ルールモード: AI枠が使えないため切替。${reason}）`,
  };
}

/**
 * Prefer AI when available. If quota/keys fail, fall back to free rule-based analysis
 * so the product keeps working without paid usage.
 */
export async function analyzeSkin(imageDataUrl: string): Promise<AnalyzeSkinResult> {
  const forceRules = (process.env.AI_PROVIDER || "").toLowerCase() === "rules";
  if (forceRules) {
    return {
      analysis: analyzeSkinWithRules(imageDataUrl),
      mode: "rules",
      modeLabel: "無料ルールモード",
    };
  }

  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const tryGeminiFirst = provider !== "openai";

  if (tryGeminiFirst) {
    const gemini = await analyzeSkinWithGemini(imageDataUrl);
    if (gemini.ok) {
      return {
        analysis: gemini.analysis,
        mode: "ai",
        modeLabel: "Gemini AI",
      };
    }

    const openai = await analyzeSkinWithOpenAI(imageDataUrl);
    if (openai.ok) {
      return {
        analysis: openai.analysis,
        mode: "ai",
        modeLabel: "OpenAI",
      };
    }

    return {
      analysis: withRulesNote(
        analyzeSkinWithRules(imageDataUrl),
        "Gemini/OpenAI利用不可"
      ),
      mode: "rules",
      modeLabel: "無料ルールモード",
    };
  }

  const openai = await analyzeSkinWithOpenAI(imageDataUrl);
  if (openai.ok) {
    return {
      analysis: openai.analysis,
      mode: "ai",
      modeLabel: "OpenAI",
    };
  }

  const gemini = await analyzeSkinWithGemini(imageDataUrl);
  if (gemini.ok) {
    return {
      analysis: gemini.analysis,
      mode: "ai",
      modeLabel: "Gemini AI",
    };
  }

  return {
    analysis: withRulesNote(
      analyzeSkinWithRules(imageDataUrl),
      "OpenAI/Gemini利用不可"
    ),
    mode: "rules",
    modeLabel: "無料ルールモード",
  };
}
