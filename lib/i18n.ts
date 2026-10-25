import en from "@/messages/en.json";

export const LANGS = ["en", "sq", "de"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = { en: "English", sq: "Shqip", de: "Deutsch" };
/** Language names as the LLM should see them. */
export const LANG_NAMES: Record<Lang, string> = { en: "English", sq: "Albanian", de: "German" };

export type Messages = typeof en;

// Albanian and German catalogs are added later; until then they fall back to English.
const catalogs: Partial<Record<Lang, Messages>> = { en };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

export function getMessages(lang: Lang): Messages {
  return catalogs[lang] ?? en;
}

/** Look up a dotted key ("results.match") and fill {placeholders}. Falls back to English, then to the key. */
export function translate(messages: Messages, key: string, vars: Record<string, string | number> = {}): string {
  const lookup = (root: unknown) =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], root);
  const raw = lookup(messages) ?? lookup(en);
  const text = typeof raw === "string" ? raw : key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
