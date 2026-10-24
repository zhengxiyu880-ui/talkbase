import type { Segment } from "./types";

/**
 * 解析粘贴进来的转写稿，支持三种常见格式：
 *   00:12 今天讨论三件事
 *   01:02:07 后半段
 *   没有时间戳的纯文本（每行按 5 秒间隔自动铺开）
 */
export function parseTranscript(raw: string): { t: number; text: string }[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: { t: number; text: string }[] = [];
  let auto = 0;

  for (const line of lines) {
    const m = line.match(/^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*[-—–·|]?\s*(.*)$/);
    if (m && m[4] && m[4].trim().length > 0) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const c = m[3] === undefined ? null : Number(m[3]);
      const t = c === null ? a * 60 + b : a * 3600 + b * 60 + c;
      out.push({ t, text: m[4].trim() });
      auto = t + 5;
    } else {
      out.push({ t: auto, text: line });
      auto += 5;
    }
  }

  return out;
}

export function transcriptToText(segments: Segment[]): string {
  return segments
    .map((s) => {
      const m = Math.floor(s.t / 60);
      const sec = s.t % 60;
      return `[${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}] ${s.text}`;
    })
    .join("\n");
}

export function pickTitle(raw: string): string {
  const first = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!first) return "未命名会议";
  const cleaned = first.replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-—–·|]?\s*/, "");
  return cleaned.slice(0, 40) || "未命名会议";
}
