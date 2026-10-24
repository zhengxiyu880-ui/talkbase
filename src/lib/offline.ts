import type { Retrieved, Session } from "./types";
import { formatTimestamp } from "./retrieval";

/**
 * 演示模式的兜底逻辑：不调用任何大模型，用本地规则产出「还算像样」的结果。
 *
 * 目的只有一个 —— 让 clone 下来、还没配 Key 的人也能看到完整的产品流程。
 * 界面上会明确标注这是规则抽取的结果，不会假装成模型输出。
 */

const DECISION = /决定|敲定|定了|结论|砍掉|确认|就这么|同意|通过/;
const TODO = /负责|你来|之前|截止|下周|明天|提交|交给|跟进|出报告/;
const RISK = /风险|问题|不够|焦虑|担心|限流|回滚|如果|万一|来不及|延期|压力/;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[。！？；!?;])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collect(segments: Session["segments"], pattern: RegExp, limit: number): string[] {
  const hits: string[] = [];
  for (const seg of segments) {
    for (const s of sentences(seg.text)) {
      if (pattern.test(s)) {
        hits.push(`- ${s}（[${formatTimestamp(seg.t)}]）`);
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

export function offlineSummary(session: Session): string {
  const head = session.segments[0]?.text ?? session.title;
  const decisions = collect(session.segments, DECISION, 4);
  const todos = collect(session.segments, TODO, 6);
  const risks = collect(session.segments, RISK, 4);
  const block = (title: string, items: string[]) =>
    `## ${title}\n${items.length ? items.join("\n") : "无"}\n`;

  return [
    `> 演示模式：以下内容由本地规则抽取，没有调用大模型。配置 \`OPENAI_API_KEY\` 后重新生成即是真正的 AI 总结。`,
    "",
    block("一句话结论", [`- ${head}`]),
    block("关键决定", decisions),
    block("待办事项", todos),
    block("风险与遗留问题", risks),
  ].join("\n");
}

export function offlineAnswer(question: string, hits: Retrieved[], session: Session): string {
  if (hits.length === 0) {
    return `转写里没有提到和「${question}」相关的内容。\n\n换个问法试试，比如直接问某个人的任务或者某个时间点的安排。`;
  }
  const lines = hits.map(
    ({ segment }) => `- [${formatTimestamp(segment.t)}] ${segment.text}`,
  );
  return [
    `> 演示模式：没配 \`OPENAI_API_KEY\`，这里直接返回检索到的最相关片段（不是模型生成）。`,
    "",
    `和「${question}」最相关的是这几处：`,
    "",
    ...lines,
    "",
    `以上片段来自《${session.title}》。`,
  ].join("\n");
}
