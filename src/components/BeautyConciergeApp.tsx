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

  useEffect(() => {
    setEntries(loadGrowthEntries());
  }, []);

  const latestScore = entries[0]?.score;
  const scoreTrend = useMemo(() => {
    if (entries.length < 2) return null;
    return entries[0].score - entries[1].score;
  }, [entries]);

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

    // Keep a local copy only for this request, then wipe UI preview ASAP after send
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
      // Do not keep the face image in UI/memory longer than needed
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

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">AI Beauty Concierge</p>
        <h1>撮るだけで、今日の肌とケアがわかる</h1>
        <p className="lede">
          肌写真から状態・ニキビ予測・ケアレベル・スキンケア/メイク提案まで。
          AI枠がなくても無料ルールモードで提案が続きます。おすすめ化粧品はECへ誘導できます。
        </p>
      </header>

      <section className="panel privacy-panel">
        <h2>プライバシーと安全について</h2>
        <ul className="privacy-list">
          <li>写真は解析のためだけに一時利用し、サーバーには保存しません。</li>
          <li>解析後、画面上の写真プレビューもすぐ破棄します。</li>
          <li>成長記録には文章結果のみを端末内保存し、写真は含めません。</li>
          <li>APIキーはサーバー側のみで扱い、ブラウザには出しません。</li>
          <li>AI枠が使えない場合は、課金なしのルールベース提案に自動切替します。</li>
          <li>本サービスは美容アドバイスであり、医療診断ではありません。</li>
        </ul>
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

      <section className="panel">
        <div className="upload-grid">
          <div>
            <h2>1. 肌を撮る / アップロード</h2>
            <p className="muted">
              送信前に端末内で圧縮します。解析後はプレビューを自動削除します。
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => inputRef.current?.click()}
              >
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

      {result && (
        <>
          <section className="panel">
            <div className="result-head">
              <div>
                <h2>2. 今日の肌診断</h2>
                <p className="mode-pill">
                  判定モード: {result.modeLabel}
                  {result.mode === "rules" ? "（無料・API課金なし）" : ""}
                </p>
                <p className="summary">{result.analysis.summary}</p>
              </div>
              <div className="score-card">
                <span className="score-label">肌スコア</span>
                <strong className="score">{result.analysis.score}</strong>
                <span className={careLevelClass(result.analysis.careLevel)}>
                  {result.analysis.careLevelLabel}
                </span>
              </div>
            </div>

            <div className="cards">
              <article className="card">
                <h3>肌の状態</h3>
                <p>{result.analysis.skinCondition}</p>
                <ul>
                  {result.analysis.concerns.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="card">
                <h3>ニキビ予測</h3>
                <p>{result.analysis.acnePrediction}</p>
              </article>
              <article className="card">
                <h3>ケアレベル</h3>
                <p>{result.analysis.careLevelNote}</p>
                <p className="tip">{result.analysis.dailyTip}</p>
              </article>
            </div>
          </section>

          <section className="panel">
            <h2>3. スキンケア / メイク提案</h2>
            <div className="cards two">
              <article className="card">
                <h3>スキンケア</h3>
                <ol>
                  {result.analysis.skincare.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </article>
              <article className="card">
                <h3>メイク</h3>
                <ol>
                  {result.analysis.makeup.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </article>
            </div>
          </section>

          <section className="panel">
            <h2>4. おすすめ化粧品（ECへ誘導）</h2>
            <p className="muted">
              肌状態から検索キーワードを作り、楽天市場（API設定時）または検索結果へ案内します。
            </p>
            <div className="product-grid">
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
                      ECで見る
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="result-head">
              <div>
                <h2>5. 毎日の成長記録</h2>
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
                  <>（前回比 {scoreTrend >= 0 ? "+" : ""}{scoreTrend}）</>
                )}
              </p>
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
                  <p className="muted">{entry.careLevelLabel} — {entry.dailyTip}</p>
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
