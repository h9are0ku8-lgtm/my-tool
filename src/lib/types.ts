export type CareLevel = "mild" | "moderate" | "attention";

export type SkinAnalysis = {
  summary: string;
  skinCondition: string;
  concerns: string[];
  acnePrediction: string;
  careLevel: CareLevel;
  careLevelLabel: string;
  careLevelNote: string;
  skincare: string[];
  makeup: string[];
  productKeywords: string[];
  dailyTip: string;
  score: number;
};

export type ProductRecommendation = {
  id: string;
  name: string;
  price: string;
  shop: string;
  imageUrl?: string;
  reason: string;
  url: string;
  source: "rakuten" | "search";
};

export type AnalyzeResponse = {
  analysis: SkinAnalysis;
  products: ProductRecommendation[];
  disclaimer: string;
  mode: "ai" | "rules";
  modeLabel: string;
};

export type GrowthEntry = {
  id: string;
  date: string;
  score: number;
  summary: string;
  careLevelLabel: string;
  dailyTip: string;
  concerns: string[];
};
