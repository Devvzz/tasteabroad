// Minimal OpenAI-compatible chat client. Defaults to Gemini's OpenAI endpoint; any provider
// with /chat/completions + tool calling works by changing LLM_BASE_URL / LLM_MODEL / LLM_API_KEY.
// Server-side only.

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// Flash Lite models get far higher free-tier quotas (15 RPM / 500 RPD vs 5 / 20 for Flash),
// so they do the work and the bigger model is only a last resort.
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_FALLBACK_MODELS = "gemini-3.5-flash-lite,gemini-3.5-flash";
const TIMEOUT_MS = 15_000;
const MIN_CALL_MS = 2_000;
const BUSY_RETRY_MS = 800;

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
  /** Try this model first, then the configured ones. */
  model?: string;
  /** Epoch ms after which no new attempt is started. */
  deadline?: number;
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

async function callModel(model: string, opts: ChatOptions, apiKey: string, baseUrl: string, timeoutMs: number) {
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
    signal: AbortSignal.timeout(timeoutMs),
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
  const order = opts.model ? [opts.model, ...models.filter((m) => m !== opts.model)] : models;
  const deadline = opts.deadline ?? Date.now() + TIMEOUT_MS * order.length;
  // Each model gets one quick retry when it reports being busy (503), then we move on.
  const attempts = order.flatMap((model) => [model, model]);
  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    const isRetry = i % 2 === 1;
    if (isRetry && !(lastError instanceof LlmError && lastError.status === 503)) continue;
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) break;
    if (isRetry) await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
    try {
      const message = await callModel(model, opts, apiKey, baseUrl, Math.min(TIMEOUT_MS, remaining));
      return message as Extract<ChatMessage, { role: "assistant" }>;
    } catch (err) {
      lastError = err;
      const status = err instanceof LlmError ? err.status : undefined;
      const tryNext = status === undefined || status === 429 || status >= 500 || status === 404;
      if (!tryNext) break;
    }
  }
  throw lastError instanceof Error ? lastError : new LlmError("LLM request timed out.");
}
