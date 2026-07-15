import type { GrowthEntry, SkinAnalysis } from "./types";

export type SkinMetricKey = "moisture" | "pores" | "acne" | "sensitivity";

export type SkinMetric = {
  key: SkinMetricKey;
  emoji: string;
  label: string;
  stars: number; // 1-5
};

export type DailyLabel = {
  emoji: string;
  text: string;
};

export type IngredientRec = {
  name: string;
  why: string;
};

export type Badge = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
};

function clampStars(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function hasConcern(concerns: string[], ...words: string[]): boolean {
  const joined = concerns.join(" ");
  return words.some((w) => joined.includes(w));
}

/** 文章結果から一目で分かる指標を推定 */
export function deriveMetrics(analysis: SkinAnalysis): SkinMetric[] {
  const { concerns, score, careLevel, acnePrediction, skinCondition } = analysis;
  const text = `${skinCondition} ${acnePrediction} ${analysis.summary}`;

  let moisture = 4;
  if (hasConcern(concerns, "乾燥") || text.includes("乾燥")) moisture = 2;
  else if (hasConcern(concerns, "皮脂", "テカリ") || text.includes("皮脂"))
    moisture = 3;
  else if (score >= 80) moisture = 5;
  else if (score >= 70) moisture = 4;

  let pores = 3;
  if (hasConcern(concerns, "毛穴") || text.includes("毛穴")) pores = 2;
  else if (score >= 82) pores = 4;
  else if (score < 60) pores = 2;

  let acne = 4;
  if (
    hasConcern(concerns, "ニキビ", "ブツブツ") ||
    text.includes("ニキビ") ||
    text.includes("吹き出物")
  ) {
    acne = 2;
  } else if (text.includes("出やすい")) {
    acne = 3;
  } else if (score >= 85) {
    acne = 5;
  }

  let sensitivity = 4;
  if (hasConcern(concerns, "赤み", "敏感") || text.includes("赤み")) {
    sensitivity = 2;
  } else if (careLevel === "attention") {
    sensitivity = 1;
  } else if (careLevel === "moderate") {
    sensitivity = 3;
  } else if (score >= 80) {
    sensitivity = 5;
  }

  return [
    {
      key: "moisture",
      emoji: "💧",
      label: "潤い",
      stars: clampStars(moisture),
    },
    {
      key: "pores",
      emoji: "✨",
      label: "毛穴",
      stars: clampStars(pores),
    },
    {
      key: "acne",
      emoji: "😊",
      label: "ニキビ",
      stars: clampStars(acne),
    },
    {
      key: "sensitivity",
      emoji: "🌿",
      label: "敏感さ",
      stars: clampStars(sensitivity),
    },
  ];
}

export function starsDisplay(stars: number): string {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

/** 毎日変わるラベル（日付＋スコアで安定して変化） */
export function deriveDailyLabels(
  analysis: SkinAnalysis,
  date = new Date()
): DailyLabel[] {
  const day = date.getDate() + date.getMonth() * 3;
  const metrics = deriveMetrics(analysis);
  const moisture = metrics.find((m) => m.key === "moisture")!.stars;
  const acne = metrics.find((m) => m.key === "acne")!.stars;
  const sensitivity = metrics.find((m) => m.key === "sensitivity")!.stars;

  const types: DailyLabel[] = [];
  if (moisture >= 4) types.push({ emoji: "🌸", text: "うるおい肌" });
  else if (moisture <= 2) types.push({ emoji: "🏜️", text: "乾燥ケア肌" });
  else types.push({ emoji: "🌊", text: "バランスタイプ" });

  const uvPool = [
    { emoji: "🌞", text: "紫外線注意" },
    { emoji: "☁️", text: "やさしい日差し" },
    { emoji: "🧢", text: "日中ケア推奨" },
  ];
  types.push(uvPool[day % uvPool.length]);

  const vibePool: DailyLabel[] = [];
  if (analysis.score < 65 || sensitivity <= 2) {
    vibePool.push({ emoji: "😴", text: "睡眠不足気味" });
  }
  if (acne <= 2) vibePool.push({ emoji: "🫧", text: "清潔ケアデー" });
  if (analysis.score >= 80) vibePool.push({ emoji: "✨", text: "調子よさそう" });
  vibePool.push(
    { emoji: "🍵", text: "リラックス推奨" },
    { emoji: "💧", text: "保湿ウィーク" },
    { emoji: "🧘", text: "刺激オフ推奨" }
  );
  types.push(vibePool[day % vibePool.length]);

  return types.slice(0, 3);
}

const INGREDIENT_MAP: { match: RegExp; name: string; why: string }[] = [
  {
    match: /乾燥|保湿|うるおい/,
    name: "セラミド",
    why: "うるおいのバリアを整える定番成分",
  },
  {
    match: /毛穴|皮脂|テカリ|ニキビ/,
    name: "ナイアシンアミド",
    why: "毛穴・皮脂・キメのバランスに",
  },
  {
    match: /乾燥|キメ|しっとり/,
    name: "ヒアルロン酸",
    why: "水分を抱え込んでふっくら感をサポート",
  },
  {
    match: /赤み|敏感/,
    name: "センテラエキス",
    why: "ゆらぎやすい日のやさしいケアに",
  },
  {
    match: /紫外線|日焼け|日中/,
    name: "UVカット",
    why: "日中の積み重ねダメージを防ぐ",
  },
  {
    match: /ニキビ|ブツブツ/,
    name: "サリチル酸（低刺激処方）",
    why: "清潔感を保ちつつ刺激を抑える処方を選んで",
  },
];

export function deriveIngredients(analysis: SkinAnalysis): IngredientRec[] {
  const blob = [
    ...analysis.concerns,
    ...analysis.productKeywords,
    analysis.skinCondition,
    analysis.dailyTip,
  ].join(" ");

  const found: IngredientRec[] = [];
  for (const item of INGREDIENT_MAP) {
    if (item.match.test(blob) && !found.some((f) => f.name === item.name)) {
      found.push({ name: item.name, why: item.why });
    }
    if (found.length >= 3) break;
  }

  if (found.length === 0) {
    return [
      { name: "セラミド", why: "基本のバリアケアに" },
      { name: "ナイアシンアミド", why: "コンディション整えに" },
      { name: "ヒアルロン酸", why: "うるおいキープに" },
    ];
  }
  while (found.length < 3) {
    const fallback = INGREDIENT_MAP[found.length];
    if (!found.some((f) => f.name === fallback.name)) {
      found.push({ name: fallback.name, why: fallback.why });
    } else break;
  }
  return found.slice(0, 3);
}

export function deriveCoachComment(analysis: SkinAnalysis): {
  headline: string;
  body: string;
  target: number;
} {
  const metrics = deriveMetrics(analysis);
  const moisture = metrics.find((m) => m.key === "moisture")!.stars;
  const target = Math.min(100, analysis.score + (moisture <= 2 ? 8 : 5));

  let body = analysis.dailyTip;
  if (moisture <= 2) {
    body = `乾燥が少しあります。今日は保湿を意識すると ${target}点以上を狙えそうです！`;
  } else if (metrics.find((m) => m.key === "acne")!.stars <= 2) {
    body = `清潔と保湿のバランスがポイント。刺激を抑えると ${target}点が見えてきます！`;
  } else if (analysis.score >= 80) {
    body = `調子いい流れです。今のケアを続けて ${target}点キープを目指しましょう！`;
  } else {
    body = `${analysis.dailyTip} 今日のひと工夫で ${target}点を狙えそうです！`;
  }

  return {
    headline: `今日の肌 😊 ${analysis.score}点`,
    body,
    target,
  };
}

export function deriveBadges(
  entries: GrowthEntry[],
  analysis?: SkinAnalysis | null
): Badge[] {
  const badges: Badge[] = [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // streak from most recent day backwards
  let streak = 0;
  if (sorted.length > 0) {
    const newest = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    const cursor = new Date(`${newest[0].date}T12:00:00`);
    for (const e of newest) {
      const key = cursor.toISOString().slice(0, 10);
      if (e.date === key) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
  }

  if (streak >= 3) {
    badges.push({
      id: "streak3",
      emoji: "🔥",
      title: `${streak}日連続記録`,
      desc: "続けていること自体がすごい",
    });
  } else if (streak === 2) {
    badges.push({
      id: "streak2",
      emoji: "🔥",
      title: "2日連続記録",
      desc: "あともう一日！",
    });
  } else if (entries.length >= 1) {
    badges.push({
      id: "start",
      emoji: "🌱",
      title: "記録スタート",
      desc: "毎日の一歩が変化になる",
    });
  }

  const moistCount = entries.filter((e) =>
    e.concerns.some((c) => c.includes("乾燥"))
  ).length;
  if (moistCount >= 2 || (analysis && analysis.concerns.some((c) => c.includes("乾燥")))) {
    badges.push({
      id: "moist",
      emoji: "🌸",
      title: "保湿マスター見習い",
      desc: "うるおいケアを意識中",
    });
  }

  const poreCount = entries.filter((e) =>
    e.concerns.some((c) => c.includes("毛穴"))
  ).length;
  if (
    poreCount >= 1 ||
    (analysis && analysis.concerns.some((c) => c.includes("毛穴")))
  ) {
    badges.push({
      id: "pores",
      emoji: "✨",
      title: "毛穴改善中",
      desc: "変化を見守るフェーズ",
    });
  }

  if (entries.some((e) => e.score >= 80) || (analysis && analysis.score >= 80)) {
    badges.push({
      id: "high",
      emoji: "🏆",
      title: "80点突破",
      desc: "調子のいい日を記録できた",
    });
  }

  if (entries.length >= 7) {
    badges.push({
      id: "week",
      emoji: "📅",
      title: "1週間チャレンジャー",
      desc: "一週間の変化が見えてきた",
    });
  }

  return badges.slice(0, 4);
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export type WeekPoint = {
  key: string;
  label: string;
  score: number | null;
};

/** 直近7日のスコア（古い→新しい） */
export function weekSeries(entries: GrowthEntry[], now = new Date()): WeekPoint[] {
  const map = new Map(entries.map((e) => [e.date, e.score]));
  const points: WeekPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({
      key,
      label: WEEKDAY[d.getDay()],
      score: map.has(key) ? (map.get(key) as number) : null,
    });
  }
  return points;
}

export function chartScores(entries: GrowthEntry[], limit = 8): number[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((e) => e.score);
}
