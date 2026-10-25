"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_SESSIONS, TRANSCRIPT_HINT } from "@/lib/demo-data";
import { transcriptToText } from "@/lib/parse";
import { formatClock, shortDate } from "@/lib/client";
import type { SessionMeta } from "@/lib/types";

export default function HomeView({ mode }: { mode: "live" | "demo" }) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      const data = (await res.json()) as { sessions: SessionMeta[] };
      setSessions(data.sessions ?? []);
    } catch {
      setError("加载会议列表失败，刷新一下试试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fillDemo = (index: number) => {
    const demo = DEMO_SESSIONS[index];
    if (!demo) return;
    setTitle(demo.title);
    setRaw(transcriptToText(demo.segments));
    setError("");
    areaRef.current?.focus();
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, transcript: raw }),
      });
      const data = (await res.json()) as { session?: { id: string }; error?: string };
      if (!res.ok || !data.session) {
        setError(data.error ?? "导入失败");
        return;
      }
      window.location.href = `/s/${data.session.id}`;
    } catch {
      setError("网络请求失败");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("删除这场会议？不可撤销。")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">t</span>
          talkbase
        </div>
        <span className={`badge ${mode}`}>
          <span className="dot" />
          {mode === "live" ? "已接入大模型" : "演示模式 · 未配 API Key"}
        </span>
      </header>

      <section className="hero">
        <h1>
          把一场谈话，变成<em>可以提问</em>的记忆。
        </h1>
        <p>
          导入会议录音或课堂的转写稿，自动生成结构化总结；之后直接问它「压测谁负责」「作业是哪几题」，
          回答会带上原文的时间戳。整个数据落在本地一个 JSON 文件里。
        </p>

        <div className="steps">
          <div className="step">
            <span className="n">01</span>
            <b>导入转写稿</b>
            <span>带时间戳的文本，直接粘贴</span>
          </div>
          <div className="step">
            <span className="n">02</span>
            <b>生成总结</b>
            <span>结论 / 决定 / 待办 / 风险</span>
          </div>
          <div className="step">
            <span className="n">03</span>
            <b>对着它提问</b>
            <span>带 [mm:ss] 引用的回答</span>
          </div>
        </div>
      </section>

      <div className="section-head">
        <h2>导入转写稿</h2>
        <span className="faint" style={{ fontSize: 12.5 }}>
          {mode === "live"
            ? "总结与问答会调用你配置的模型"
            : "没配 Key 也能跑：总结与回答走本地规则，界面上会标注"}
        </span>
      </div>

      <div className="import-grid">
        <div className="card">
          <div className="panel-body" style={{ paddingBottom: 10 }}>
            <input
              className="field"
              placeholder="会议标题（留空会自动取第一句）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div style={{ height: 10 }} />
            <textarea
              ref={areaRef}
              className="field mono"
              placeholder={TRANSCRIPT_HINT}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div
            className="panel-head"
            style={{ borderTop: "1px solid var(--border-soft)", borderBottom: "none" }}
          >
            <span className="hint">
              支持 <code>mm:ss</code> / <code>hh:mm:ss</code> 前缀；没有时间戳就按每行 5 秒铺开
            </span>
            <button className="btn primary" onClick={submit} disabled={busy || raw.trim().length < 10}>
              {busy ? "导入中…" : "导入并打开"}
            </button>
          </div>
        </div>

        <div className="import-side">
          <div className="card panel-body">
            <b style={{ fontSize: 13.5 }}>没有现成的稿子？</b>
            <p className="hint" style={{ margin: "6px 0 10px" }}>
              用示例数据走一遍完整流程，不用录音、不用 Key。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn ghost small" onClick={() => fillDemo(0)}>
                ▸ 填一份产品评审会
              </button>
              <button className="btn ghost small" onClick={() => fillDemo(1)}>
                ▸ 填一节高数课
              </button>
            </div>
          </div>

          <div className="card panel-body">
            <b style={{ fontSize: 13.5 }}>转写稿从哪来</b>
            <p className="hint" style={{ margin: "6px 0 0" }}>
              macOS 上可以用作者另一个项目
              <a
                href="https://github.com/zhengxiyu880-ui/meeting-note-app"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)" }}
              >
                {" "}
                meeting-note-app{" "}
              </a>
              边录边离线转写，导出的 <code>transcript.md</code> 直接粘进来。
            </p>
          </div>

          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>

      <div className="section-head">
        <h2>会议库</h2>
        <span className="faint" style={{ fontSize: 12.5 }}>
          {loading ? "加载中…" : `${sessions.length} 场`}
        </span>
      </div>

      {sessions.length === 0 && !loading ? (
        <div className="card empty">还没有任何会议，导入一份试试。</div>
      ) : (
        <div className="session-list">
          {sessions.map((s) => (
            <div key={s.id} className="card session-card" style={{ cursor: "pointer" }}>
              <a href={`/s/${s.id}`}>
                <h3>{s.title}</h3>
                <div className="meta">
                  <span className="mono">{shortDate(s.createdAt)}</span>
                  <span className="mono">{formatClock(s.durationSec)}</span>
                  <span>{s.segmentCount} 段</span>
                  {s.hasSummary ? <span className="tag">已总结</span> : null}
                  {s.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </a>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn ghost small"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(s.id);
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
