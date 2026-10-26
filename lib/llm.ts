// Minimal OpenAI-compatible chat client. Defaults to Gemini's OpenAI endpoint; any provider
// with /chat/completions + tool calling works by changing LLM_BASE_URL / LLM_MODEL / LLM_API_KEY.
// Server-side only.

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// Flash Lite models get far higher free-tier quotas (15 RPM / 500 RPD vs 5 / 20 for Flash),
// so they do the work and the bigger model is only a last resort. 3.5 Flash Lite answers tool calls
// in about a second; 3.1 Flash Lite often takes 2 to 10s, so it is the backup here.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_FALLBACK_MODELS = "gemini-3.1-flash-lite,gemini-3.5-flash";
// A healthy call takes a few seconds; a call that hangs longer is better retried on the next model.
const TIMEOUT_MS = 10_000;
const MIN_CALL_MS = 2_000;
const BUSY_RETRY_MS = 800;
// A model that just hung or was overloaded usually stays that way for a while (3.5 Flash Lite sometimes
// stops answering for minutes). Trying it first on every step wasted the agent's whole time budget.
const COOL_DOWN_MS = 3 * 60_000;
const coolingUntil = new Map<string, number>();
// Racing sends every request to two models, so only models with a large free quota take part
// (Flash allows 20 requests a day, Flash Lite 500).
const SMALL_QUOTA_MODELS = new Set(["gemini-3.5-flash"]);
const isCooling = (model: string) => (coolingUntil.get(model) ?? 0) > Date.now();

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
  /**
   * Ask the first two available models at once and use whichever answers first. Worth it when models
   * hang often (they do on the free tier); each model has its own quota.
   */
  hedge?: boolean;
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

async function callModel(model: string, opts: ChatOptions, apiKey: string, baseUrl: string, timeoutMs: number, cancel?: AbortSignal) {
  // A plain timer instead of AbortSignal.any(AbortSignal.timeout(...)): in Node that combination did not
  // always fire, and raced calls ran for 30 s past their timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException(`LLM ${model} timed out.`, "TimeoutError")), timeoutMs);
  const onCancel = () => controller.abort(cancel?.reason);
  cancel?.addEventListener("abort", onCancel, { once: true });
  try {
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
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new LlmError(`LLM ${model} returned HTTP ${res.status}: ${body.slice(0, 200)}`, res.status);
    }
    const json = (await res.json()) as { choices?: { message?: ChatMessage }[] };
    const message = json.choices?.[0]?.message;
    if (!message || message.role !== "assistant") throw new LlmError(`LLM ${model} returned no message.`);
    return message;
  } finally {
    clearTimeout(timer);
    cancel?.removeEventListener("abort", onCancel);
  }
}

/**
 * Timeouts, rate limits and server errors put the model aside for a while; a 503 gets its quick retry first.
 * A call cut short by the run's deadline says nothing about the model, so only full-length timeouts count.
 */
function noteFailure(model: string, err: unknown, timeoutMs: number, isRetry: boolean) {
  const status = err instanceof LlmError ? err.status : undefined;
  const timedOut = !(err instanceof LlmError) && timeoutMs === TIMEOUT_MS;
  const overloaded = status === 429 || (status !== undefined && status >= 500 && !(status === 503 && !isRetry));
  if (timedOut || overloaded) coolingUntil.set(model, Date.now() + COOL_DOWN_MS);
}

/** One chat completion. Busy, rate-limited or failing models fall through to the next configured model. */
/** Calls both models at once and returns the first good answer; the slower call is cancelled. */
async function race(pair: string[], opts: ChatOptions, apiKey: string, baseUrl: string, timeoutMs: number) {
  const done = new AbortController();
  try {
    const message = await Promise.any(
      pair.map(async (model) => {
        try {
          const reply = await callModel(model, opts, apiKey, baseUrl, timeoutMs, done.signal);
          coolingUntil.delete(model);
          return reply;
        } catch (err) {
          // The slower model is cancelled on purpose once the other answers; that is not its fault.
          if (!done.signal.aborted) noteFailure(model, err, timeoutMs, true);
          throw err;
        }
      }),
    );
    done.abort();
    return message;
  } catch (err) {
    throw err instanceof AggregateError ? err.errors[0] : err;
  }
}

export async function chat(opts: ChatOptions): Promise<Extract<ChatMessage, { role: "assistant" }>> {
  const { apiKey, baseUrl, models } = config();
  const preferred = opts.model ? [opts.model, ...models.filter((m) => m !== opts.model)] : models;
  // Models in their cool-down go last: still a last resort, but no longer the first thing every step waits on.
  const order = [...preferred.filter((m) => !isCooling(m)), ...preferred.filter(isCooling)];
  const deadline = opts.deadline ?? Date.now() + TIMEOUT_MS * order.length;
  const pair = opts.hedge ? order.filter((m) => !SMALL_QUOTA_MODELS.has(m)).slice(0, 2) : [];
  const racing = pair.length === 2;
  const rest = racing ? order.filter((m) => !pair.includes(m)) : order;
  let lastError: unknown;

  const tryRace = async () => {
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) return undefined;
    try {
      return await race(pair, opts, apiKey, baseUrl, Math.min(TIMEOUT_MS, remaining));
    } catch (err) {
      lastError = err;
      return undefined;
    }
  };

  if (racing) {
    const message = await tryRace();
    if (message) return message as Extract<ChatMessage, { role: "assistant" }>;
  }

  // Each model gets one quick retry when it reports being busy (503), then we move on.
  const attempts = rest.flatMap((model) => [model, model]);
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    const isRetry = i % 2 === 1;
    if (isRetry && !(lastError instanceof LlmError && lastError.status === 503)) continue;
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) break;
    if (isRetry) await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
    const timeoutMs = Math.min(TIMEOUT_MS, remaining);
    try {
      const message = await callModel(model, opts, apiKey, baseUrl, timeoutMs);
      coolingUntil.delete(model);
      return message as Extract<ChatMessage, { role: "assistant" }>;
    } catch (err) {
      lastError = err;
      const status = err instanceof LlmError ? err.status : undefined;
      const tryNext = status === undefined || status === 429 || status >= 500 || status === 404;
      noteFailure(model, err, timeoutMs, isRetry);
      if (!tryNext) break;
    }
  }

  // Hangs on the free tier often pass within seconds, so race the pair once more while time is left.
  if (racing) {
    const message = await tryRace();
    if (message) return message as Extract<ChatMessage, { role: "assistant" }>;
  }
  throw lastError instanceof Error ? lastError : new LlmError("LLM request timed out.");
}
