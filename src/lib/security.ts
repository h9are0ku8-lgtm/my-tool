const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(
  key: string,
  limit = 8,
  windowMs = 10 * 60 * 1000
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  rateBuckets.set(key, current);
  return { ok: true };
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  const allowed = new Set<string>();
  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowed.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
  }
  // Production alias used by this project
  allowed.add("https://my-tool-bay.vercel.app");
  allowed.add("http://localhost:3000");
  allowed.add("http://127.0.0.1:3000");

  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  const candidates = [origin, referer]
    .filter((v): v is string => Boolean(v))
    .map((v) => {
      try {
        return new URL(v).origin;
      } catch {
        return null;
      }
    })
    .filter((v): v is string => Boolean(v));

  // Same-origin browser requests should include Origin or Referer.
  if (candidates.length === 0) {
    return false;
  }

  return candidates.some((value) => allowed.has(value));
}

export type ValidatedImage =
  | { ok: true; dataUrl: string; mime: string }
  | { ok: false; error: string };

export function validateImageDataUrl(imageDataUrl: string): ValidatedImage {
  if (!imageDataUrl.startsWith("data:image/")) {
    return { ok: false, error: "画像形式が不正です。" };
  }

  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    return { ok: false, error: "画像データ形式が不正です。" };
  }

  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "JPEG / PNG / WebP のみ対応しています。" };
  }

  const base64 = match[2].replace(/\s/g, "");
  // ~1.5MB binary after decode (~2MB base64)
  if (base64.length > 2_800_000) {
    return {
      ok: false,
      error: "画像が大きすぎます。もう少し小さい写真で再試行してください。",
    };
  }

  if (base64.length < 100) {
    return { ok: false, error: "画像データが不正です。" };
  }

  return {
    ok: true,
    dataUrl: `data:${mime};base64,${base64}`,
    mime,
  };
}
