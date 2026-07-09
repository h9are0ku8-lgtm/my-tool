import type { CareLevel, SkinAnalysis } from "./types";

const CARE_LEVEL_META: Record<
  CareLevel,
  { label: string; note: string }
> = {
  mild: {
    label: "セルフケアで様子見",
    note: "日常ケアの見直しで改善しやすい状態です。医療診断ではありません。",
  },
  moderate: {
    label: "丁寧なケア推奨",
    note: "刺激を避けつつ、保湿と清潔を優先しましょう。悪化時は専門家へ。",
  },
  attention: {
    label: "早めの相談推奨",
    note: "強い赤み・痛み・急な悪化がある場合は皮膚科受診を検討してください。",
  },
};

export function normalizeCareLevel(value: unknown): CareLevel {
  if (value === "moderate" || value === "attention" || value === "mild") {
    return value;
  }
  return "mild";
}

export function withCareLevelMeta(
  analysis: Omit<SkinAnalysis, "careLevelLabel" | "careLevelNote"> & {
    careLevel: CareLevel;
  }
): SkinAnalysis {
  const meta = CARE_LEVEL_META[analysis.careLevel];
  return {
    ...analysis,
    careLevelLabel: meta.label,
    careLevelNote: meta.note,
  };
}

export function fallbackAnalysis(reason?: string): SkinAnalysis {
  return withCareLevelMeta({
    summary:
      reason ??
      "画像から読み取れる範囲で、乾燥と軽い肌荒れの可能性が見られます。",
    skinCondition: "やや乾燥・キメが乱れやすい印象",
    concerns: ["乾燥", "毛穴の目立ち", "軽い赤み"],
    acnePrediction:
      "今後数日は、乾燥による小さなブツブツが出やすい可能性があります。保湿を優先してください。",
    careLevel: "mild",
    skincare: [
      "低刺激の洗顔で優しく洗う",
      "化粧水で水分を補給する",
      "セラミド配合の保湿クリームで蓋をする",
      "日中は日焼け止めを忘れずに",
    ],
    makeup: [
      "クッションファンデより、薄いバームや美容液下地を優先",
      "コンシーラーは必要な箇所だけ薄く",
      "パウダーは最小限にして乾燥を防ぐ",
    ],
    productKeywords: ["敏感肌 化粧水", "セラミド 保湿クリーム", "低刺激 日焼け止め"],
    dailyTip: "今夜は新しい刺激成分を足さず、保湿だけに集中してみましょう。",
    score: 72,
  });
}
