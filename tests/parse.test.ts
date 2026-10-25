import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTranscript, pickTitle, transcriptToText } from "../src/lib/parse";

test("解析 mm:ss 前缀", () => {
  const segs = parseTranscript("00:00 开场\n01:02 第二句");
  assert.deepEqual(segs, [
    { t: 0, text: "开场" },
    { t: 62, text: "第二句" },
  ]);
});

test("解析 hh:mm:ss 前缀", () => {
  const segs = parseTranscript("01:02:07 一小时以后的句子");
  assert.equal(segs.length, 1);
  assert.equal(segs[0].t, 3727);
});

test("没有时间戳时按 5 秒铺开", () => {
  const segs = parseTranscript("第一句\n第二句\n第三句");
  assert.deepEqual(
    segs.map((s) => s.t),
    [0, 5, 10],
  );
});

test("忽略空行与前后空白", () => {
  const segs = parseTranscript("  00:03  有空白的句子 \n\n\n");
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "有空白的句子");
});

test("标题取第一句并去掉时间戳", () => {
  assert.equal(pickTitle("00:12 3.1 版本评审会\n00:20 第二句"), "3.1 版本评审会");
  assert.equal(pickTitle("   "), "未命名会议");
});

test("transcriptToText 能拼回可读文本", () => {
  const text = transcriptToText([
    { i: 0, t: 0, text: "开场" },
    { i: 1, t: 62, text: "第二句" },
  ]);
  assert.equal(text, "[00:00] 开场\n[01:02] 第二句");
});
