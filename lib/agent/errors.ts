import type { ErrorCode } from "./types";

/** A failure the user should see as a message (not a crash), with a code the page can translate. */
export class AgentError extends Error {
  constructor(readonly code: Exclude<ErrorCode, "generic" | "badRequest">) {
    super(code);
    this.name = "AgentError";
  }
}
