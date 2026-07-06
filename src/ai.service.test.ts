/**
 * server/ai.service.test.ts
 *
 * Vitest tests for the shared AI service layer.
 * All tests run against the MockProvider — no real API key required.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AiService } from "./ai/service";
import { MockProvider } from "./ai/providers/mock";
import { resetAiService, getAiService } from "./ai/index";
import { ALL_HCM_TOOLS, HCM_TOOLS } from "./ai/functions/hcmTools";
import type { FunctionTool } from "./ai/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockService(): AiService {
  return new AiService({
    provider: new MockProvider(),
    defaults: { temperature: 0.3, maxTokens: 512 },
  });
}

// ─── MockProvider unit tests ──────────────────────────────────────────────────

describe("MockProvider", () => {
  it("returns isMock=true", async () => {
    const provider = new MockProvider();
    const response = await provider.chat([{ role: "user", content: "hello" }]);
    expect(response.isMock).toBe(true);
  });

  it("returns a non-empty text for a generic prompt", async () => {
    const provider = new MockProvider();
    const response = await provider.chat([{ role: "user", content: "hello world" }]);
    expect(response.text).toBeTruthy();
    expect(typeof response.text).toBe("string");
  });

  it("returns canned summarize response when message contains 'summarize'", async () => {
    const provider = new MockProvider();
    const response = await provider.chat([
      { role: "user", content: "Please summarize this document" },
    ]);
    expect(response.text.toLowerCase()).toContain("[mock]");
    expect(response.text.toLowerCase()).toContain("summar");
  });

  it("returns canned classify JSON when message contains 'classify'", async () => {
    const provider = new MockProvider();
    const response = await provider.chat([
      { role: "user", content: "classify this text into categories" },
    ]);
    // Mock classify response is JSON
    const parsed = JSON.parse(response.text);
    expect(parsed).toHaveProperty("label");
    expect(parsed).toHaveProperty("scores");
  });

  it("returns a tool call when tools are provided and toolChoice is auto", async () => {
    const provider = new MockProvider();
    const dummyTool: FunctionTool = {
      name: "dummy_tool",
      description: "A dummy tool for testing",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "A query" } },
        required: ["query"],
      },
      execute: async () => ({ result: "dummy" }),
    };
    const response = await provider.chat(
      [{ role: "user", content: "do something" }],
      { tools: [dummyTool], toolChoice: "auto" }
    );
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls!.length).toBeGreaterThan(0);
    expect(response.toolCalls![0].function.name).toBe("dummy_tool");
  });

  it("does not return tool calls when toolChoice is none", async () => {
    const provider = new MockProvider();
    const dummyTool: FunctionTool = {
      name: "dummy_tool",
      description: "A dummy tool",
      parameters: { type: "object", properties: {}, required: [] },
      execute: async () => ({}),
    };
    const response = await provider.chat(
      [{ role: "user", content: "do something" }],
      { tools: [dummyTool], toolChoice: "none" }
    );
    expect(response.toolCalls).toBeUndefined();
  });

  it("returns usage stats", async () => {
    const provider = new MockProvider();
    const response = await provider.chat([{ role: "user", content: "test" }]);
    expect(response.usage).toBeDefined();
    expect(response.usage!.totalTokens).toBeGreaterThan(0);
  });
});

// ─── AiService.generateText ───────────────────────────────────────────────────

describe("AiService.generateText", () => {
  it("returns a response with text and model fields", async () => {
    const ai = makeMockService();
    const result = await ai.generateText("What is HR?");
    expect(result.text).toBeTruthy();
    expect(result.model).toBe("mock-gpt-0");
    expect(result.isMock).toBe(true);
  });

  it("uses custom systemPrompt when provided", async () => {
    const ai = makeMockService();
    // Just verify it doesn't throw and returns a response
    const result = await ai.generateText("hello", {
      systemPrompt: "You are a payroll expert.",
    });
    expect(result.text).toBeTruthy();
  });
});

// ─── AiService.summarize ─────────────────────────────────────────────────────

describe("AiService.summarize", () => {
  it("returns a summary string", async () => {
    const ai = makeMockService();
    const longText = "This is a long document about employee leave policies. ".repeat(20);
    const result = await ai.summarize(longText);
    expect(result.text).toBeTruthy();
    expect(result.isMock).toBe(true);
  });

  it("accepts a custom maxSentences parameter", async () => {
    const ai = makeMockService();
    const result = await ai.summarize("Some text to summarize.", 5);
    expect(result.text).toBeTruthy();
  });
});

// ─── AiService.classify ───────────────────────────────────────────────────────

describe("AiService.classify", () => {
  it("returns a label and scores array", async () => {
    const ai = makeMockService();
    const result = await ai.classify("I need to take 3 days off next week", {
      labels: ["leave_request", "expense_claim", "general_inquiry"],
    });
    expect(result.label).toBeTruthy();
    expect(Array.isArray(result.scores)).toBe(true);
    expect(result.scores.length).toBeGreaterThan(0);
  });

  it("falls back gracefully when model returns non-JSON", async () => {
    // Override mock to return plain text instead of JSON
    const brokenProvider = {
      name: "broken-mock",
      defaultModel: "broken-0",
      chat: async () => ({
        text: "This is not JSON at all",
        model: "broken-0",
        isMock: true,
      }),
    };
    const ai = new AiService({ provider: brokenProvider });
    const result = await ai.classify("test text", {
      labels: ["category_a", "category_b"],
    });
    // Should fall back to first label
    expect(result.label).toBe("category_a");
    expect(result.scores).toHaveLength(2);
  });

  it("supports multiLabel option", async () => {
    const ai = makeMockService();
    const result = await ai.classify("Request for leave and expense reimbursement", {
      labels: ["leave_request", "expense_claim", "general_inquiry"],
      multiLabel: true,
    });
    expect(result.label).toBeTruthy();
  });
});

// ─── AiService.extractStructuredData ─────────────────────────────────────────

describe("AiService.extractStructuredData", () => {
  it("returns data and missingFields", async () => {
    const ai = makeMockService();
    const result = await ai.extractStructuredData(
      "Employee: John Smith, Department: Engineering, Start Date: 2024-03-01",
      {
        fields: {
          employeeName: { description: "Full name of the employee", type: "string" },
          department: { description: "Department name", type: "string" },
          startDate: { description: "Employment start date", type: "date" },
        },
      }
    );
    // Mock returns pre-canned JSON for "extract" keyword
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("missingFields");
    expect(result).toHaveProperty("sourceText");
    expect(Array.isArray(result.missingFields)).toBe(true);
  });

  it("falls back to empty data on parse failure", async () => {
    const brokenProvider = {
      name: "broken-mock",
      defaultModel: "broken-0",
      chat: async () => ({
        text: "cannot parse this",
        model: "broken-0",
        isMock: true,
      }),
    };
    const ai = new AiService({ provider: brokenProvider });
    const result = await ai.extractStructuredData("some doc", {
      fields: {
        name: { description: "Name", type: "string" },
        age: { description: "Age", type: "number" },
      },
    });
    expect(result.data).toEqual({});
    expect(result.missingFields).toContain("name");
    expect(result.missingFields).toContain("age");
  });
});

// ─── AiService.callWithFunctions ─────────────────────────────────────────────

describe("AiService.callWithFunctions", () => {
  it("executes a tool call and returns allToolResults", async () => {
    const ai = makeMockService();

    let executed = false;
    const echoTool: FunctionTool = {
      name: "echo",
      description: "Echoes the input back",
      parameters: {
        type: "object",
        properties: { message: { type: "string", description: "Message to echo" } },
        required: ["message"],
      },
      execute: async (args) => {
        executed = true;
        return { echoed: args.message };
      },
    };

    // Mock provider always calls the first tool when tools are present
    const result = await ai.callWithFunctions("Echo hello", [echoTool]);

    expect(executed).toBe(true);
    expect(result.allToolResults.length).toBeGreaterThan(0);
    expect(result.allToolResults[0].name).toBe("echo");
  });

  it("handles tool execution errors gracefully", async () => {
    const ai = makeMockService();

    const failingTool: FunctionTool = {
      name: "failing_tool",
      description: "Always fails",
      parameters: {
        type: "object",
        properties: { input: { type: "string", description: "Any input" } },
        required: ["input"],
      },
      execute: async () => {
        throw new Error("Tool execution failed intentionally");
      },
    };

    const result = await ai.callWithFunctions("Use the failing tool", [failingTool]);
    const toolResult = result.allToolResults.find((r) => r.name === "failing_tool");
    expect(toolResult).toBeDefined();
    expect(toolResult!.error).toContain("Tool execution failed intentionally");
  });

  it("respects maxIter limit", async () => {
    // Provider that always requests a tool call (never produces final text)
    let callCount = 0;
    const loopingProvider = {
      name: "looping-mock",
      defaultModel: "loop-0",
      chat: async (_messages: unknown, options: { tools?: FunctionTool[] }) => {
        callCount++;
        if (!options?.tools?.length) {
          return { text: "done", model: "loop-0", isMock: true };
        }
        return {
          text: "",
          toolCalls: [
            {
              id: `call_${callCount}`,
              type: "function" as const,
              function: {
                name: options.tools[0].name,
                arguments: JSON.stringify({ input: "test" }),
              },
            },
          ],
          model: "loop-0",
          isMock: true,
        };
      },
    };

    const noopTool: FunctionTool = {
      name: "noop",
      description: "Does nothing",
      parameters: {
        type: "object",
        properties: { input: { type: "string", description: "input" } },
        required: ["input"],
      },
      execute: async () => ({ done: true }),
    };

    const ai = new AiService({ provider: loopingProvider });
    const maxIter = 3;
    await ai.callWithFunctions("loop forever", [noopTool], undefined, maxIter);

    // Should have called the provider at most maxIter times
    expect(callCount).toBeLessThanOrEqual(maxIter);
  });
});

// ─── HCM Tool registry ────────────────────────────────────────────────────────

describe("HCM Tool registry", () => {
  it("exports ALL_HCM_TOOLS as a non-empty array", () => {
    expect(Array.isArray(ALL_HCM_TOOLS)).toBe(true);
    expect(ALL_HCM_TOOLS.length).toBeGreaterThan(0);
  });

  it("every tool has required fields: name, description, parameters, execute", () => {
    for (const tool of ALL_HCM_TOOLS) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters.type).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("tool names are snake_case", () => {
    const snakeCasePattern = /^[a-z][a-z0-9_]*$/;
    for (const tool of ALL_HCM_TOOLS) {
      expect(tool.name).toMatch(snakeCasePattern);
    }
  });

  it("HCM_TOOLS registry keys match tool names", () => {
    for (const [key, tool] of Object.entries(HCM_TOOLS)) {
      expect(key).toBe(tool.name);
    }
  });

  it("contains the expected built-in tools", () => {
    const expectedNames = [
      "get_employee",
      "list_employees",
      "list_departments",
      "get_workflow_status",
      "list_pending_approvals",
      "create_notification",
      "get_recent_audit_events",
    ];
    const actualNames = ALL_HCM_TOOLS.map((t) => t.name);
    for (const name of expectedNames) {
      expect(actualNames).toContain(name);
    }
  });

  it("every tool parameter has a description", () => {
    for (const tool of ALL_HCM_TOOLS) {
      for (const [paramName, param] of Object.entries(tool.parameters.properties)) {
        expect(
          typeof param.description === "string" && param.description.length > 0,
          `Tool "${tool.name}" param "${paramName}" is missing a description`
        ).toBe(true);
      }
    }
  });
});

// ─── Singleton factory ────────────────────────────────────────────────────────

describe("getAiService singleton", () => {
  beforeEach(() => {
    resetAiService();
  });

  afterEach(() => {
    resetAiService();
    // Restore env
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
  });

  it("returns the same instance on repeated calls", () => {
    const a = getAiService();
    const b = getAiService();
    expect(a).toBe(b);
  });

  it("uses mock provider when AI_PROVIDER=mock", () => {
    process.env.AI_PROVIDER = "mock";
    const ai = getAiService();
    expect(ai.isMockProvider).toBe(true);
    expect(ai.providerName).toBe("mock");
  });

  it("falls back to mock when AI_PROVIDER=openai but no API key", () => {
    process.env.AI_PROVIDER = "openai";
    delete process.env.AI_API_KEY;
    const ai = getAiService();
    expect(ai.isMockProvider).toBe(true);
  });

  it("uses manus-forge provider when AI_PROVIDER=manus", () => {
    process.env.AI_PROVIDER = "manus";
    const ai = getAiService();
    expect(ai.providerName).toBe("manus-forge");
    expect(ai.isMockProvider).toBe(false);
  });

  it("resets correctly after resetAiService()", () => {
    process.env.AI_PROVIDER = "mock";
    const a = getAiService();
    resetAiService();
    process.env.AI_PROVIDER = "mock";
    const b = getAiService();
    expect(a).not.toBe(b);
  });
});
