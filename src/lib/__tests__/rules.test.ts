import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSkinWithRules } from "../rules";

function loadSampleJpegDataUrl(): string {
  // 最小の JPEG data URL（スモーク用）
  const tinyJpegBase64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEhIVFRUVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EAD0QAAIBAgQDBgQFAwQDAAAAAAECAwQRAAUSITFBBhMiUWFxMoGRoQcjQrHB0fAVYnLwFSQz/8QAGQEAAwEBAQAAAAAAAAAAAAAAAAECAwQF/8QAJBEAAgICAgMAAwEAAAAAAAAAAAECEQMhEjFBBFEiMkJhkf/aAAwDAQACEQMRAD8A9oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/2Q==";
  return `data:image/jpeg;base64,${tinyJpegBase64}`;
}

test("ルールモードは SkinAnalysis 形の結果を返す", () => {
  const result = analyzeSkinWithRules(loadSampleJpegDataUrl());
  assert.equal(typeof result.summary, "string");
  assert.ok(result.summary.length > 0);
  assert.equal(typeof result.score, "number");
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(Array.isArray(result.skincare));
  assert.ok(result.skincare.length > 0);
  assert.ok(Array.isArray(result.productKeywords));
  assert.ok(["mild", "moderate", "attention"].includes(result.careLevel));
});

test("不正な画像でもフォールバック提案を返す", () => {
  const result = analyzeSkinWithRules("data:image/jpeg;base64,aaa");
  assert.ok(result.summary.includes("無料ルールモード") || result.skincare.length > 0);
  assert.ok(result.productKeywords.length > 0);
});
