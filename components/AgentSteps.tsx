"use client";

import type { StepKey } from "@/lib/agent/types";

export type StepStatus = "running" | "done" | "error";

const ORDER: StepKey[] = ["plan", "search", "match", "similar", "cities", "explain"];

interface Props {
  steps: Partial<Record<StepKey, StepStatus>>;
  details: Partial<Record<StepKey, string>>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function Icon({ status }: { status?: StepStatus }) {
  if (status === "done") return <span className="text-accent">✓</span>;
  if (status === "error") return <span className="text-amber-600">!</span>;
  if (status === "running") {
    return <span className="inline-block size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />;
  }
  return <span className="inline-block size-2 rounded-full bg-line" />;
}

export function AgentSteps({ steps, details, t }: Props) {
  const keys = steps.fallback ? [...ORDER.slice(0, 1), "fallback" as const, ...ORDER.slice(1)] : ORDER;
  return (
    <section aria-live="polite" className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("steps.title")}</h2>
      <ol className="space-y-2">
        {keys.map((key) => (
          <li key={key} className={`flex items-center gap-3 text-sm ${steps[key] ? "" : "text-muted"}`}>
            <span className="flex w-4 justify-center">
              <Icon status={steps[key]} />
            </span>
            <span>{t(`steps.${key}`)}</span>
            {details[key] && key === "match" && <span className="truncate text-muted">{details[key]}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
