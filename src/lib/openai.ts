import {
  fallbackAnalysis,
  normalizeCareLevel,
  withCareLevelMeta,
} from "./analysis";
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

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  return JSON.parse(raw);
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return items.length > 0 ? items : fallback;
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function analyzeSkinWithOpenAI(
  imageDataUrl: string
): Promise<SkinAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackAnalysis(
      "OPENAI_API_KEY が未設定のため、デモ用の肌アドバイスを表示しています。"
    );
  }

  const prompt = `
あなたは美容アドバイザーです。医療診断・病名断定・処方は行わず、一般的なスキンケア助言のみを返してください。
個人を特定できる情報（名前、住所、連絡先など）は出力しないでください。
入力画像（顔または肌）を見て、次の JSON だけを返してください。説明文やコードフェンスは不要です。

{
  "summary": "全体の一言まとめ",
  "skinCondition": "今の肌状態の短い説明",
  "concerns": ["気になる点1", "気になる点2"],
  "acnePrediction": "今後数日のニキビ傾向の予測（断定しない）",
  "careLevel": "mild | moderate | attention",
  "skincare": ["スキンケア提案1", "提案2", "提案3"],
  "makeup": ["メイク提案1", "提案2"],
  "productKeywords": ["楽天/Amazon検索用キーワード1", "キーワード2", "キーワード3"],
  "dailyTip": "今日やるべき一言アドバイス",
  "score": 0から100の整数（肌コンディションの主観スコア）
}

careLevel の目安:
- mild: 軽い乾燥や軽度の乱れ
- moderate: 赤み・ニキビ・荒れが目立つ
- attention: 強い炎症や痛みが疑われ、専門家相談を勧めるべき
`.trim();

  const content: OpenAIContentPart[] = [
    { type: "text", text: prompt },
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
      // Do not store this request in OpenAI for training / dashboard retention where supported
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
    return fallbackAnalysis(
      `AI解析に失敗したためデモ結果を表示しています（${data.error?.message ?? res.status}）。`
    );
  }

  const contentText = data.choices?.[0]?.message?.content;
  if (!contentText) {
    return fallbackAnalysis("AI応答が空だったため、デモ結果を表示しています。");
  }

  try {
    const parsed = extractJson(contentText) as Record<string, unknown>;
    const base = fallbackAnalysis();
    return withCareLevelMeta({
      summary: typeof parsed.summary === "string" ? parsed.summary : base.summary,
      skinCondition:
        typeof parsed.skinCondition === "string"
          ? parsed.skinCondition
          : base.skinCondition,
      concerns: asStringArray(parsed.concerns, base.concerns),
      acnePrediction:
        typeof parsed.acnePrediction === "string"
          ? parsed.acnePrediction
          : base.acnePrediction,
      careLevel: normalizeCareLevel(parsed.careLevel),
      skincare: asStringArray(parsed.skincare, base.skincare),
      makeup: asStringArray(parsed.makeup, base.makeup),
      productKeywords: asStringArray(parsed.productKeywords, base.productKeywords),
      dailyTip: typeof parsed.dailyTip === "string" ? parsed.dailyTip : base.dailyTip,
      score: clampScore(parsed.score),
    });
  } catch {
    return fallbackAnalysis("AI応答の解析に失敗したため、デモ結果を表示しています。");
  }
}
