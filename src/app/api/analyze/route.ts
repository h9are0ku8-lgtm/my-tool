import { NextResponse } from "next/server";
import { analyzeSkinWithOpenAI } from "@/lib/openai";
import { recommendProducts } from "@/lib/products";
import {
  checkRateLimit,
  getClientIp,
  isAllowedOrigin,
  validateImageDataUrl,
} from "@/lib/security";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";

const DISCLAIMER =
  "本サービスは美容目的の一般的なアドバイスです。医療診断・治療の代替にはなりません。気になる症状がある場合は皮膚科などの専門家にご相談ください。画像は解析処理のため一時的に利用し、サーバーには保存しません。";

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { error: "許可されていないリクエスト元です。" },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    const rate = checkRateLimit(`analyze:${ip}`);
    if (!rate.ok) {
      return NextResponse.json(
        {
          error: `リクエストが多すぎます。${rate.retryAfterSec}秒後に再試行してください。`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      );
    }

    const body = (await request.json()) as {
      imageDataUrl?: string;
      consent?: boolean;
    };

    if (body.consent !== true) {
      return NextResponse.json(
        { error: "プライバシー同意が必要です。" },
        { status: 400 }
      );
    }

    if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
      return NextResponse.json({ error: "画像データが必要です。" }, { status: 400 });
    }

    const validated = validateImageDataUrl(body.imageDataUrl);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const analysis = await analyzeSkinWithOpenAI(validated.dataUrl);
    const products = await recommendProducts(analysis);

    const payload: AnalyzeResponse = {
      analysis,
      products,
      disclaimer: DISCLAIMER,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "解析に失敗しました。時間をおいて再試行してください。" },
      { status: 500 }
    );
  }
}
