import type { GrowthEntry } from "./types";

const STORAGE_KEY = "ai-beauty-concierge-growth-v1";

export function loadGrowthEntries(): GrowthEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GrowthEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function saveGrowthEntry(entry: GrowthEntry): GrowthEntry[] {
  const current = loadGrowthEntries().filter((item) => item.date !== entry.date);
  const next = [entry, ...current].sort((a, b) => b.date.localeCompare(a.date));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearGrowthEntries(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
