import { NextResponse, type NextRequest } from "next/server";
import { createSession, listSessions } from "@/lib/store";
import { parseTranscript, pickTitle } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sessions: await listSessions() });
}

export async function POST(req: NextRequest) {
  let body: { title?: string; transcript?: string; durationSec?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const raw = (body.transcript ?? "").trim();
  if (raw.length < 10) {
    return NextResponse.json({ error: "转写稿太短了，至少十几行才有意思" }, { status: 400 });
  }

  const segments = parseTranscript(raw);
  if (segments.length === 0) {
    return NextResponse.json({ error: "没有解析出任何语句，检查一下格式" }, { status: 400 });
  }

  const last = segments[segments.length - 1];
  const session = await createSession({
    title: body.title?.trim() || pickTitle(raw),
    durationSec: body.durationSec ?? last.t + 10,
    segments,
    source: "paste",
  });

  return NextResponse.json({ session }, { status: 201 });
}
