"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Region } from "@/lib/cities";
import type { AgentEvent, ErrorCode, MatchFilters, MatchResult, StepKey } from "@/lib/agent/types";
import { t } from "@/lib/i18n";
import { MAX_LIKES } from "@/lib/agent/request";
import { fromSearchParams, toSearchParams, type SearchState } from "@/lib/share";
import { AgentLog } from "./AgentLog";
import { AgentSteps, type StepStatus } from "./AgentSteps";
import { AlsoLiked } from "./AlsoLiked";
import { CityBrief } from "./CityBrief";
import { CityCard } from "./CityCard";
import { CityChecker } from "./CityChecker";
import { ComparePanel } from "./ComparePanel";
import { IdeaChips } from "./IdeaChips";
import { LikeInput } from "./LikeInput";
import { ThemeToggle } from "./ThemeToggle";

const REGIONS: Region[] = ["Europe", "North America", "Asia", "Oceania", "Latin America", "Middle East", "Africa"];
// Names match the `languages` values in data/cities.json. English gets its own switch;
// the others sit behind "I also speak..." because most students only need English.
const ENGLISH = "English";
const OTHER_STUDY_LANGUAGES = ["Spanish", "German", "French", "Italian", "Portuguese", "Dutch", "Japanese", "Korean", "Mandarin", "Arabic", "Albanian"];

