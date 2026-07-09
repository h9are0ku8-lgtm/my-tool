# AI美容コンシェルジュ (my-tool)

肌を撮るだけで、肌状態・ニキビ予測・ケアレベル・スキンケア/メイク提案を行い、おすすめ化粧品をECへ誘導する MVP です。毎日の成長記録も端末内に保存できます。

## できること

- 肌写真のアップロード / カメラ撮影
- AI による肌状態コメント、ニキビ予測、ケアレベル表示
- スキンケア提案 / メイク提案
- おすすめ化粧品の検索キーワード生成 → 楽天市場 or 検索結果へ誘導
- 毎日の成長記録（localStorage・文章のみ）

## AI プロバイダ

既定は **Gemini 優先**、失敗時のみ OpenAI にフォールバックします。

| Key | 必須 | 説明 |
|---|---|---|
| `GEMINI_API_KEY` | 推奨 | Google AI Studio の APIキー |
| `GEMINI_MODEL` | 任意 | 既定 `gemini-2.0-flash` |
| `OPENAI_API_KEY` | 任意 | Gemini 失敗時の予備 |
| `OPENAI_MODEL` | 任意 | 既定 `gpt-4o-mini` |
| `AI_PROVIDER` | 任意 | `gemini`（既定）または `openai` |
| `RAKUTEN_APP_ID` | 任意 | 楽天商品API |
| `NEXT_PUBLIC_APP_URL` | 任意 | Origin許可用の本番URL |

## プライバシー / セキュリティ

- 写真は解析のため一時利用し、サーバーには保存しません
- 解析後、画面上の写真プレビューを破棄します
- 送信前に端末内で画像を圧縮します
- 成長記録に写真は含めません
- APIキーはサーバー側のみで使用
- API は Origin チェック・レート制限・同意フラグ必須

## 注意

本アプリは美容目的の一般アドバイスです。医療診断の代替ではありません。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

Gemini キーは [Google AI Studio](https://aistudio.google.com/apikey) で作成できます。

## デプロイ

GitHub の `main` に push すると、連携済みの Vercel プロジェクトが自動デプロイします。
Vercel の Environment Variables に `GEMINI_API_KEY` を追加し、Redeploy してください。
