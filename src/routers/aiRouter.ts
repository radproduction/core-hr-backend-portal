/**
 * server/routers/aiRouter.ts
 *
 * tRPC router that exposes the shared AI service for testing and future
 * module consumption.  All procedures are protected (require auth).
 *
 * Endpoints:
 *   ai.status            — provider info + mock flag (GET, no body)
 *   ai.generateText      — open-ended text generation
 *   ai.summarize         — condense text into N sentences
 *   ai.classify          — assign labels to text
 *   ai.extractData       — extract typed fields from a document
 *   ai.callWithFunctions — agentic loop with built-in CORE HR tools
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAiService, ALL_HCM_TOOLS } from "../ai";

// ─── Shared input schemas ─────────────────────────────────────────────────────

const requestOptionsSchema = z
  .object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(8192).optional(),
    systemPrompt: z.string().optional(),
  })
  .optional();

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiRouter = router({
  /**
   * GET /api/trpc/ai.status
   * Returns provider name, default model, and whether mock mode is active.
   * Use this to confirm the AI service is wired up correctly.
   */
  status: protectedProcedure.query(() => {
    const ai = getAiService();
    return {
      provider: ai.providerName,
      defaultModel: ai.defaultModel,
      isMock: ai.isMockProvider,
      availableTools: ALL_HCM_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    };
  }),

  /**
   * POST /api/trpc/ai.generateText
   * Open-ended text generation.
   */
  generateText: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1).max(8000),
        options: requestOptionsSchema,
      })
    )
    .mutation(async ({ input }) => {
      const ai = getAiService();
      const response = await ai.generateText(input.prompt, input.options);
      return {
        text: response.text,
        model: response.model,
        isMock: response.isMock,
        usage: response.usage,
      };
    }),

  /**
   * POST /api/trpc/ai.summarize
   * Condense a long text into a concise summary.
   */
  summarize: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(32000),
        maxSentences: z.number().int().min(1).max(20).optional().default(3),
        options: requestOptionsSchema,
      })
    )
    .mutation(async ({ input }) => {
      const ai = getAiService();
      const response = await ai.summarize(input.text, input.maxSentences, input.options);
      return {
        summary: response.text,
        model: response.model,
        isMock: response.isMock,
        usage: response.usage,
      };
    }),

  /**
   * POST /api/trpc/ai.classify
   * Assign one or more labels to a piece of text.
   */
  classify: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(8000),
        labels: z.array(z.string().min(1)).min(2).max(20),
        labelDescriptions: z.record(z.string(), z.string()).optional(),
        multiLabel: z.boolean().optional().default(false),
        options: requestOptionsSchema,
      })
    )
    .mutation(async ({ input }) => {
      const ai = getAiService();
      const result = await ai.classify(
        input.text,
        {
          labels: input.labels,
          labelDescriptions: input.labelDescriptions,
          multiLabel: input.multiLabel,
        },
        input.options
      );
      return result;
    }),

  /**
   * POST /api/trpc/ai.extractData
   * Extract typed fields from a document string.
   */
  extractData: protectedProcedure
    .input(
      z.object({
        documentText: z.string().min(1).max(32000),
        schema: z.object({
          fields: z.record(
            z.string(),
            z.object({
              description: z.string(),
              type: z.enum(["string", "number", "boolean", "date", "array"]),
            })
          ),
        }),
        options: requestOptionsSchema,
      })
    )
    .mutation(async ({ input }) => {
      const ai = getAiService();
      const result = await ai.extractStructuredData(
        input.documentText,
        input.schema,
        input.options
      );
      return result;
    }),

  /**
   * POST /api/trpc/ai.callWithFunctions
   * Agentic loop: model + built-in CORE HR tools until final answer.
   * The caller selects which tool names to enable for this request.
   */
  callWithFunctions: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1).max(8000),
        /** Names of CORE HR tools to enable (from ALL_HCM_TOOLS). Empty = all tools. */
        toolNames: z.array(z.string()).optional(),
        maxIterations: z.number().int().min(1).max(10).optional().default(5),
        options: requestOptionsSchema,
      })
    )
    .mutation(async ({ input }) => {
      const ai = getAiService();

      const tools =
        input.toolNames && input.toolNames.length > 0
          ? ALL_HCM_TOOLS.filter((t) => input.toolNames!.includes(t.name))
          : ALL_HCM_TOOLS;

      const response = await ai.callWithFunctions(
        input.prompt,
        tools,
        input.options,
        input.maxIterations
      );

      return {
        text: response.text,
        model: response.model,
        isMock: response.isMock,
        usage: response.usage,
        toolResults: response.allToolResults.map((r) => ({
          toolName: r.name,
          result: r.result,
          error: r.error,
        })),
      };
    }),
});
