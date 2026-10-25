import de from "@/messages/de.json";
import en from "@/messages/en.json";
import sq from "@/messages/sq.json";

export const LANGS = ["en", "sq", "de"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = { en: "English", sq: "Shqip", de: "Deutsch" };
/** Language names as the LLM should see them. */
export const LANG_NAMES: Record<Lang, string> = { en: "English", sq: "Albanian", de: "German" };

export type Messages = typeof en;

// Typed as Messages so a missing key in a translation is a compile error.
const catalogs: Record<Lang, Messages> = { en, sq, de };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

export function getMessages(lang: Lang): Messages {
  return catalogs[lang];
}

/** Look up a dotted key ("results.match") and fill {placeholders}. Falls back to English, then to the key. */
export function translate(messages: Messages, key: string, vars: Record<string, string | number> = {}): string {
  const lookup = (root: unknown) =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], root);
  const raw = lookup(messages) ?? lookup(en);
  const text = typeof raw === "string" ? raw : key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
