"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzeResponse, GrowthEntry } from "@/lib/types";
import { prepareImageForAnalysis } from "@/lib/image";
import {
  clearGrowthEntries,
  loadGrowthEntries,
  saveGrowthEntry,
  todayKey,
} from "@/lib/storage";
import {
  chartScores,
  deriveBadges,
  deriveCoachComment,
  deriveDailyLabels,
  deriveIngredients,
  deriveMetrics,
  starsDisplay,
  weekSeries,
} from "@/lib/metrics";

function careLevelClass(level: string): string {
  if (level === "attention") return "badge badge-attention";
  if (level === "moderate") return "badge badge-moderate";
  return "badge badge-mild";
}

export default function BeautyConciergeApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [entries, setEntries] = useState<GrowthEntry[]>([]);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);

  useEffect(() => {
    setEntries(loadGrowthEntries());
  }, []);

  const latestScore = entries[0]?.score;
  const scoreTrend = useMemo(() => {
    if (entries.length < 2) return null;
    return entries[0].score - entries[1].score;
  }, [entries]);

  const metrics = useMemo(
    () => (result ? deriveMetrics(result.analysis) : []),
    [result]
  );
  const dailyLabels = useMemo(
    () => (result ? deriveDailyLabels(result.analysis) : []),
    [result]
  );
  const ingredients = useMemo(
    () => (result ? deriveIngredients(result.analysis) : []),
    [result]
  );
  const coach = useMemo(
    () => (result ? deriveCoachComment(result.analysis) : null),
    [result]
  );
  const badges = useMemo(
    () => deriveBadges(entries, result?.analysis ?? null),
    [entries, result]
  );
  const week = useMemo(() => weekSeries(entries), [entries]);
  const sparkScores = useMemo(() => {
    const base = chartScores(entries, 7);
    if (result && !entries.some((e) => e.date === todayKey())) {
      return [...base, result.analysis.score];
    }
    return base.length ? base : result ? [result.analysis.score] : [];
  }, [entries, result]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setError(null);
    setResult(null);
    setSavedMessage(null);
    try {
      const dataUrl = await prepareImageForAnalysis(file);
      setPreview(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像読み込みエラー");
    }
  }

  function clearPreview() {
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function analyze() {
    if (!consent) {
      setError("続行するにはプライバシー同意が必要です。");
      return;
    }
    if (!preview) {
      setError("先に肌写真をアップロードしてください。");
      return;
    }
    setLoading(true);
    setError(null);
    setSavedMessage(null);

    const imageForRequest = preview;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: imageForRequest,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "解析に失敗しました");
      }
      setResult(data as AnalyzeResponse);
      setDetailOpen(false);
      setProductsOpen(false);
      clearPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function saveToday() {
    if (!result) return;
    const entry: GrowthEntry = {
      id: crypto.randomUUID(),
      date: todayKey(),
      score: result.analysis.score,
      summary: result.analysis.summary,
      careLevelLabel: result.analysis.careLevelLabel,
      dailyTip: result.analysis.dailyTip,
      concerns: result.analysis.concerns,
    };
    const next = saveGrowthEntry(entry);
    setEntries(next);
    setSavedMessage("今日の成長記録を保存しました（写真は保存していません）。");
  }

  function resetHistory() {
    clearGrowthEntries();
    setEntries([]);
    setSavedMessage("記録をクリアしました。");
  }

  function pickPhoto() {
    inputRef.current?.click();
  }

  function startDiagnosis() {
    document.getElementById("upload-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.setTimeout(() => pickPhoto(), 280);
  }

  return (
    <div className="page">
      <header className="hero compact-hero">
        <p className="eyebrow">AI Beauty Concierge</p>
        <h1>撮るだけで、今日の肌とケアがわかる</h1>
        <p className="hero-sub">約5秒でAI診断</p>
        <button type="button" className="btn primary" onClick={startDiagnosis}>
          診断を始める
        </button>
      </header>

      <section className="panel privacy-panel compact-privacy">
        <details>
          <summary>プライバシーと安全について（同意が必要です）</summary>
          <ul className="privacy-list">
            <li>写真は解析のためだけに一時利用し、サーバーには保存しません。</li>
            <li>解析後、画面上の写真プレビューもすぐ破棄します。</li>
            <li>成長記録には文章結果のみを端末内保存し、写真は含めません。</li>
            <li>APIキーはサーバー側のみで扱い、ブラウザには出しません。</li>
            <li>AI枠が使えない場合は、課金なしのルールベース提案に自動切替します。</li>
            <li>本サービスは美容アドバイスであり、医療診断ではありません。</li>
          </ul>
        </details>
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            上記に同意し、肌写真を解析目的で一時送信することを許可します。
          </span>
        </label>
      </section>

      <section className="panel" id="upload-section">
        <div className="upload-grid">
          <div>
            <h2>1. 肌を撮る / アップロード</h2>
            <p className="muted">
              送信前に端末内で圧縮します。解析後はプレビューを自動削除します。
            </p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={pickPhoto}>
                写真を選ぶ
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.JPG,.JPEG,.HEIC,.HEIF"
                hidden
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="btn"
                disabled={!preview || loading || !consent}
                onClick={analyze}
              >
                {loading ? "解析中..." : "診断する"}
              </button>
              {preview && (
                <button type="button" className="btn ghost" onClick={clearPreview}>
                  写真を破棄
                </button>
              )}
            </div>
            {!consent && (
              <p className="muted">診断には上部のプライバシー同意が必要です。</p>
            )}
            {error && <p className="error">{error}</p>}
          </div>
          <div className="preview-wrap">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="アップロードした肌写真" className="preview" />
            ) : (
              <div className="preview placeholder">
                {result
                  ? "解析後、写真プレビューは破棄済みです"
                  : "ここにプレビューが表示されます"}
              </div>
            )}
          </div>
        </div>
      </section>

      {result && coach && (
        <>
          <section className="panel diagnosis-hero">
            <p className="diagnosis-kicker">🌸 今日の診断</p>
            <div className="diagnosis-score-row">
              <strong className="diagnosis-score">{result.analysis.score}</strong>
              <span className="diagnosis-score-unit">点 😊</span>
            </div>
            <p className="diagnosis-mood">
              {moodLine(result.analysis.score, metrics)}
            </p>
            <p className="diagnosis-tip">{coach.body}</p>

            <hr className="diagnosis-rule" />

            <ul className="diagnosis-metrics">
              {metrics.map((m) => (
                <li key={m.key}>
                  <span className="metric-emoji" aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className="metric-name">{m.label}</span>
                  <span className="metric-stars" aria-label={`${m.stars}つ星`}>
                    {starsDisplay(m.stars)}
                  </span>
                  <span className="metric-mark">{markFromStars(m.stars)}</span>
                </li>
              ))}
            </ul>

            <div className="daily-labels">
              {dailyLabels.map((label) => (
                <span key={label.text} className="daily-label">
                  {label.emoji} {label.text}
                </span>
              ))}
            </div>

            <p className="mode-pill compact">
              判定モード: {result.modeLabel}
              {result.mode === "rules" ? "（無料）" : ""}
            </p>

            <button
              type="button"
              className="btn ghost detail-toggle"
              onClick={() => setDetailOpen((v) => !v)}
              aria-expanded={detailOpen}
            >
              {detailOpen ? "詳細を閉じる" : "詳しく見る"}
            </button>

            {detailOpen && (
              <div className="detail-expand">
                <p className="summary">{result.analysis.summary}</p>
                <div className="cards">
                  <article className="card">
                    <h3>🧴 肌の状態</h3>
                    <p>{result.analysis.skinCondition}</p>
                    <ul>
                      {result.analysis.concerns.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="card">
                    <h3>😊 ニキビ予測</h3>
                    <p>{result.analysis.acnePrediction}</p>
                  </article>
                  <article className="card">
                    <h3>🌿 ケアレベル</h3>
                    <p>{result.analysis.careLevelNote}</p>
                    <p className="tip">{result.analysis.dailyTip}</p>
                    <span className={careLevelClass(result.analysis.careLevel)}>
                      {result.analysis.careLevelLabel}
                    </span>
                  </article>
                </div>

                <h3 className="sub-heading">スキンケア / メイク</h3>
                <div className="cards two">
                  <article className="card">
                    <h3>💧 スキンケア</h3>
                    <ol>
                      {result.analysis.skincare.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </article>
                  <article className="card">
                    <h3>✨ メイク</h3>
                    <ol>
                      {result.analysis.makeup.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </article>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <h2>おすすめ成分</h2>
            <p className="muted">売り込みではなく、今日の肌に合いそうな成分のヒントです。</p>
            <ul className="ingredient-list">
              {ingredients.map((ing) => (
                <li key={ing.name}>
                  <strong>✔ {ing.name}</strong>
                  <span className="ingredient-why-label">おすすめ理由</span>
                  <span>{ing.why}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn primary ingredient-cta"
              onClick={() => setProductsOpen((v) => !v)}
              aria-expanded={productsOpen}
            >
              {productsOpen
                ? "商品一覧を閉じる"
                : "この成分が入った商品を見る"}
            </button>
            {productsOpen && (
              <div className="product-grid product-reveal">
                {result.products.map((product) => (
                  <article key={product.id} className="product-card">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" className="product-image" />
                    ) : (
                      <div className="product-image placeholder">EC</div>
                    )}
                    <div className="product-body">
                      <h3>{product.name}</h3>
                      <p className="muted">
                        {product.shop} / {product.price}
                      </p>
                      <p>{product.reason}</p>
                      <a
                        className="btn primary small"
                        href={product.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        商品ページを開く
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="result-head">
              <div>
                <h2>毎日の成長記録</h2>
                <p className="muted">
                  文章結果のみをこの端末に保存します。写真は保存しません。
                </p>
              </div>
              <div className="actions">
                <button type="button" className="btn primary" onClick={saveToday}>
                  今日の結果を記録
                </button>
                <button type="button" className="btn ghost" onClick={resetHistory}>
                  記録クリア
                </button>
              </div>
            </div>
            {savedMessage && <p className="ok">{savedMessage}</p>}
            {typeof latestScore === "number" && (
              <p className="muted">
                直近スコア: {latestScore}
                {scoreTrend !== null && (
                  <>
                    （前回比 {scoreTrend >= 0 ? "+" : ""}
                    {scoreTrend}）
                  </>
                )}
              </p>
            )}

            <div className="growth-chart-wrap">
              <p className="chart-title">📈 スコアの推移</p>
              {sparkScores.length > 0 ? (
                <ScoreSparkline scores={sparkScores} />
              ) : (
                <p className="muted">記録するとグラフが育ちます。</p>
              )}
            </div>

            <div className="week-board">
              <p className="chart-title">一週間の変化</p>
              <ol className="week-row">
                {week.map((d) => (
                  <li key={d.key}>
                    <span>{d.label}</span>
                    <strong>{d.score ?? "—"}</strong>
                  </li>
                ))}
              </ol>
            </div>

            {badges.length > 0 && (
              <div className="badge-board">
                <p className="chart-title">バッジ</p>
                <ul className="badge-row">
                  {badges.map((b) => (
                    <li key={b.id}>
                      <span className="badge-emoji">{b.emoji}</span>
                      <strong>{b.title}</strong>
                      <span>{b.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="history">
              {entries.length === 0 && <p className="muted">まだ記録がありません。</p>}
              {entries.map((entry) => (
                <article key={entry.id} className="history-item">
                  <div>
                    <strong>{entry.date}</strong>
                    <span className="muted"> / スコア {entry.score}</span>
                  </div>
                  <p>{entry.summary}</p>
                  <p className="muted">
                    {entry.careLevelLabel} — {entry.dailyTip}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <p className="disclaimer">{result.disclaimer}</p>
        </>
      )}
    </div>
  );
}

function markFromStars(stars: number): string {
  if (stars >= 5) return "◎";
  if (stars >= 4) return "○";
  if (stars >= 3) return "△";
  return "▲";
}

function moodLine(
  score: number,
  metrics: { key: string; stars: number; label: string }[]
): string {
  if (score >= 85) return "😊 今日の肌はかなり良好です";
  if (score >= 75) return "🙂 今日の肌はまずまず良好です";
  if (score >= 65) return "😌 今日の肌は少しケアが効きそうです";
  const weak = metrics.filter((m) => m.stars <= 2).map((m) => m.label);
  if (weak.length) return `🫣 今日は${weak[0]}を意識してみましょう`;
  return "🫧 今日の肌を丁寧に見てみましょう";
}

function ScoreSparkline({ scores }: { scores: number[] }) {
  const w = 340;
  const h = 150;
  const left = 42;
  const right = 16;
  const top = 18;
  const bottom = 28;
  const min = Math.min(...scores, 60);
  const max = Math.max(...scores, 95);
  const span = Math.max(1, max - min);
  const coords = scores.map((s, i) => {
    const x =
      left +
      (scores.length === 1
        ? (w - left - right) / 2
        : (i / (scores.length - 1)) * (w - left - right));
    const y = top + (1 - (s - min) / span) * (h - top - bottom);
    return { x, y, s };
  });
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area =
    `${left},${h - bottom} ` +
    polyline +
    ` ${coords[coords.length - 1]?.x ?? left},${h - bottom}`;

  return (
    <div className="sparkline chart-bold">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="スコア推移グラフ">
        {[0, 0.5, 1].map((t) => {
          const y = top + (1 - t) * (h - top - bottom);
          const val = Math.round(min + span * t);
          return (
            <g key={t}>
              <line
                x1={left}
                x2={w - right}
                y1={y}
                y2={y}
                stroke="rgba(74,52,40,0.12)"
                strokeDasharray="4 4"
              />
              <text x={left - 8} y={y + 4} textAnchor="end" className="spark-axis">
                {val}
              </text>
            </g>
          );
        })}
        <polygon points={area} fill="rgba(196,91,108,0.12)" />
        <polyline
          fill="none"
          stroke="#c45b6c"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        {coords.map((c, i) => (
          <g key={`${c.s}-${i}`}>
            <line
              x1={left}
              x2={c.x - 8}
              y1={c.y}
              y2={c.y}
              stroke="rgba(196,91,108,0.25)"
              strokeWidth="1.5"
            />
            <circle cx={c.x} cy={c.y} r="6" fill="#fff" stroke="#9e3f52" strokeWidth="3" />
            <text x={c.x} y={c.y - 12} textAnchor="middle" className="spark-label">
              {c.s}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
