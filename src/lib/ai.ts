import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

/**
 * 模型接入层：任何 OpenAI 兼容服务都能用（DeepSeek / 通义 / Kimi / 智谱 / OpenRouter…），
 * 只改 `OPENAI_BASE_URL` 和 `OPENAI_MODEL` 两个环境变量。
 *
 * 没配 Key 时进入「演示模式」：不联网，用本地规则给出摘要与回答，
 * 保证这个项目在任何机器上 clone 下来就能跑。
 */

export function hasLLM(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const provider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing",
  baseURL: process.env.OPENAI_BASE_URL,
});

export function modelId(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

/** 把一段已有文本按块吐出去，用于演示模式的流式效果。 */
export function streamPlainText(text: string, delayMs = 16): Response {
  const chars = Array.from(text);
  const encoder = new TextEncoder();
  let cursor = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cursor >= chars.length) {
        controller.close();
        return;
      }
      const size = 3 + Math.floor(Math.random() * 5);
      controller.enqueue(encoder.encode(chars.slice(cursor, cursor + size).join("")));
      cursor += size;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Talkbase-Mode": "demo",
    },
  });
}

/** 调真实模型并流式返回纯文本。 */
export function streamModelResponse(
  messages: ModelMessage[],
  system: string,
): Response {
  const result = streamText({
    model: provider(modelId()),
    system,
    messages,
    temperature: 0.3,
  });
  const response = result.toTextStreamResponse();
  response.headers.set("X-Talkbase-Mode", "live");
  return response;
}

export const SYSTEM_CHAT = `你是一个会议记录助手。用户会就一场会议/一节课的转写稿提问。
规则：
1. 只依据给定的转写片段回答，不要编造转写里没有的内容。
2. 回答里用 [mm:ss] 标注依据的时间戳。
3. 如果片段里找不到答案，直接说「转写里没有提到」，并建议用户换个问法。
4. 用中文回答，简洁，先给结论再给依据。`;

export const SYSTEM_SUMMARY = `你是一个会议记录助手。请把给定的转写稿整理成结构化总结。
输出 Markdown，严格用下面四个二级标题，没有内容的标题写「无」：
## 一句话结论
## 关键决定
## 待办事项（每条带负责人和截止时间，没有就写「未指定」）
## 风险与遗留问题
不要输出标题以外的开场白或总结语。`;

export function buildSummaryPrompt(title: string, transcript: string): string {
  return `会议标题：${title}\n\n转写稿：\n${transcript}`;
}

export function buildChatMessages(
  question: string,
  context: string,
  history: { role: "user" | "assistant"; content: string }[],
): ModelMessage[] {
  const messages: ModelMessage[] = history.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messages.push({
    role: "user",
    content: `转写片段：\n${context || "（没有检索到相关片段）"}\n\n问题：${question}`,
  });
  return messages;
}

/** 供需要直接拿模型实例的地方（如 summarize 路由里手动拼流）使用。 */
export function languageModel() {
  return provider(modelId());
}
