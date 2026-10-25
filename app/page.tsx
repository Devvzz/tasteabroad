import { Suspense } from "react";
import { TasteApp } from "@/components/TasteApp";

export default function Home() {
  return (
    <main className="flex-1">
      <Suspense>
        <TasteApp />
      </Suspense>
    </main>
  );
}
