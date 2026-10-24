import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Session, SessionMeta } from "./types";
import { DEMO_SESSIONS } from "./demo-data";

/**
 * 极简 JSON 持久化：零外部依赖，备份 = 复制一个文件。
 *
 * 生产部署要换成 Postgres / Supabase 时，只需要替换下面这 5 个导出函数，
 * 其余业务代码（API 路由、检索、UI）都不用动。表结构见 `supabase/schema.sql`。
 */

type DB = { version: number; sessions: Session[] };

const DB_FILE =
  process.env.TALKBASE_DB ?? path.join(process.cwd(), "data", "db.json");

/** 串行化写操作，避免并发请求互相覆盖 */
let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function writeAtomically(db: DB): Promise<void> {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(/* turbopackIgnore: true */ tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

async function read(): Promise<DB> {
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ DB_FILE, "utf8");
    const db = JSON.parse(raw) as DB;
    if (!Array.isArray(db.sessions)) throw new Error("bad db shape");
    return db;
  } catch {
    // 首次启动：写入两场演示数据，保证 clone 下来立刻有东西可看
    const db: DB = { version: 1, sessions: DEMO_SESSIONS };
    await writeAtomically(db);
    return db;
  }
}

export async function listSessions(): Promise<SessionMeta[]> {
  const db = await read();
  return db.sessions
    .map(({ segments, summary, ...rest }) => ({
      ...rest,
      segmentCount: segments.length,
      hasSummary: Boolean(summary),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await read();
  return db.sessions.find((s) => s.id === id) ?? null;
}

export async function createSession(input: {
  title: string;
  durationSec: number;
  segments: { t: number; text: string }[];
  source?: Session["source"];
}): Promise<Session> {
  return withLock(async () => {
    const db = await read();
    const session: Session = {
      id: randomUUID().slice(0, 8),
      title: input.title.trim() || "未命名会议",
      createdAt: new Date().toISOString(),
      durationSec: Math.max(0, Math.round(input.durationSec)),
      source: input.source ?? "paste",
      segments: input.segments.map((s, i) => ({ i, t: Math.max(0, Math.round(s.t)), text: s.text.trim() })),
      tags: [],
    };
    db.sessions.push(session);
    await writeAtomically(db);
    return session;
  });
}

export async function saveSummary(id: string, summary: string): Promise<string> {
  return withLock(async () => {
    const db = await read();
    const session = db.sessions.find((s) => s.id === id);
    if (!session) throw new Error("session not found");
    session.summary = summary;
    await writeAtomically(db);
    return summary;
  });
}

export async function deleteSession(id: string): Promise<boolean> {
  return withLock(async () => {
    const db = await read();
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.id !== id);
    if (db.sessions.length === before) return false;
    await writeAtomically(db);
    return true;
  });
}
