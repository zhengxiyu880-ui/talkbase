import SessionView from "@/components/SessionView";
import { hasLLM } from "@/lib/ai";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionView id={id} mode={hasLLM() ? "live" : "demo"} />;
}
