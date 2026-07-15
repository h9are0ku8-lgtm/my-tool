import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveBadges,
  deriveCoachComment,
  deriveDailyLabels,
  deriveIngredients,
  deriveMetrics,
  starsDisplay,
  weekSeries,
} from "../metrics";
import type { GrowthEntry, SkinAnalysis } from "../types";

const sample: SkinAnalysis = {
  summary: "全体的に潤いはあるものの、乾燥と軽い毛穴が気になります。",
  skinCondition: "やや乾燥・毛穴が目立ちやすい印象",
  concerns: ["乾燥", "毛穴の目立ち"],
  acnePrediction: "今後数日は大きなニキビは出にくそうです。",
  careLevel: "mild",
  careLevelLabel: "セルフケアで様子見",
  careLevelNote: "日常ケアの見直しで改善しやすい状態です。",
  skincare: ["保湿"],
  makeup: ["薄づき"],
  productKeywords: ["セラミド クリーム", "乾燥肌 化粧水"],
  dailyTip: "今夜は保湿を優先しましょう。",
  score: 75,
};

test("指標は4項目で星が出る", () => {
  const metrics = deriveMetrics(sample);
  assert.equal(metrics.length, 4);
  assert.equal(metrics[0].label, "潤い");
  assert.ok(metrics.every((m) => m.stars >= 1 && m.stars <= 5));
  assert.equal(starsDisplay(4), "★★★★☆");
});

test("毎日ラベルが3つ出る", () => {
  const labels = deriveDailyLabels(sample, new Date("2026-07-15T12:00:00"));
  assert.equal(labels.length, 3);
  assert.ok(labels[0].text.length > 0);
});

test("おすすめ成分が先に出る", () => {
  const ingredients = deriveIngredients(sample);
  assert.ok(ingredients.length >= 2);
  assert.ok(ingredients.some((i) => i.name.includes("セラミド")));
});

test("コーチコメントに点数目標がある", () => {
  const coach = deriveCoachComment(sample);
  assert.match(coach.headline, /75/);
  assert.ok(coach.target > 75);
});

test("バッジと週間シリーズが計算できる", () => {
  const entries: GrowthEntry[] = [
    {
      id: "1",
      date: "2026-07-15",
      score: 78,
      summary: "a",
      careLevelLabel: "x",
      dailyTip: "y",
      concerns: ["乾燥"],
    },
    {
      id: "2",
      date: "2026-07-14",
      score: 75,
      summary: "a",
      careLevelLabel: "x",
      dailyTip: "y",
      concerns: ["毛穴"],
    },
    {
      id: "3",
      date: "2026-07-13",
      score: 72,
      summary: "a",
      careLevelLabel: "x",
      dailyTip: "y",
      concerns: ["乾燥"],
    },
  ];
  const badges = deriveBadges(entries, sample);
  assert.ok(badges.length >= 1);
  const week = weekSeries(entries, new Date("2026-07-15T12:00:00"));
  assert.equal(week.length, 7);
  assert.equal(week[6].score, 78);
});
