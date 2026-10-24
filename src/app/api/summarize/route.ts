import { streamText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import {
  SYSTEM_SUMMARY,
  buildSummaryPrompt,
  hasLLM,
  languageModel,
} from "@/lib/ai";
import { getSession, saveSummary } from "@/lib/store";
import { offlineSummary } from "@/lib/offline";
import { transcriptToText } from "@/lib/parse";
import { charChunks, streamAndCollect } from "@/lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  if (!body?.sessionId) {
    return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) return NextResponse.json({ error: "找不到这场会议" }, { status: 404 });

  if (!hasLLM()) {
    const text = offlineSummary(session);
    return streamAndCollect(
      charChunks(text),
      async (full) => {
        await saveSummary(session.id, full);
      },
      "demo",
    );
  }

  // 转写太长会吃掉上下文，先截断到约 12000 字（约 1 小时的会议）
  const transcript = transcriptToText(session.segments).slice(0, 12000);
  const result = streamText({
    model: languageModel(),
    system: SYSTEM_SUMMARY,
    prompt: buildSummaryPrompt(session.title, transcript),
    temperature: 0.2,
  });

  return streamAndCollect(
    result.textStream,
    async (full) => {
      await saveSummary(session.id, full);
    },
    "live",
  );
}
