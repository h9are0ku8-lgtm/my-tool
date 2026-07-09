# AI美容コンシェルジュ (my-tool)

肌を撮るだけで、肌状態・ニキビ予測・ケアレベル・スキンケア/メイク提案を行い、おすすめ化粧品をECへ誘導する MVP です。毎日の成長記録も端末内に保存できます。

## できること

- 肌写真のアップロード / カメラ撮影
- AI による肌状態コメント、ニキビ予測、ケアレベル表示
- スキンケア提案 / メイク提案
- おすすめ化粧品の検索キーワード生成 → 楽天市場 or 検索結果へ誘導
- 毎日の成長記録（localStorage）

## 注意

本アプリは美容目的の一般アドバイスです。医療診断の代替ではありません。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

### 環境変数

| Key | 必須 | 説明 |
|---|---|---|
| `OPENAI_API_KEY` | 推奨 | 画像解析と提案に使用。未設定時はデモ結果 |
| `OPENAI_MODEL` | 任意 | 既定 `gpt-4o-mini` |
| `RAKUTEN_APP_ID` | 任意 | 設定時は楽天商品APIで実商品を取得。未設定時は検索ページへ誘導 |

Vercel では Project Settings → Environment Variables に同じキーを追加し、Redeploy してください。

## デプロイ

GitHub の `main` に push すると、連携済みの Vercel プロジェクトが自動デプロイします。
