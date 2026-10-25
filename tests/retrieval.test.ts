import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContext, formatTimestamp, retrieve, tokenize } from "../src/lib/retrieval";
import { DEMO_SESSIONS } from "../src/lib/demo-data";
import { offlineAnswer, offlineSummary } from "../src/lib/offline";

const review = DEMO_SESSIONS[0];

test("分词保留中文二元组，过滤停用词", () => {
  const tokens = tokenize("压测由谁负责");
  assert.ok(tokens.includes("压测"));
  assert.ok(tokens.includes("负责"));
  assert.ok(!tokens.includes("由"));
});

test("检索能找到「压测负责人」那一段", () => {
  const hits = retrieve("压测谁负责？", review.segments, 3);
  assert.ok(hits.length > 0, "应该至少命中一段");
  assert.match(hits[0].segment.text, /压测/);
  assert.match(hits[0].segment.text, /负责/);
});

test("检索能找到上线时间", () => {
  const hits = retrieve("灰度什么时候放量？", review.segments, 3);
  assert.ok(hits.length > 0);
  assert.ok(hits.some((h) => /11 月/.test(h.segment.text)));
});

test("完全不相关的问题不返回结果", () => {
  const hits = retrieve("量子纠缠的退相干时间", review.segments, 3);
  assert.equal(hits.length, 0);
});

test("时间戳格式固定为 mm:ss", () => {
  assert.equal(formatTimestamp(0), "00:00");
  assert.equal(formatTimestamp(62), "01:02");
  assert.equal(formatTimestamp(3727), "62:07");
});

test("上下文按时间戳标注", () => {
  const context = buildContext(retrieve("压测", review.segments, 1));
  assert.match(context, /^\[\d{2}:\d{2}\] /);
});

test("演示模式总结包含四个小节", () => {
  const summary = offlineSummary(review);
  for (const heading of ["一句话结论", "关键决定", "待办事项", "风险与遗留问题"]) {
    assert.ok(summary.includes(`## ${heading}`), `缺少小节：${heading}`);
  }
  assert.ok(summary.includes("演示模式"));
});

test("演示模式回答带时间戳引用", () => {
  const hits = retrieve("压测谁负责", review.segments, 3);
  const answer = offlineAnswer("压测谁负责", hits, review);
  assert.match(answer, /\[\d{2}:\d{2}\]/);
  assert.ok(answer.includes(review.title));
});

test("检索不到时回答「没有提到」", () => {
  const answer = offlineAnswer("量子纠缠", [], review);
  assert.ok(answer.includes("没有提到"));
});
