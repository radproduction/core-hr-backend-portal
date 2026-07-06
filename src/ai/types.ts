/**
 * server/ai/types.ts
 *
 * Provider-agnostic type contracts for the CORE HR AI service layer.
 * All providers and the AiService class are built against these interfaces,
 * so swapping models or vendors requires only a new provider implementation.
 */

// ─── Message primitives ───────────────────────────────────────────────────────

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export type MessageContent = string | Array<TextContent | ImageContent>;

export interface ChatMessage {
  role: MessageRole;
  content: MessageContent;
  /** Present when role === "tool" — the tool_call_id this result belongs to */
  tool_call_id?: string;
  /** Present when role === "assistant" and the model requested tool calls */
  tool_calls?: ToolCall[];
  name?: string;
}

// ─── Function / Tool calling ──────────────────────────────────────────────────

/** JSON-Schema subset used to describe a tool's parameters */
export interface JsonSchemaObject {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/** A callable tool exposed to the LLM */
export interface FunctionTool {
  /** Unique snake_case name the model uses to invoke this tool */
  name: string;
  /** Human-readable description the model uses to decide when to call it */
  description: string;
  /** JSON Schema describing the arguments object */
  parameters: JsonSchemaObject;
  /**
   * The actual implementation.
   * Receives the parsed arguments object and returns any serialisable value.
   */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/** A single tool-call request emitted by the model */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON-encoded arguments string */
    arguments: string;
  };
}

/** Result of executing one tool call */
export interface FunctionCallResult {
  tool_call_id: string;
  name: string;
  result: unknown;
  error?: string;
}

// ─── Core request / response shapes ──────────────────────────────────────────

export interface AiRequestOptions {
  /** Override the default model for this request */
  model?: string;
  /** 0–1 sampling temperature */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Optional system prompt override */
  systemPrompt?: string;
  /** Tools available for this request */
  tools?: FunctionTool[];
  /**
   * How the model should use tools.
   * "auto"     — model decides (default when tools are provided)
   * "required" — model must call at least one tool
   * "none"     — no tool calls
   */
  toolChoice?: "auto" | "required" | "none";
}

export interface AiResponse {
  /** The final text output (may be empty if the model only made tool calls) */
  text: string;
  /** Tool calls requested by the model in this turn (before execution) */
  toolCalls?: ToolCall[];
  /** Executed tool call results (populated by the function-calling handler) */
  toolResults?: FunctionCallResult[];
  /** Raw token usage from the provider */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Which provider + model actually served this request */
  model: string;
  /** Whether this response came from the mock provider */
  isMock: boolean;
}

// ─── Provider interface ───────────────────────────────────────────────────────

/**
 * Every concrete provider (OpenAI, Anthropic, mock, …) implements this
 * single interface.  AiService calls only these two methods.
 */
export interface AiProvider {
  /** Human-readable provider name, e.g. "openai", "mock" */
  readonly name: string;
  /** The default model identifier used when none is specified per-request */
  readonly defaultModel: string;

  /**
   * Send a chat completion request.
   * The provider is responsible for mapping ChatMessage[] → its own wire format
   * and mapping the response back to AiResponse.
   */
  chat(
    messages: ChatMessage[],
    options?: AiRequestOptions
  ): Promise<AiResponse>;
}

// ─── Structured-data extraction ───────────────────────────────────────────────

/** Describes the shape of data to extract from a document */
export interface ExtractionSchema {
  /** Field name → description of what to extract */
  fields: Record<string, { description: string; type: "string" | "number" | "boolean" | "date" | "array" }>;
}

export interface ExtractionResult<T = Record<string, unknown>> {
  data: T;
  /** Fields the model could not confidently extract */
  missingFields: string[];
  /** Raw text the model used as source */
  sourceText: string;
}

// ─── Classification ───────────────────────────────────────────────────────────

export interface ClassifyOptions {
  /** The categories to choose from */
  labels: string[];
  /** Optional descriptions for each label */
  labelDescriptions?: Record<string, string>;
  /** Allow the model to return multiple labels */
  multiLabel?: boolean;
}

export interface ClassifyResult {
  /** Primary label (highest confidence) */
  label: string;
  /** All labels with their confidence scores (0–1) */
  scores: Array<{ label: string; score: number }>;
}

// ─── Service-level config ─────────────────────────────────────────────────────

export interface AiServiceConfig {
  provider: AiProvider;
  /** Default system prompt prepended to all requests unless overridden */
  defaultSystemPrompt?: string;
  /** Global request defaults */
  defaults?: Pick<AiRequestOptions, "temperature" | "maxTokens">;
}
