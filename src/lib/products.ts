import type { ProductRecommendation, SkinAnalysis } from "./types";

function buildSearchUrl(keyword: string): string {
  return `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`;
}

function amazonSearchUrl(keyword: string): string {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}`;
}

export function buildFallbackProducts(
  analysis: SkinAnalysis
): ProductRecommendation[] {
  const keywords =
    analysis.productKeywords.length > 0
      ? analysis.productKeywords
      : ["敏感肌 スキンケア", "保湿クリーム", "低刺激 メイク"];

  return keywords.slice(0, 3).map((keyword, index) => ({
    id: `fallback-${index}`,
    name: `${keyword} のおすすめを探す`,
    price: "価格はECサイトで確認",
    shop: index === 2 ? "Amazon" : "楽天市場",
    reason: `${analysis.skinCondition} の傾向に合わせて「${keyword}」で探すのがおすすめです。`,
    url: index === 2 ? amazonSearchUrl(keyword) : buildSearchUrl(keyword),
    source: "search" as const,
  }));
}

type RakutenItem = {
  Item?: {
    itemName?: string;
    itemPrice?: number;
    itemUrl?: string;
    shopName?: string;
    mediumImageUrls?: { imageUrl?: string }[];
  };
};

export async function searchRakutenProducts(
  keywords: string[]
): Promise<ProductRecommendation[]> {
  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) {
    return [];
  }

  const keyword = keywords[0] || "敏感肌 スキンケア";
  const endpoint = new URL(
    "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706"
  );
  endpoint.searchParams.set("applicationId", appId);
  endpoint.searchParams.set("keyword", keyword);
  endpoint.searchParams.set("hits", "5");
  endpoint.searchParams.set("imageFlag", "1");
  endpoint.searchParams.set("sort", "standard");

  const res = await fetch(endpoint.toString(), {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as { Items?: RakutenItem[] };
  const items = data.Items ?? [];

  return items.slice(0, 3).map((entry, index) => {
    const item = entry.Item ?? {};
    return {
      id: `rakuten-${index}`,
      name: item.itemName ?? keyword,
      price: item.itemPrice ? `¥${item.itemPrice.toLocaleString("ja-JP")}` : "価格未取得",
      shop: item.shopName ?? "楽天市場",
      imageUrl: item.mediumImageUrls?.[0]?.imageUrl,
      reason: `肌状態に合うキーワード「${keyword}」で見つかった商品です。`,
      url: item.itemUrl ?? buildSearchUrl(keyword),
      source: "rakuten" as const,
    };
  });
}

export async function recommendProducts(
  analysis: SkinAnalysis
): Promise<ProductRecommendation[]> {
  try {
    const rakuten = await searchRakutenProducts(analysis.productKeywords);
    if (rakuten.length > 0) {
      return rakuten;
    }
  } catch {
    // fall through to search links
  }
  return buildFallbackProducts(analysis);
}
