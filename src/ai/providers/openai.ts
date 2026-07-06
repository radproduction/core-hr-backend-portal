/**
 * server/ai/providers/openai.ts
 *
 * OpenAI-compatible provider.  Works with:
 *   - OpenAI (api.openai.com)
 *   - Azure OpenAI (set AI_BASE_URL to your Azure endpoint)
 *   - Any OpenAI-compatible endpoint (Groq, Together, Mistral, local Ollama, etc.)
 *   - Manus built-in Forge API (default when AI_PROVIDER=manus)
 *
 * Environment variables read at construction time:
 *   AI_API_KEY      — bearer token (required for real calls)
 *   AI_BASE_URL     — base URL override (default: https://api.openai.com/v1)
 *   AI_DEFAULT_MODEL — default model name (default: gpt-4o-mini)
 */

import type {
  AiProvider,
  AiRequestOptions,
  AiResponse,
  ChatMessage,
  FunctionTool,
  ToolCall,
} from "../types";

// ─── Wire-format types (subset of OpenAI spec) ────────────────────────────────

interface OAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: OAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toOAIMessages(messages: ChatMessage[]): OAIMessage[] {
  return messages.map((m) => {
    const base: OAIMessage = {
      role: m.role,
      content:
        typeof m.content === "string"
          ? m.content
          : m.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text)
              .join("\n"),
    };
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
    if (m.name) base.name = m.name;
    if (m.tool_calls) base.tool_calls = m.tool_calls as OAIToolCall[];
    return base;
  });
}

function toOAITools(tools: FunctionTool[]): OAITool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    },
  }));
}

function fromOAIToolCalls(calls?: OAIToolCall[]): ToolCall[] | undefined {
  if (!calls || calls.length === 0) return undefined;
  return calls.map((c) => ({
    id: c.id,
    type: "function" as const,
    function: { name: c.function.name, arguments: c.function.arguments },
  }));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface OpenAiProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class OpenAiProvider implements AiProvider {
  readonly name: string;
  readonly defaultModel: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: OpenAiProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.defaultModel = config.defaultModel ?? "gpt-4o-mini";

    // Derive a friendly name from the base URL
    if (this.baseUrl.includes("openai.com")) {
      this.name = "openai";
    } else if (this.baseUrl.includes("azure.com")) {
      this.name = "azure-openai";
    } else if (this.baseUrl.includes("manus") || this.baseUrl.includes("forge")) {
      this.name = "manus-forge";
    } else {
      this.name = "openai-compatible";
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: AiRequestOptions
  ): Promise<AiResponse> {
    const model = options?.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: toOAIMessages(messages),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1024,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = toOAITools(options.tools);
      body.tool_choice = options.toolChoice ?? "auto";
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`[AI:${this.name}] HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OAIResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error(`[AI:${this.name}] No choices in response`);

    return {
      text: choice.message.content ?? "",
      toolCalls: fromOAIToolCalls(choice.message.tool_calls),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      model: data.model ?? model,
      isMock: false,
    };
  }
}
