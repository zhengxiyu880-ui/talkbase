import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "talkbase · 把会议变成可检索的记忆",
  description:
    "导入会议 / 课堂的转写稿，生成结构化总结，并对着它提问（带时间戳引用）。本地优先，配不配 API Key 都能跑。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
