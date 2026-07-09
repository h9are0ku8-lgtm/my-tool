# AI美容コンシェルジュ (my-tool)

肌を撮るだけで、肌状態・ニキビ予測・ケアレベル・スキンケア/メイク提案を行い、おすすめ化粧品をECへ誘導する MVP です。毎日の成長記録も端末内に保存できます。

## できること

- 肌写真のアップロード / カメラ撮影
- AI による肌状態コメント、ニキビ予測、ケアレベル表示
- スキンケア提案 / メイク提案
- おすすめ化粧品の検索キーワード生成 → 楽天市場 or 検索結果へ誘導
- 毎日の成長記録（localStorage・文章のみ）

## プライバシー / セキュリティ

- 写真は解析のため一時利用し、サーバーには保存しません
- 解析後、画面上の写真プレビューを破棄します
- 送信前に端末内で画像を圧縮します
- 成長記録に写真は含めません
- `OPENAI_API_KEY` はサーバー側のみで使用
- API は Origin チェック・レート制限・同意フラグ必須
- OpenAI リクエストは `store: false` を指定

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
| `NEXT_PUBLIC_APP_URL` | 任意 | 本番URL（Origin許可に使用） |

Vercel では Project Settings → Environment Variables に同じキーを追加し、Redeploy してください。

## デプロイ

GitHub の `main` に push すると、連携済みの Vercel プロジェクトが自動デプロイします。
