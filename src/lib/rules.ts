import jpeg from "jpeg-js";
import { withCareLevelMeta } from "./analysis";
import type { CareLevel, SkinAnalysis } from "./types";

type ImageStats = {
  brightness: number; // 0-255
  redness: number; // average R - ((G+B)/2)
  contrast: number; // rough stddev of luminance
  highlightRatio: number; // share of very bright pixels
  darkRatio: number; // share of dark pixels
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function decodeJpegBase64(base64: string): { width: number; height: number; data: Uint8Array } {
  const binary = Buffer.from(base64, "base64");
  const decoded = jpeg.decode(binary, { useTArray: true, formatAsRGBA: true });
  return {
    width: decoded.width,
    height: decoded.height,
    data: decoded.data as Uint8Array,
  };
}

function sampleStats(width: number, height: number, data: Uint8Array): ImageStats {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 64));
  let count = 0;
  let sumY = 0;
  let sumY2 = 0;
  let sumRedness = 0;
  let highlights = 0;
  let darks = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const redness = r - (g + b) / 2;

      sumY += luminance;
      sumY2 += luminance * luminance;
      sumRedness += redness;
      if (luminance >= 220) highlights += 1;
      if (luminance <= 45) darks += 1;
      count += 1;
    }
  }

  const safeCount = Math.max(1, count);
  const brightness = sumY / safeCount;
  const variance = sumY2 / safeCount - brightness * brightness;
  const contrast = Math.sqrt(Math.max(0, variance));

  return {
    brightness,
    redness: sumRedness / safeCount,
    contrast,
    highlightRatio: highlights / safeCount,
    darkRatio: darks / safeCount,
  };
}

function decideProfile(stats: ImageStats): {
  careLevel: CareLevel;
  score: number;
  concerns: string[];
  skinCondition: string;
  summary: string;
  acnePrediction: string;
  skincare: string[];
  makeup: string[];
  productKeywords: string[];
  dailyTip: string;
} {
  const concerns: string[] = [];
  let careLevel: CareLevel = "mild";
  let score = 78;

  const oily = stats.highlightRatio > 0.18 && stats.brightness > 150;
  const dry = stats.brightness < 110 || stats.darkRatio > 0.2;
  const red = stats.redness > 18;
  const textured = stats.contrast > 42;

  if (dry) {
    concerns.push("乾燥");
    score -= 8;
  }
  if (oily) {
    concerns.push("皮脂の光り");
    score -= 5;
  }
  if (red) {
    concerns.push("赤み");
    score -= 10;
    careLevel = "moderate";
  }
  if (textured) {
    concerns.push("キメの乱れ / 毛穴の目立ち");
    score -= 6;
  }
  if (!concerns.length) {
    concerns.push("大きな乱れは少なめ");
  }

  if (red && (dry || textured)) {
    careLevel = "attention";
    score -= 8;
  }

  score = clamp(Math.round(score), 45, 92);

  if (dry && !oily) {
    return {
      careLevel,
      score,
      concerns,
      skinCondition: "乾燥寄りで、うるおい不足が出やすい印象です",
      summary:
        "写真の明るさ・質感から、乾燥ケアを優先した方がよさそうです（ルールベース判定）。",
      acnePrediction:
        "乾燥が続くと、小さなブツブツやつっぱり感が出やすい可能性があります。保湿を厚めに。",
      skincare: [
        "低刺激洗顔でこすらず洗う",
        "化粧水を重ねづけして水分を入れる",
        "セラミドやオイルインの保湿で蓋をする",
        "日中は保湿下地 + 日焼け止め",
      ],
      makeup: [
        "マット系よりセミグロウ寄りの下地",
        "パウダーはTゾーンだけ薄く",
        "コンシーラーは最小限にして乾燥を防ぐ",
      ],
      productKeywords: ["乾燥肌 化粧水", "セラミド クリーム", "保湿 日焼け止め"],
      dailyTip: "今夜は新しい刺激成分を足さず、保湿だけに集中してみましょう。",
    };
  }

  if (oily && !dry) {
    return {
      careLevel,
      score,
      concerns,
      skinCondition: "皮脂の光りが目立ちやすく、テカリケアが有効そうです",
      summary:
        "ハイライトの出方から、皮脂コントロールを意識したケアが合いそうです（ルールベース判定）。",
      acnePrediction:
        "皮脂が多い日は毛穴詰まりから小さなニキビが出やすいことがあります。洗いすぎには注意。",
      skincare: [
        "朝夜とも泡で優しく洗顔（ごしごししない）",
        "油分控えめの化粧水で整える",
        "ジェル状の軽い保湿でうるおいを残す",
        "マットすぎない日焼け止めで仕上げる",
      ],
      makeup: [
        "皮脂吸着パウダーはTゾーン中心",
        "厚塗りファンデは避け、薄い下地を優先",
        "午後のテカリ直しはシート + 少量パウダー",
      ],
      productKeywords: ["皮脂 化粧水", "ジェル 保湿", "テカリ防止 下地"],
      dailyTip: "洗顔のしすぎは逆効果です。今日は優しめ洗浄 + 軽い保湿を意識しましょう。",
    };
  }

  if (red) {
    return {
      careLevel,
      score,
      concerns,
      skinCondition: "赤みが出やすく、刺激を避けるケアが優先です",
      summary:
        "色味の傾向から、赤みを落ち着かせる低刺激ケアがよさそうです（ルールベース判定）。",
      acnePrediction:
        "刺激が続くと赤みやニキビが目立ちやすくなることがあります。新しい成分の追加は控えめに。",
      skincare: [
        "アルコール多めの化粧水は避ける",
        "鎮静系（CICAなど）の化粧水を使う",
        "保湿でバリアを整える",
        "摩擦を減らす（タオルで叩かない）",
      ],
      makeup: [
        "グリーン系補正は必要な箇所だけ",
        "落ちにくいより、落としやすい処方を優先",
        "クレンジングはオイルでもこすらず短時間",
      ],
      productKeywords: ["赤み 化粧水", "CICA クリーム", "低刺激 クレンジング"],
      dailyTip: "今日は新しい美容液を足さず、鎮静と保湿だけに絞りましょう。",
    };
  }

  return {
    careLevel,
    score,
    concerns,
    skinCondition: "大きな偏りは少なめ。現状維持の丁寧ケアが合いそうです",
    summary:
      "写真全体のバランスから、今の調子は比較的安定寄りです。基本の保湿と紫外線対策を続けましょう（ルールベース判定）。",
    acnePrediction:
      "急な悪化サインは少なめです。睡眠と保湿が乱れるとニキビが出やすくなるので、基本ケアを継続してください。",
    skincare: [
      "いつも通りの低刺激洗顔",
      "化粧水 → 保湿の基本をキープ",
      "週1〜2回だけやさしい角質ケア（刺激が強いものは避ける）",
      "日焼け止めを毎日使う",
    ],
    makeup: [
      "薄い下地で肌を見せるメイク",
      "コンシーラーは必要なところだけ",
      "夜はしっかり落とす（こすらない）",
    ],
    productKeywords: ["敏感肌 化粧水", "保湿クリーム", "デイリー 日焼け止め"],
    dailyTip: "調子が安定している日こそ、基本の3ステップを崩さないのが近道です。",
  };
}

