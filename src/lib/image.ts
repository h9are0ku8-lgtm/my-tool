const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.72;

function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function isLikelyHeic(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const ext = extensionOf(file.name);
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    ext === "heic" ||
    ext === "heif"
  );
}

export function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // Mobile browsers sometimes leave type empty.
  return /\.(jpe?g|png|webp|heic|heif|gif|bmp|tif|tiff)$/i.test(file.name);
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(
          new Error(
            "この写真形式は読み込めませんでした。写真アプリでJPEG保存してから再試行してください。"
          )
        );
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function convertHeicToJpegBlob(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: JPEG_QUALITY,
  });
  const result = Array.isArray(converted) ? converted[0] : converted;
  if (!(result instanceof Blob)) {
    throw new Error("HEIC変換に失敗しました。");
  }
  return result;
}

async function normalizeToProcessableBlob(file: File): Promise<Blob> {
  if (isLikelyHeic(file)) {
    try {
      return await convertHeicToJpegBlob(file);
    } catch {
      throw new Error(
        "iPhoneのHEIC写真を変換できませんでした。写真アプリで「JPEGで書き出す」か、設定で「互換性優先」にして再撮影してください。"
      );
    }
  }
  return file;
}

/**
 * Accepts common smartphone formats (JPEG/PNG/WebP/HEIC/HEIF),
 * converts HEIC when needed, then returns a compressed JPEG data URL.
 */
export async function prepareImageForAnalysis(file: File): Promise<string> {
  if (!looksLikeImage(file) && !isLikelyHeic(file)) {
    throw new Error(
      "画像ファイルを選択してください（JPEG / PNG / WebP / HEIC）。"
    );
  }

  const processable = await normalizeToProcessableBlob(file);
  const rawDataUrl = await fileToDataUrl(processable);
  const smallEnough = processable.size <= 1_200_000;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (rawDataUrl.startsWith("data:image/")) return rawDataUrl;
    throw new Error("画像の処理に失敗しました。");
  }

  try {
    let width = 0;
    let height = 0;
    let drawable: ImageBitmap | HTMLImageElement | null = null;

    try {
      const bitmap = await createImageBitmap(processable);
      drawable = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      try {
        const image = await loadImageElement(processable);
        drawable = image;
        width = image.naturalWidth || image.width;
        height = image.naturalHeight || image.height;
      } catch {
        if (rawDataUrl.startsWith("data:image/") && smallEnough) {
          return rawDataUrl;
        }
        throw new Error(
          "この写真はブラウザで展開できませんでした。JPEG/PNGで保存してから再試行してください。"
        );
      }
    }

    if (!width || !height) {
      if (rawDataUrl.startsWith("data:image/") && smallEnough) return rawDataUrl;
      throw new Error("画像サイズを取得できませんでした。");
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);

    if ("close" in drawable && typeof drawable.close === "function") {
      drawable.close();
    }

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (!dataUrl.startsWith("data:image/jpeg")) {
      if (rawDataUrl.startsWith("data:image/")) return rawDataUrl;
      throw new Error("画像の変換に失敗しました。");
    }
    return dataUrl;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
