import type { Retrieved, Segment } from "./types";

/**
 * 轻量检索：中文二元组 + 英文单词的词频打分。
 *
 * 为什么不直接上向量：跑 embedding 需要 API Key，而"零 Key 也能演示"是这个项目的底线。
 * 换向量检索只要替换 `retrieve()`（见 README 的路线图），调用方无需改动。
 */

const STOPWORDS = new Set([
  "的", "了", "是", "在", "和", "与", "也", "就", "都", "而", "及", "或",
  "这个", "那个", "我们", "你们", "他们", "什么", "怎么", "如何", "可以",
  "一个", "就是", "因为", "所以", "但是", "然后", "如果", "还有", "没有",
  "the", "a", "an", "is", "are", "to", "of", "and", "or", "in", "on", "for",
]);

export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const latin = lower.match(/[a-z][a-z0-9_-]*/g) ?? [];
  const han = lower.match(/[\u4e00-\u9fff]+/g) ?? [];
  const grams: string[] = [];
  for (const chunk of han) {
    if (chunk.length === 1) {
      grams.push(chunk);
      continue;
    }
    for (let i = 0; i < chunk.length - 1; i++) {
      grams.push(chunk.slice(i, i + 2));
    }
  }
  return [...latin, ...grams].filter((t) => !STOPWORDS.has(t));
}

/** 返回得分最高的若干段，附时间戳，用作回答时的引用来源。 */
export function retrieve(
  question: string,
  segments: Segment[],
  topK = 5,
): Retrieved[] {
  const q = new Set(tokenize(question));
  if (q.size === 0 || segments.length === 0) return [];

  const scored = segments.map((segment) => {
    const terms = tokenize(segment.text);
    if (terms.length === 0) return { segment, score: 0 };
    let hit = 0;
    for (const term of terms) if (q.has(term)) hit += 1;
    // 长段落不该因为字多就占便宜，做长度归一
    const score = hit / Math.sqrt(terms.length);
    return { segment, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 把检索结果拼成给模型的上下文。 */
export function buildContext(hits: Retrieved[]): string {
  return hits
    .map(({ segment }) => `[${formatTimestamp(segment.t)}] ${segment.text}`)
    .join("\n");
}
