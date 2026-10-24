import { NextResponse, type NextRequest } from "next/server";
import {
  SYSTEM_CHAT,
  buildChatMessages,
  hasLLM,
  streamModelResponse,
} from "@/lib/ai";
import { getSession } from "@/lib/store";
import { buildContext, retrieve } from "@/lib/retrieval";
import { offlineAnswer } from "@/lib/offline";
import { charChunks, streamAndCollect } from "@/lib/stream";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    sessionId?: string;
    question?: string;
    history?: ChatMessage[];
  } | null;

  if (!body?.sessionId || !body.question?.trim()) {
    return NextResponse.json({ error: "缺少 sessionId 或 question" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) return NextResponse.json({ error: "找不到这场会议" }, { status: 404 });

  const question = body.question.trim();
  const history = (body.history ?? []).filter((m) => m.role === "user" || m.role === "assistant");
  const hits = retrieve(question, session.segments, 6);

  if (!hasLLM()) {
    return streamAndCollect(
      charChunks(offlineAnswer(question, hits, session)),
      async () => {},
      "demo",
    );
  }

  return streamModelResponse(
    buildChatMessages(question, buildContext(hits), history),
    SYSTEM_CHAT,
  );
}
