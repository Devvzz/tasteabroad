// Chooses which Qloo match stands for a like. Shared by the fixed pipeline and the instant like check,
// so the warning on a chip matches what a real search would do.
import type { ResolvedSignal } from "./types";

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Pick the best candidate per input. Lowercase inputs ("anime", "street food") are usually hobbies or
 * genres, so an exactly named tag wins; otherwise prefer a closely named entity, then a tag, then the top entity.
 */
export function pickSignal(input: string, options: ResolvedSignal[]): ResolvedSignal | undefined {
  const q = normalize(input);
  const close = (s: ResolvedSignal) => normalize(s.name) === q || normalize(s.name).includes(q) || q.includes(normalize(s.name));
  const looksLikeHobby = input === input.toLowerCase();
  return (
    (looksLikeHobby ? options.find((o) => o.kind === "tag" && normalize(o.name) === q) : undefined) ??
    options.find((o) => o.kind === "entity" && close(o)) ??
    options.find((o) => o.kind === "tag" && close(o)) ??
    options.find((o) => o.kind === "entity") ??
    options[0]
  );
}