/**
 * Free, offline-ish rule-based analysis from simple image statistics.
 * Not a medical diagnosis and not as rich as LLM vision, but works without paid API quota.
 */
export function analyzeSkinWithRules(imageDataUrl: string): SkinAnalysis {
  try {
    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new Error("invalid data url");
    }
    const mime = match[1].toLowerCase();
    const base64 = match[2];

    // jpeg-js handles JPEG. For PNG/WebP uploaded via UI we already convert to JPEG client-side.
    if (!mime.includes("jpeg") && !mime.includes("jpg")) {
      throw new Error("unsupported mime for rules");
    }

    const decoded = decodeJpegBase64(base64);
    const stats = sampleStats(decoded.width, decoded.height, decoded.data);
    const profile = decideProfile(stats);

    return withCareLevelMeta({
      ...profile,
      summary: `${profile.summary}`,
    });
  } catch {
    return withCareLevelMeta({
      summary:
        "無料ルールモードで基本提案を表示しています。AI枠がなくてもスキンケアの方向性を確認できます。",
      skinCondition: "標準的な混合〜普通肌向けの基本ケアが無難です",
      concerns: ["乾燥予防", "紫外線対策"],
      acnePrediction:
        "急な悪化サインは判定できませんでしたが、保湿と清潔を続ければリスクを下げやすいです。",
      careLevel: "mild",
      skincare: [
        "低刺激洗顔",
        "化粧水で水分補給",
        "保湿クリームで蓋",
        "日中は日焼け止め",
      ],
      makeup: [
        "薄い下地を優先",
        "コンシーラーは最小限",
        "夜は優しくクレンジング",
      ],
      productKeywords: ["敏感肌 化粧水", "保湿クリーム", "日焼け止め"],
      dailyTip: "まずは基本の保湿を7日続けて、変化を記録してみましょう。",
      score: 74,
    });
  }
}
