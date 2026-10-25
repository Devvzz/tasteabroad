import Link from "next/link";
import { t } from "@/lib/i18n";

const REPO_URL = "https://github.com/Devvzz/tasteabroad";

// The agent flow, shown as a simple diagram.
const FLOW = [
  { tool: "qloo_search", api: "GET /search · GET /v2/tags" },
  { tool: "qloo_destination_affinity", api: "GET /v2/insights · urn:entity:destination" },
  { tool: "qloo_similar", api: "GET /v2/insights · artist, movie, tv_show, place" },
  { tool: "get_city_info", api: "data/cities.json" },
];

export function AboutContent({ cityCount }: { cityCount: number }) {
  const home = "/";
  const steps = ["step1", "step2", "step3", "step4", "step5", "step6"];

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-16 pt-6">
      <nav className="flex items-center justify-between gap-3">
        <Link href={home} className="text-lg font-bold tracking-tight">
          Taste<span className="text-accent">Abroad</span>
        </Link>
        <Link href={home} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white">
          {t("about.back")}
        </Link>
      </nav>

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("about.title")}</h1>
        <p className="text-lg leading-relaxed text-muted">{t("about.intro")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t("about.stepsTitle")}</h2>
        <ol className="space-y-3">
          {steps.map((key, i) => (
            <li key={key} className="flex gap-3 rounded-2xl border border-line bg-card p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {i + 1}
              </span>
              <p className="leading-relaxed">{t(`about.${key}`, { count: cityCount })}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Agent tools" className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 font-mono text-xs text-muted">Gemini agent → tool calls → Qloo</p>
        <ol className="grid gap-2 sm:grid-cols-2">
          {FLOW.map((step, i) => (
            <li key={step.tool} className="rounded-xl bg-accent-soft p-3">
              <p className="font-mono text-sm font-semibold text-accent">
                {i + 1}. {step.tool}()
              </p>
              <p className="mt-1 font-mono text-xs text-muted">{step.api}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t("about.roleTitle")}</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["Qloo", "about.roleQloo"],
            ["AI", "about.roleAi"],
            ["Data", "about.roleData"],
          ].map(([label, key]) => (
            <div key={key} className="rounded-2xl border border-line bg-card p-4">
              <dt className="mb-1 font-semibold text-accent">{label}</dt>
              <dd className="text-sm leading-relaxed">{t(key)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {[
        ["about.reliabilityTitle", "about.reliability"],
        ["about.limitsTitle", "about.limits"],
        ["about.privacyTitle", "about.privacy"],
      ].map(([title, body]) => (
        <section key={title} className="space-y-2">
          <h2 className="text-xl font-semibold">{t(title)}</h2>
          <p className="leading-relaxed text-muted">{t(body)}</p>
        </section>
      ))}

      <footer className="flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-sm text-muted">
        <span>{t("footer.poweredBy")}</span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {t("about.source")}
        </a>
      </footer>
    </article>
  );
}
