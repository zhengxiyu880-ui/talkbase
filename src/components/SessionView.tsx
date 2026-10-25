"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock, readTextStream, shortDate } from "@/lib/client";
import { renderMarkdown } from "@/lib/markdown";
import { retrieve } from "@/lib/retrieval";
import type { ChatMessage, Session } from "@/lib/types";

type Props = { id: string; mode: "live" | "demo" };

const SUGGESTIONS = ["结论是什么？", "谁负责什么？", "有哪些风险和遗留问题？"];

export default function SessionView({ id, mode }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [hits, setHits] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
        if (!res.ok) {
          if (alive) setNotFound(true);
          return;
        }
        const data = (await res.json()) as { session: Session };
        if (!alive) return;
        setSession(data.session);
        setSummary(data.session.summary ?? "");
      } catch {
        if (alive) setError("加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const generateSummary = useCallback(async () => {
    if (summarizing) return;
    setSummarizing(true);
    setSummary("");
    setError("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      if (!res.ok) throw new Error("总结失败");
      await readTextStream(res, (chunk) => setSummary((prev) => prev + chunk));
    } catch {
      setError("生成总结失败，稍后再试");
    } finally {
      setSummarizing(false);
    }
  }, [id, summarizing]);

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || streaming || !session) return;
      setInput("");
      setError("");

      const found = retrieve(question, session.segments, 6);
      setHits(new Set(found.map((h) => h.segment.i)));
      requestAnimationFrame(() => {
        const first = transcriptRef.current?.querySelector(".seg.hit");
        first?.scrollIntoView({ block: "center", behavior: "smooth" });
      });

      const history = messages;
      setMessages([...history, { role: "user", content: question }, { role: "assistant", content: "" }]);
      setStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id, question, history }),
        });
        if (!res.ok) throw new Error("问答失败");
        await readTextStream(res, (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            }
            return next;
          });
        });
      } catch {
        setError("回答失败，检查一下网络或 API Key");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setStreaming(false);
      }
    },
    [id, messages, session, streaming],
  );

  if (loading) {
    return (
      <main className="shell">
        <div className="empty">加载中…</div>
      </main>
    );
  }

  if (notFound || !session) {
    return (
      <main className="shell">
        <div className="empty">
          找不到这场会议。
          <br />
          <a href="/" style={{ color: "var(--accent)" }}>
            返回首页
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">t</span>
          talkbase
        </a>
        <span className={`badge ${mode}`}>
          <span className="dot" />
          {mode === "live" ? "已接入大模型" : "演示模式 · 未配 API Key"}
        </span>
      </header>

      <div className="detail-head">
        <a href="/" className="faint" style={{ fontSize: 13 }}>
          ← 全部会议
        </a>
        <h1>{session.title}</h1>
        <div className="meta mono faint" style={{ fontSize: 12.5, display: "flex", gap: 14 }}>
          <span>{shortDate(session.createdAt)}</span>
          <span>{formatClock(session.durationSec)}</span>
          <span>{session.segments.length} 段</span>
          <span>{session.source === "demo" ? "示例数据" : "手动导入"}</span>
        </div>
      </div>

      <div className="detail-grid">
        {/* 左：转写稿 */}
        <section className="card">
          <div className="panel-head">
            <h2>转写稿</h2>
            <span className="faint" style={{ fontSize: 12 }}>
              {hits.size > 0 ? `已高亮 ${hits.size} 段相关原文` : "提问后会高亮相关段落"}
            </span>
          </div>
          <div className="panel-body" style={{ paddingTop: 6 }}>
            <div className="transcript" ref={transcriptRef}>
              {session.segments.map((seg) => (
                <div key={seg.i} className={`seg ${hits.has(seg.i) ? "hit" : ""}`}>
                  <span className="t mono">{formatClock(seg.t)}</span>
                  <span className="x">{seg.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 右：总结 + 问答 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="panel-head">
              <h2>
                会议总结
                {summarizing ? <span className="caret" /> : null}
              </h2>
              <button className="btn small" onClick={generateSummary} disabled={summarizing}>
                {summarizing ? "生成中…" : summary ? "重新生成" : "生成总结"}
              </button>
            </div>
            <div className="panel-body" style={{ minHeight: 120 }}>
              {summary ? (
                <div
                  className="prose"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
                />
              ) : (
                <div className="empty">
                  还没有总结。点右上角「生成总结」，
                  <br />
                  会按 结论 / 决定 / 待办 / 风险 四块整理。
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="panel-head">
              <h2>对着它提问</h2>
              <span className="faint" style={{ fontSize: 12 }}>
                回答基于检索到的原文片段
              </span>
            </div>

            <div className="chat">
              <div className="chat-body" ref={chatBodyRef}>
                {messages.length === 0 ? (
                  <div className="empty">
                    试试问「压测谁负责」「作业是哪几题」，
                    <br />
                    回答里会带 [mm:ss] 时间戳。
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`msg ${m.role}`}>
                      {m.role === "assistant" ? <span className="who">ASSISTANT</span> : null}
                      {m.content}
                      {m.role === "assistant" && streaming && i === messages.length - 1 ? (
                        <span className="caret" />
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="suggest">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="btn ghost small"
                    disabled={streaming}
                    onClick={() => void ask(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="chat-input">
                <input
                  className="field"
                  placeholder="问点什么…"
                  value={input}
                  disabled={streaming}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) void ask(input);
                  }}
                />
                <button className="btn primary" disabled={streaming || !input.trim()} onClick={() => void ask(input)}>
                  {streaming ? "…" : "提问"}
                </button>
              </div>
            </div>
          </section>

          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    </main>
  );
}
