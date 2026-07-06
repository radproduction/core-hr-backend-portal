/**
 * server/ai/service.ts
 *
 * AiService — the single class all CORE HR modules import.
 *
 * Methods:
 *   generateText          — open-ended text generation
 *   summarize             — condense a long text
 *   classify              — assign one or more labels to text
 *   extractStructuredData — pull typed fields from a document
 *   callWithFunctions     — agentic loop: model + tools until no more calls
 *
 * The service is provider-agnostic; swap the provider in the factory (index.ts)
 * without touching any call sites.
 */

import type {
  AiProvider,
  AiRequestOptions,
  AiResponse,
  AiServiceConfig,
  ChatMessage,
  ClassifyOptions,
  ClassifyResult,
  ExtractionResult,
  ExtractionSchema,
  FunctionCallResult,
  FunctionTool,
} from "./types";

// ─── Default system prompt ────────────────────────────────────────────────────

const HCM_SYSTEM_PROMPT = `You are an intelligent assistant embedded in CORE HR, a Human Resources Management platform.
You help HR teams, managers, and employees with tasks such as summarising documents,
classifying requests, extracting structured data from forms, and performing actions
through the CORE HR API. Always respond concisely and in plain language.
When extracting data, return valid JSON only — no prose, no markdown fences.`;

// ─── AiService ────────────────────────────────────────────────────────────────

export class AiService {
  private readonly provider: AiProvider;
  private readonly systemPrompt: string;
  private readonly defaultOptions: Pick<AiRequestOptions, "temperature" | "maxTokens">;

  constructor(config: AiServiceConfig) {
    this.provider = config.provider;
    this.systemPrompt = config.defaultSystemPrompt ?? HCM_SYSTEM_PROMPT;
    this.defaultOptions = config.defaults ?? { temperature: 0.3, maxTokens: 1024 };
  }

  // ─── Provider metadata ──────────────────────────────────────────────────────

  get providerName(): string {
    return this.provider.name;
  }

  get defaultModel(): string {
    return this.provider.defaultModel;
  }

  get isMockProvider(): boolean {
    return this.provider.name === "mock";
  }

  // ─── Internal helper ────────────────────────────────────────────────────────

  private buildMessages(
    userContent: string,
    systemOverride?: string
  ): ChatMessage[] {
    return [
      { role: "system", content: systemOverride ?? this.systemPrompt },
      { role: "user", content: userContent },
    ];
  }

  // ─── 1. generateText ────────────────────────────────────────────────────────

  /**
   * Open-ended text generation.
   *
   * @param prompt   The user instruction / question
   * @param options  Per-request overrides (model, temperature, systemPrompt, …)
   */
  async generateText(
    prompt: string,
    options?: AiRequestOptions
  ): Promise<AiResponse> {
    const messages = this.buildMessages(prompt, options?.systemPrompt);
    return this.provider.chat(messages, {
      ...this.defaultOptions,
      ...options,
    });
  }

  // ─── 2. summarize ───────────────────────────────────────────────────────────

  /**
   * Condense a long text into a concise summary.
   *
   * @param text          The source text to summarise
   * @param maxSentences  Rough target length (default: 3)
   * @param options       Per-request overrides
   */
  async summarize(
    text: string,
    maxSentences = 3,
    options?: AiRequestOptions
  ): Promise<AiResponse> {
    const prompt = `Summarise the following text in no more than ${maxSentences} sentences.
Return only the summary — no preamble, no labels.

TEXT:
${text}`;

    const messages = this.buildMessages(prompt, options?.systemPrompt);
    return this.provider.chat(messages, {
      temperature: 0.2,
      maxTokens: 512,
      ...this.defaultOptions,
      ...options,
    });
  }

  // ─── 3. classify ────────────────────────────────────────────────────────────

  /**
   * Assign one (or more) labels to a piece of text.
   *
   * @param text     The text to classify
   * @param opts     Labels, optional descriptions, multiLabel flag
   * @param options  Per-request overrides
   */
  async classify(
    text: string,
    opts: ClassifyOptions,
    options?: AiRequestOptions
  ): Promise<ClassifyResult> {
    const labelList = opts.labels
      .map((l) => {
        const desc = opts.labelDescriptions?.[l];
        return desc ? `  - "${l}": ${desc}` : `  - "${l}"`;
      })
      .join("\n");

    const multiNote = opts.multiLabel
      ? 'You may return multiple labels if the text fits more than one.'
      : 'Return exactly one label — the best match.';

    const prompt = `Classify the following text into one of these labels:
${labelList}

${multiNote}

Respond with ONLY valid JSON in this exact shape:
{"label":"<primary_label>","scores":[{"label":"<label>","score":<0-1>},...]}

TEXT:
${text}`;

    const messages = this.buildMessages(prompt, options?.systemPrompt);
    const response = await this.provider.chat(messages, {
      temperature: 0.1,
      maxTokens: 256,
      ...this.defaultOptions,
      ...options,
    });

    // Parse the JSON; fall back to a safe default if the model misbehaves
    try {
      const parsed = JSON.parse(response.text) as ClassifyResult;
      return parsed;
    } catch {
      // Mock or malformed response — return first label as fallback
      return {
        label: opts.labels[0] ?? "unknown",
        scores: opts.labels.map((l, i) => ({
          label: l,
          score: i === 0 ? 1 : 0,
        })),
      };
    }
  }

