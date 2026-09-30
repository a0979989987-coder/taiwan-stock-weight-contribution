import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台股加權點數計算機",
  description: "每日盤後解析十二大權值股對加權指數的影響，保留每日歷史紀錄。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}


