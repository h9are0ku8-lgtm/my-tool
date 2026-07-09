import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI美容コンシェルジュ | my-tool",
  description:
    "肌を撮るだけで状態・ニキビ予測・ケアレベル・スキンケア/メイク提案、おすすめ化粧品のEC誘導、毎日の成長記録ができるAI美容コンシェルジュ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