  // ─── 4. extractStructuredData ───────────────────────────────────────────────

  /**
   * Extract typed fields from a document (PDF text, email body, form scan, etc.).
   *
   * @param documentText  Raw text of the document
   * @param schema        Field definitions with names, descriptions, and types
   * @param options       Per-request overrides
   */
  async extractStructuredData<T = Record<string, unknown>>(
    documentText: string,
    schema: ExtractionSchema,
    options?: AiRequestOptions
  ): Promise<ExtractionResult<T>> {
    const fieldList = Object.entries(schema.fields)
      .map(([name, def]) => `  - "${name}" (${def.type}): ${def.description}`)
      .join("\n");

    const prompt = `Extract the following fields from the document below.
Return ONLY valid JSON — no prose, no markdown code fences.

Fields to extract:
${fieldList}

If a field cannot be found or inferred, set its value to null and include the field name in the "missingFields" array.

Response shape:
{
  "data": { <field_name>: <value>, ... },
  "missingFields": ["<field_name>", ...]
}

DOCUMENT:
${documentText}`;

    const messages = this.buildMessages(prompt, options?.systemPrompt);
    const response = await this.provider.chat(messages, {
      temperature: 0.1,
      maxTokens: 1024,
      ...this.defaultOptions,
      ...options,
    });

    try {
      const parsed = JSON.parse(response.text) as { data: T; missingFields: string[] };
      return {
        data: parsed.data,
        missingFields: parsed.missingFields ?? [],
        sourceText: documentText,
      };
    } catch {
      // Return empty extraction on parse failure
      return {
        data: {} as T,
        missingFields: Object.keys(schema.fields),
        sourceText: documentText,
      };
    }
  }

  // ─── 5. callWithFunctions ───────────────────────────────────────────────────

  /**
   * Agentic function-calling loop.
   *
   * Sends the prompt to the model with the provided tools registered.
   * If the model requests tool calls, executes them in parallel, appends the
   * results, and re-calls the model.  Repeats until the model produces a final
   * text response or the max-iterations limit is reached.
   *
   * @param prompt      The user instruction
   * @param tools       FunctionTool[] — each has name, description, parameters, execute()
   * @param options     Per-request overrides
   * @param maxIter     Safety limit on agentic loop iterations (default: 5)
   */
  async callWithFunctions(
    prompt: string,
    tools: FunctionTool[],
    options?: AiRequestOptions,
    maxIter = 5
  ): Promise<AiResponse & { allToolResults: FunctionCallResult[] }> {
    const messages: ChatMessage[] = this.buildMessages(
      prompt,
      options?.systemPrompt
    );

    const allToolResults: FunctionCallResult[] = [];
    let lastResponse: AiResponse | null = null;
    let iterations = 0;

    while (iterations < maxIter) {
      iterations++;

      const response = await this.provider.chat(messages, {
        ...this.defaultOptions,
        ...options,
        tools,
        toolChoice: options?.toolChoice ?? "auto",
      });

      lastResponse = response;

      // No tool calls — model produced a final answer
      if (!response.toolCalls || response.toolCalls.length === 0) {
        break;
      }

      // Append the assistant's tool-call turn to the conversation
      messages.push({
        role: "assistant",
        content: response.text || "",
        tool_calls: response.toolCalls,
      });

      // Execute all requested tool calls in parallel
      const results = await Promise.all(
        response.toolCalls.map(async (call): Promise<FunctionCallResult> => {
          const tool = tools.find((t) => t.name === call.function.name);
          if (!tool) {
            return {
              tool_call_id: call.id,
              name: call.function.name,
              result: null,
              error: `Unknown tool: ${call.function.name}`,
            };
          }

          try {
            const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
            const result = await tool.execute(args);
            return { tool_call_id: call.id, name: call.function.name, result };
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            return {
              tool_call_id: call.id,
              name: call.function.name,
              result: null,
              error,
            };
          }
        })
      );

      allToolResults.push(...results);

      // Append tool results to the conversation
      for (const r of results) {
        messages.push({
          role: "tool",
          tool_call_id: r.tool_call_id,
          content: r.error
            ? `Error: ${r.error}`
            : JSON.stringify(r.result),
        });
      }
    }

    if (!lastResponse) {
      throw new Error("[AiService] callWithFunctions produced no response");
    }

    return {
      ...lastResponse,
      toolResults: allToolResults,
      allToolResults,
    };
  }
}
