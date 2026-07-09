import { NextResponse } from "next/server";
import { analyzeSkinWithOpenAI } from "@/lib/openai";
import { recommendProducts } from "@/lib/products";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";

const DISCLAIMER =
  "本サービスは美容目的の一般的なアドバイスです。医療診断・治療の代替にはなりません。気になる症状がある場合は皮膚科などの専門家にご相談ください。";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { imageDataUrl?: string };
    const imageDataUrl = body.imageDataUrl;

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return NextResponse.json({ error: "画像データが必要です。" }, { status: 400 });
    }

    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "画像形式が不正です。JPEG / PNG をアップロードしてください。" },
        { status: 400 }
      );
    }

    // Rough size guard (~4MB base64)
    if (imageDataUrl.length > 5_500_000) {
      return NextResponse.json(
        { error: "画像が大きすぎます。もう少し小さい写真で再試行してください。" },
        { status: 400 }
      );
    }

    const analysis = await analyzeSkinWithOpenAI(imageDataUrl);
    const products = await recommendProducts(analysis);

    const payload: AnalyzeResponse = {
      analysis,
      products,
      disclaimer: DISCLAIMER,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json(
      { error: `解析に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
