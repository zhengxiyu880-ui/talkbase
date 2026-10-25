/** 前端共用的流式读取工具。 */

export async function readTextStream(
  res: Response,
  onChunk: (text: string) => void,
): Promise<string> {
  if (!res.body) throw new Error("响应没有 body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    full += piece;
    onChunk(piece);
  }
  const tail = decoder.decode();
  if (tail) {
    full += tail;
    onChunk(tail);
  }
  return full;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 固定的短日期，避免服务端/浏览器 locale 不一致导致 hydration 警告 */
export function shortDate(iso: string): string {
  return iso.slice(5, 10).replace("-", "/");
}
