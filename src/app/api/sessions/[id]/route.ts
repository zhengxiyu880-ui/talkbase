import { NextResponse, type NextRequest } from "next/server";
import { deleteSession, getSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "找不到这场会议" }, { status: 404 });
  return NextResponse.json({ session });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteSession(id);
  if (!ok) return NextResponse.json({ error: "找不到这场会议" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
