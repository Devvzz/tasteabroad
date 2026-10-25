// All UI text lives in messages/en.json so wording can be changed in one place.
import en from "@/messages/en.json";

export type Messages = typeof en;

export const messages: Messages = en;

/** Look up a dotted key ("results.match") and fill {placeholders}. Falls back to the key itself. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const raw = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
  const text = typeof raw === "string" ? raw : key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
