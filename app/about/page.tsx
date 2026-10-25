import type { Metadata } from "next";
import { AboutContent } from "@/components/AboutContent";
import { cities } from "@/lib/cities";

export const metadata: Metadata = {
  title: "How it works · TasteAbroad",
  description: "How TasteAbroad uses an AI agent and Qloo's taste graph to match students with university cities.",
};

export default function AboutPage() {
  return (
    <main className="flex-1">
      <AboutContent cityCount={cities.length} />
    </main>
  );
}
