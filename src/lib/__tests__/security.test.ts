import assert from "node:assert/strict";
import test from "node:test";
import { validateImageDataUrl } from "../security";

test("JPEG data URL を受け入れる", () => {
  const jpeg =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUTEhMWFhUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EAD0QAAIBAgQDBgQFAwQDAAAAAAECAwQRAAUSITFBBhMiUWFxMoGRoQcjQrHB0fAVYnLwFSQz/8QAGQEAAwEBAQAAAAAAAAAAAAAAAAECAwQF/8QAJBEAAgICAgMAAwEAAAAAAAAAAAECEQMhEjFBBFEiMkJhkf/aAAwDAQACEQMRAD8A9oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/2Q==";
  const result = validateImageDataUrl(jpeg);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.mime, "image/jpeg");
  }
});

test("data URL でない文字列は拒否する", () => {
  const result = validateImageDataUrl("https://example.com/a.jpg");
  assert.equal(result.ok, false);
});

test("短すぎる base64 は拒否する", () => {
  const result = validateImageDataUrl("data:image/jpeg;base64,aaa");
  assert.equal(result.ok, false);
});
