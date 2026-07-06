/**
 * server/ai/providers/manusForge.ts
 *
 * Provider that delegates to the existing `invokeLLM` helper from
 * server/_core/llm.ts — the Manus built-in Forge API.
 *
 * This is the DEFAULT provider when AI_PROVIDER is "manus" or unset.
 * No API key configuration is required; credentials are injected by the platform.
 */

import { invokeLLM } from "../../_core/llm";
import type {
  AiProvider,
  AiRequestOptions,
  AiResponse,
  ChatMessage,
  FunctionTool,
  ToolCall,
} from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ForgeMessage = {
  role: "system" | "user" | "assistant" | "tool" | "function";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

function toForgeMessages(messages: ChatMessage[]): ForgeMessage[] {
  return messages.map((m): ForgeMessage => {
    const base: ForgeMessage = {
      role: m.role as ForgeMessage["role"],
      content:
        typeof m.content === "string"
          ? m.content
          : m.content.map((c) =>
              c.type === "text"
                ? { type: "text" as const, text: c.text }
                : { type: "image_url" as const, image_url: { url: c.image_url.url } }
            ),
    };
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
    if (m.name) base.name = m.name;
    if (m.tool_calls) {
      base.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }
    return base;
  });
}

function toForgeTools(tools: FunctionTool[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    },
  }));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class ManusForgeProvider implements AiProvider {
  readonly name = "manus-forge";
  readonly defaultModel: string;

  constructor(defaultModel = "gpt-4o-mini") {
    this.defaultModel = defaultModel;
  }

  async chat(
    messages: ChatMessage[],
    options?: AiRequestOptions
  ): Promise<AiResponse> {
    const model = options?.model ?? this.defaultModel;

    const params: Parameters<typeof invokeLLM>[0] = {
      messages: toForgeMessages(messages),
      model,
      max_tokens: options?.maxTokens ?? 1024,
      // Note: Manus Forge InvokeParams does not expose temperature; controlled by model defaults
    };

    if (options?.tools && options.tools.length > 0) {
      params.tools = toForgeTools(options.tools);
      params.tool_choice = options.toolChoice ?? "auto";
    }

    // invokeLLM returns the raw OpenAI-style response object
    const raw = await invokeLLM(params);

    const choice = (raw as { choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }> }).choices?.[0];
    const message = choice?.message;

    return {
      text: message?.content ?? "",
      toolCalls: message?.tool_calls,
      usage: (raw as { usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }).usage
        ? {
            promptTokens: (raw as { usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }).usage.prompt_tokens,
            completionTokens: (raw as { usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }).usage.completion_tokens,
            totalTokens: (raw as { usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }).usage.total_tokens,
          }
        : undefined,
      model,
      isMock: false,
    };
  }
}
