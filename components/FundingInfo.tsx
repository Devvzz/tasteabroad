import { ERASMUS_CAVEAT, exchangeStatus, scholarshipsFor } from "@/lib/funding";

interface Props {
  countryCode: string;
  /** Heading level that fits where the block sits (h4 inside a city card, h3 in the city checker). */
  headingLevel?: "h3" | "h4";
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/** Exchange programme status and government scholarships for a city's country. */
export function FundingInfo({ countryCode, t, headingLevel: Heading = "h4" }: Props) {
  const exchange = exchangeStatus(countryCode);
  const scholarships = scholarshipsFor(countryCode);
  if (!exchange && !scholarships.length) return null;
  const caveat = ERASMUS_CAVEAT[countryCode];

  return (
    <section>
      <Heading className="mb-1 font-semibold">{t("funding.title")}</Heading>
      {exchange && (
        <p className="mb-2">
          <span className="mr-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">{t(`funding.${exchange}.badge`)}</span>
          {t(`funding.${exchange}.text`)}
          {caveat && <span className="mt-1 block text-xs text-muted">{t(`funding.${caveat}`)}</span>}
        </p>
      )}
      {scholarships.length > 0 && (
        <ul className="space-y-1">
          {scholarships.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                {s.name}
              </a>
              <span className="text-xs text-muted"> · {s.level}</span>
            </li>
          ))}
        </ul>
      )}
      {scholarships.length > 0 && <p className="mt-1 text-xs text-muted">{t("funding.check")}</p>}
    </section>
  );
}
