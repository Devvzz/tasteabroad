"use client";

import type { TraceEntry } from "@/lib/agent/types";

interface Props {
  trace: TraceEntry[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}

interface Row {
  tool: string;
  calls: number;
  ms: number;
  ok: boolean;
  items: string[];
  count?: number;
}

/** Calls the agent made back to back with the same tool (e.g. five city lookups) read better as one line. */
function groupCalls(trace: TraceEntry[]): Row[] {
  const rows: Row[] = [];
  for (const entry of trace) {
    const last = rows[rows.length - 1];
    if (last && last.tool === entry.tool && entry.tool === "get_city_info") {
      last.calls += 1;
      last.ms = Math.max(last.ms, entry.ms);
      last.ok = last.ok && entry.ok;
      last.items.push(...(entry.info?.items ?? []));
      continue;
    }
    rows.push({
      tool: entry.tool,
      calls: 1,
      ms: entry.ms,
      ok: entry.ok,
      items: [...(entry.info?.items ?? [])],
      count: entry.info?.count,
    });
  }
  return rows;
}

function describe(row: Row, t: Props["t"]): string {
  const items = row.items.join(", ");
  switch (row.tool) {
    case "qloo_search":
      return t("log.search", { count: row.count ?? row.items.length, items });
    case "qloo_destination_affinity":
      return t("log.match", { count: row.count ?? 0 });
    case "qloo_similar":
      return t("log.similar");
    case "get_city_info":
      return t("log.cities", { items });
    default:
      return row.tool;
  }
}

function duration(ms: number, t: Props["t"]): string {
  return ms < 100 ? t("log.instant") : t("log.seconds", { seconds: (ms / 1000).toFixed(1) });
}

/** The agent's tool calls in plain language, collapsed under the results. */
export function AgentLog({ trace, t }: Props) {
  if (!trace.length) return null;
  const rows = groupCalls(trace);
  return (
    <details className="rounded-2xl border border-line bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">{t("log.title", { count: rows.length })}</summary>
      <p className="mt-2 text-muted">{t("log.intro")}</p>
      <ol className="mt-3 space-y-3">
        {rows.map((row, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="leading-snug">
                {describe(row, t)}
                {!row.ok && <span className="text-muted"> {t("log.failed")}</span>}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {row.tool}
                {row.calls > 1 ? ` × ${row.calls}` : ""} · {duration(row.ms, t)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