export function TasteApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = useMemo(() => fromSearchParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [likes, setLikes] = useState<string[]>(initial.likes);
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<MatchFilters>(initial.filters);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Partial<Record<StepKey, StepStatus>>>({});
  const [details, setDetails] = useState<Partial<Record<StepKey, string>>>({});
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<ErrorCode | "needLikes" | null>(null);
  const [copied, setCopied] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const autoRan = useRef(false);
  const outputRef = useRef<HTMLDivElement>(null);
  // Open the other languages straight away when a shared link already uses one of them.
  const [showOtherLanguages, setShowOtherLanguages] = useState(
    () => initial.filters.languages?.some((l) => l !== ENGLISH) ?? false,
  );

  const addLike = (value: string) => {
    const like = value.trim();
    if (!like || likes.length >= MAX_LIKES || likes.some((l) => l.toLowerCase() === like.toLowerCase())) return;
    setLikes([...likes, like]);
    setDraft("");
    setError(null);
  };

  const onEvent = (event: AgentEvent) => {
    if (event.type === "step") {
      setSteps((s) => ({ ...s, [event.step]: event.status }));
      if (event.detail) setDetails((d) => ({ ...d, [event.step]: event.detail }));
    } else if (event.type === "result") {
      setResult(event.result);
    } else if (event.type === "error") {
      setError(event.code);
    }
  };

  const run = useCallback(
    async (state: SearchState) => {
      if (!state.likes.length) {
        setError("needLikes");
        return;
      }
      setRunning(true);
      setSteps({});
      setDetails({});
      setResult(null);
      setError(null);
      setCompareIds([]);
      setShowCompare(false);
      router.replace(`${pathname}?${toSearchParams(state).toString()}`, { scroll: false });
      // On phones the progress appears below the form, so bring it into view.
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { code?: ErrorCode } | null;
          setError(body?.code ?? "generic");
          return;
        }
        // The route streams one JSON event per line.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.filter(Boolean).forEach((line) => onEvent(JSON.parse(line) as AgentEvent));
        }
      } catch {
        setError("generic");
      } finally {
        setRunning(false);
      }
    },
    [pathname, router],
  );

  // A shared link with likes in it runs the search straight away.
  useEffect(() => {
    if (autoRan.current || !initial.likes.length) return;
    autoRan.current = true;
    void run(initial);
  }, [initial, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const all = draft.trim() ? [...likes, draft.trim()].slice(0, MAX_LIKES) : likes;
    if (draft.trim()) {
      setLikes(all);
      setDraft("");
    }
    void run({ likes: all, filters });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRegion = (region: Region) => {
    const current = filters.regions ?? [];
    setFilters({ ...filters, regions: current.includes(region) ? current.filter((r) => r !== region) : [...current, region] });
  };

  const toggleLanguage = (language: string) => {
    const current = filters.languages ?? [];
    setFilters({
      ...filters,
      languages: current.includes(language) ? current.filter((l) => l !== language) : [...current, language],
    });
  };

  const toggleCompare = (cityId: string) =>
    setCompareIds((ids) => (ids.includes(cityId) ? ids.filter((id) => id !== cityId) : [...ids, cityId].slice(-2)));

  // Memoised so the compare panel only fetches place picks once per pair.
  const comparePair = useMemo(() => {
    const picked = compareIds.map((id) => result?.cities.find((c) => c.city.id === id)).filter((c) => c !== undefined);
    return picked.length === 2 ? ([picked[0], picked[1]] as const) : null;
  }, [compareIds, result]);

  const showSteps = running || (Object.keys(steps).length > 0 && !result);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6">
      <nav className="mb-8 flex items-center justify-between gap-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Taste<span className="text-accent">Abroad</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/about" className="text-sm text-muted underline-offset-2 hover:underline">
            {t("app.about")}
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("app.tagline")}</h1>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="like-input" className="font-semibold">
              {t("form.label")}
            </label>
            <span
              aria-live="polite"
              className={`text-xs tabular-nums ${likes.length >= MAX_LIKES ? "font-semibold text-accent" : "text-muted"}`}
            >
              {t("form.count", { count: likes.length, max: MAX_LIKES })}
            </span>
          </div>
          <p className="text-sm text-muted">{likes.length >= MAX_LIKES ? t("form.full") : t("form.hint")}</p>
        </div>

        {likes.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {likes.map((like) => (
              <li key={like} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm text-white">
                {like}
                <button
                  type="button"
                  aria-label={t("form.remove", { item: like })}
                  onClick={() => setLikes(likes.filter((l) => l !== like))}
                  className="ml-1 opacity-80 hover:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <LikeInput value={draft} onChange={setDraft} onAdd={addLike} t={t} />

        <IdeaChips likes={likes} onAdd={addLike} t={t} />

        <fieldset className="space-y-2 text-sm">
          <legend className="sr-only">{t("form.language")}</legend>
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
              filters.languages?.includes(ENGLISH) ? "border-accent bg-accent-soft" : "border-line"
            }`}
          >
            <input
              type="checkbox"
              checked={filters.languages?.includes(ENGLISH) ?? false}
              onChange={() => toggleLanguage(ENGLISH)}
              className="size-5 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-semibold">{t("form.studyEnglish")}</span>
              <span className="text-muted">{t("form.studyEnglishHint")}</span>
            </span>
          </label>

          {!showOtherLanguages ? (
            <button type="button" onClick={() => setShowOtherLanguages(true)} className="text-accent underline-offset-2 hover:underline">
              {t("form.alsoSpeak")}
            </button>
          ) : (
            <div>
              <p className="mb-2 text-muted">{t("form.alsoSpeakHint")}</p>
              <div className="flex flex-wrap gap-2">
                {OTHER_STUDY_LANGUAGES.map((l) => {
                  const on = filters.languages?.includes(l) ?? false;
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLanguage(l)}
                      className={`rounded-full border px-3 py-1 ${on ? "border-accent bg-accent-soft text-accent" : "border-line"}`}
                    >
                      {on ? "✓ " : ""}
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </fieldset>

        <details className="rounded-xl border border-line p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("form.filters")}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-muted">{t("form.maxTuition")}</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={filters.maxTuitionUsd ?? ""}
                onChange={(e) => setFilters({ ...filters, maxTuitionUsd: e.target.value ? Number(e.target.value) : undefined })}
                className="rounded-lg border border-line bg-background px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted">{t("form.maxMonthly")}</span>
              <input
                type="number"
                min={0}
                step={100}
                value={filters.maxMonthlyUsd ?? ""}
                onChange={(e) => setFilters({ ...filters, maxMonthlyUsd: e.target.value ? Number(e.target.value) : undefined })}
                className="rounded-lg border border-line bg-background px-2 py-1.5"
              />
            </label>
          </div>
          <fieldset className="mt-3">
            <legend className="mb-1 text-muted">{t("form.regions")}</legend>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => {
                const on = filters.regions?.includes(r) ?? false;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleRegion(r)}
                    className={`rounded-full border px-3 py-1 ${on ? "border-accent bg-accent-soft text-accent" : "border-line"}`}
                  >
                    {t(`regions.${r}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </details>

        <button
          type="submit"
          disabled={running}
          className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {running ? t("form.running") : t("form.submit")}
        </button>
      </form>

      <div ref={outputRef} className="mt-6 scroll-mt-4 space-y-6">
        {error && (
          <p role="alert" className="rounded-xl bg-warn-soft p-3 text-sm">
            {error === "needLikes" ? t("form.needLikes") : t(`errors.${error}`)}
          </p>
        )}

        {showSteps && <AgentSteps steps={steps} details={details} t={t} />}

        {result && (
          <Results
            key={result.likes.join("|")}
            result={result}
            t={t}
            onCopy={copyLink}
            copied={copied}
            compareIds={compareIds}
            onCompareToggle={toggleCompare}
          />
        )}
      </div>

      {result && compareIds.length > 0 && !showCompare && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            {comparePair ? (
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                className="flex-1 rounded-xl bg-accent px-4 py-3 font-semibold text-white"
              >
                {t("compare.open", { a: comparePair[0].city.name, b: comparePair[1].city.name })}
              </button>
            ) : (
              <p className="flex-1 text-sm text-muted">{t("compare.pickOne")}</p>
            )}
            <button type="button" onClick={() => setCompareIds([])} className="rounded-xl border border-line px-3 py-3 text-sm">
              {t("compare.clear")}
            </button>
          </div>
        </div>
      )}

      {showCompare && comparePair && result && (
        <ComparePanel
          cities={comparePair}
          signals={result.resolved}
          t={t}
          onClose={() => setShowCompare(false)}
        />
      )}

      <footer className="mt-12 flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
        <span>{t("footer.poweredBy")}</span>
        <Link href="/about" className="underline-offset-2 hover:underline">
          {t("app.about")}
        </Link>
      </footer>
    </div>
  );
}

interface ResultsProps {
  result: MatchResult;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onCopy: () => void;
  copied: boolean;
  compareIds: string[];
  onCompareToggle: (cityId: string) => void;
}

function Results({ result, t, onCopy, copied, compareIds, onCompareToggle }: ResultsProps) {
  const [checkId, setCheckId] = useState<string>();
  // Older cached results have no full ranking; those simply skip the extras.
  const ranking = result.ranking ?? [];
  const shownIds = result.cities.map((c) => c.city.id);
  const bestValue = ranking.find((r) => r.id === result.bestValueId);
  const bestValueShown = bestValue && shownIds.includes(bestValue.id);

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">{t("results.title")}</h2>
          <button type="button" onClick={onCopy} className="rounded-lg border border-line px-3 py-1.5 text-sm">
            {copied ? t("results.copied") : t("results.share")}
          </button>
        </div>

        <p className="rounded-xl border border-accent/40 bg-accent-soft p-3 text-sm">
          {t("results.scoreNote")}
        </p>

        <p className="text-sm text-muted">
          {t("results.qlooMatched")}:{" "}
          {result.resolved
            .filter((r) => r.scored !== false)
            .map((r) => {
              const name = r.name.toLowerCase() === r.input.toLowerCase() ? r.name : `${r.input} → ${r.name}`;
              // Tags are scored through related names; showing them makes the match traceable.
              return r.via?.length ? `${name} (${t("results.via", { names: r.via.slice(0, 3).join(", ") })})` : name;
            })
            .join(" · ")}
        </p>

        {result.notes.map((note) => (
          <p key={note} className="rounded-xl bg-warn-soft p-3 text-sm">
            {t(`notes.${note}`, { items: (note === "unscored" ? result.unscored : result.unresolved).join(", ") })}
          </p>
        ))}
      </section>

      <div className="space-y-5">
        {result.cities.map((match, i) => (
          <CityCard
            key={match.city.id}
            match={match}
            rank={i + 1}
            t={t}
            studyLanguages={result.filters.languages ?? []}
            comparing={compareIds.includes(match.city.id)}
            compareDisabled={compareIds.length >= 2 && !compareIds.includes(match.city.id)}
            onCompareToggle={() => onCompareToggle(match.city.id)}
            bestValue={match.city.id === result.bestValueId}
          />
        ))}
      </div>

      {bestValue && !bestValueShown && (
        <section className="space-y-3 rounded-2xl border-2 border-accent bg-card p-4 shadow-sm">
          <div>
            <h2 className="font-semibold">💸 {t("results.bestValueTitle")}</h2>
            <p className="text-sm text-muted">{t("results.bestValueHint")}</p>
          </div>
          <CityBrief entry={bestValue} of={ranking.length} t={t} />
        </section>
      )}

      {ranking.length > 0 && (
        <CityChecker
          ranking={ranking}
          shownIds={shownIds}
          selectedId={checkId}
          onSelect={setCheckId}
          t={t}
        />
      )}

      {result.worldwide.length > 0 && (
        <p className="text-sm text-muted">
          {t("results.worldwide")}: {result.worldwide.map((w) => (w.countryCode ? `${w.name} (${w.countryCode})` : w.name)).join(", ")}
        </p>
      )}

      <AlsoLiked items={result.alsoLiked} t={t} />

      <AgentLog trace={result.trace} t={t} />
    </>
  );
}
