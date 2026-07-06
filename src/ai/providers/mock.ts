/**
 * server/ai/providers/mock.ts
 *
 * Deterministic mock provider used in dev/test when no API key is configured.
 * Returns canned responses keyed on the last user message content so tests
 * can assert on predictable output without hitting a real LLM.
 */

import type {
  AiProvider,
  AiRequestOptions,
  AiResponse,
  ChatMessage,
  ToolCall,
} from "../types";

// ─── Canned response map ──────────────────────────────────────────────────────
// Keys are lowercase substrings of the user message; first match wins.

const CANNED_RESPONSES: Array<{ match: string; text: string }> = [
  {
    match: "summarize",
    text: "[MOCK] Summary: This document discusses key operational topics relevant to human capital management, including employee lifecycle, leave policies, and performance tracking.",
  },
  {
    match: "classify",
    text: JSON.stringify({ label: "hr_policy", scores: [{ label: "hr_policy", score: 0.91 }, { label: "general", score: 0.09 }] }),
  },
  {
    match: "extract",
    text: JSON.stringify({ data: { employeeName: "Jane Doe", department: "Engineering", startDate: "2024-01-15" }, missingFields: [], sourceText: "[mock source]" }),
  },
  {
    match: "function",
    text: "[MOCK] Function calling is available. Register tools via the callWithFunctions method.",
  },
  {
    match: "hello",
    text: "[MOCK] Hello! I am the CORE HR AI assistant (mock mode). Configure AI_API_KEY to use a real model.",
  },
  {
    match: "employee",
    text: "[MOCK] Employee data retrieved. In production, this would query live HR records.",
  },
  {
    match: "leave",
    text: "[MOCK] Leave balance: 12 days annual, 5 days sick remaining.",
  },
  {
    match: "workflow",
    text: "[MOCK] Workflow status: 3 pending approvals, 1 approved today.",
  },
];

const DEFAULT_MOCK_RESPONSE =
  "[MOCK] AI service is running in mock mode. Set AI_PROVIDER and AI_API_KEY environment variables to enable a real LLM.";

function pickCannedResponse(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return DEFAULT_MOCK_RESPONSE;

  const text =
    typeof lastUser.content === "string"
      ? lastUser.content.toLowerCase()
      : lastUser.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join(" ")
          .toLowerCase();

  for (const { match, text: response } of CANNED_RESPONSES) {
    if (text.includes(match)) return response;
  }
  return DEFAULT_MOCK_RESPONSE;
}

// ─── Mock tool-call simulation ────────────────────────────────────────────────

function buildMockToolCall(tools: AiRequestOptions["tools"]): ToolCall[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  // Always "call" the first registered tool with empty args for predictability
  const first = tools[0];
  return [
    {
      id: `mock_call_${Date.now()}`,
      type: "function" as const,
      function: {
        name: first.name,
        arguments: JSON.stringify(
          Object.fromEntries(
            (first.parameters.required ?? []).map((k) => [k, `[mock_${k}]`])
          )
        ),
      },
    },
  ];
}

// ─── Provider implementation ──────────────────────────────────────────────────

export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly defaultModel = "mock-gpt-0";

  async chat(
    messages: ChatMessage[],
    options?: AiRequestOptions
  ): Promise<AiResponse> {
    // Simulate a tiny async delay so consumers behave correctly with await
    await new Promise((r) => setTimeout(r, 10));

    const toolChoice = options?.toolChoice ?? (options?.tools?.length ? "auto" : "none");
    const shouldCallTool = toolChoice !== "none" && options?.tools?.length;

    const toolCalls = shouldCallTool
      ? buildMockToolCall(options?.tools)
      : undefined;

    return {
      text: toolCalls ? "" : pickCannedResponse(messages),
      toolCalls,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: this.defaultModel,
      isMock: true,
    };
  }
}
