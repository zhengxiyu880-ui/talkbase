import HomeView from "@/components/HomeView";
import { hasLLM } from "@/lib/ai";

export default function Page() {
  return <HomeView mode={hasLLM() ? "live" : "demo"} />;
}
