// Minimal OpenAI-compatible chat client. Defaults to Gemini's OpenAI endpoint; any provider
// with /chat/completions + tool calling works by changing LLM_BASE_URL / LLM_MODEL / LLM_API_KEY.
// Server-side only.

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_FALLBACK_MODELS = "gemini-3.1-flash-lite";
const TIMEOUT_MS = 25_000;

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  // Providers may attach extra fields (e.g. Gemini thought signatures) that must be sent back unchanged.
  [extra: string]: unknown;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; [extra: string]: unknown }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  json?: boolean;
  temperature?: number;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

function config() {
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LlmError("No LLM API key is set on the server (GEMINI_API_KEY).");
  const models = [process.env.LLM_MODEL || DEFAULT_MODEL, ...(process.env.LLM_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS).split(",")]
    .map((m) => m.trim())
    .filter(Boolean);
  return { apiKey, baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""), models };
}

async function callModel(model: string, opts: ChatOptions, apiKey: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      tools: opts.tools?.length ? opts.tools : undefined,
      response_format: opts.json ? { type: "json_object" } : undefined,
      temperature: opts.temperature ?? 0.4,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new LlmError(`LLM ${model} returned HTTP ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  const json = (await res.json()) as { choices?: { message?: ChatMessage }[] };
  const message = json.choices?.[0]?.message;
  if (!message || message.role !== "assistant") throw new LlmError(`LLM ${model} returned no message.`);
  return message;
}

/** One chat completion. Busy, rate-limited or failing models fall through to the next configured model. */
export async function chat(opts: ChatOptions): Promise<Extract<ChatMessage, { role: "assistant" }>> {
  const { apiKey, baseUrl, models } = config();
  let lastError: unknown;
  for (const model of models) {
    try {
      return (await callModel(model, opts, apiKey, baseUrl)) as Extract<ChatMessage, { role: "assistant" }>;
    } catch (err) {
      lastError = err;
      const status = err instanceof LlmError ? err.status : undefined;
      const tryNext = status === undefined || status === 429 || status >= 500 || status === 404;
      if (!tryNext) break;
    }
  }
  throw lastError instanceof Error ? lastError : new LlmError("LLM request failed.");
}
