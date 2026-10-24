const encoder = new TextEncoder();

/**
 * 把一段异步文本流原样透传给浏览器，同时在服务端累积全文；
 * 流结束后回调 `onDone(全文)`，用来把结果落库。
 */
export function streamAndCollect(
  source: AsyncIterable<string>,
  onDone: (text: string) => Promise<void>,
  mode: "live" | "demo",
): Response {
  let acc = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of source) {
          if (!chunk) continue;
          acc += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        await onDone(acc);
      } catch (err) {
        // 已经吐出去的内容收不回来，只能把错误抛给客户端
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Talkbase-Mode": mode,
    },
  });
}

/** 演示模式：把一段固定文本伪装成流，让前端体验一致。 */
export async function* charChunks(text: string, delayMs = 14): AsyncIterable<string> {
  const chars = Array.from(text);
  let i = 0;
  while (i < chars.length) {
    const size = 3 + Math.floor(Math.random() * 5);
    yield chars.slice(i, i + size).join("");
    i += size;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
}
