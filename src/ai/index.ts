/**
 * server/ai/index.ts
 *
 * Singleton factory for the shared AiService.
 *
 * Provider selection (read once at startup):
 *
 *   AI_PROVIDER      | Behaviour
 *   -----------------|---------------------------------------------------------
 *   "manus" (default)| Uses Manus Forge API (no extra key needed — platform injects creds)
 *   "openai"         | Uses OpenAI via AI_API_KEY + optional AI_BASE_URL
 *   "azure"          | Uses Azure OpenAI via AI_API_KEY + AI_BASE_URL (required)
 *   "custom"         | Any OpenAI-compatible endpoint via AI_API_KEY + AI_BASE_URL
 *   unset / "mock"   | Mock provider — deterministic canned responses, no key needed
 *
 *   AI_API_KEY       — Bearer token for openai/azure/custom providers
 *   AI_BASE_URL      — Base URL override (default: https://api.openai.com/v1)
 *   AI_DEFAULT_MODEL — Default model name (default: gpt-4o-mini)
 *
 * Usage (anywhere in server code):
 *   import { getAiService } from "../ai";
 *   const ai = getAiService();
 *   const response = await ai.generateText("Summarise this leave request...");
 */

import { AiService } from "./service";
import { ManusForgeProvider } from "./providers/manusForge";
import { MockProvider } from "./providers/mock";
import { OpenAiProvider } from "./providers/openai";
import type { AiProvider, AiServiceConfig } from "./types";

// ─── Factory ──────────────────────────────────────────────────────────────────

function createProvider(): AiProvider {
  const providerName = (process.env.AI_PROVIDER ?? "manus").toLowerCase().trim();
  const apiKey = process.env.AI_API_KEY ?? "";
  const baseUrl = process.env.AI_BASE_URL;
  const defaultModel = process.env.AI_DEFAULT_MODEL;

  switch (providerName) {
    case "manus":
    case "forge":
    case "manus-forge":
      // Manus built-in — no key needed
      return new ManusForgeProvider(defaultModel);

    case "openai":
      if (!apiKey) {
        console.warn("[AI] AI_PROVIDER=openai but AI_API_KEY is not set — falling back to mock");
        return new MockProvider();
      }
      return new OpenAiProvider({
        apiKey,
        baseUrl: baseUrl ?? "https://api.openai.com/v1",
        defaultModel: defaultModel ?? "gpt-4o-mini",
      });

    case "azure":
      if (!apiKey || !baseUrl) {
        console.warn("[AI] AI_PROVIDER=azure requires both AI_API_KEY and AI_BASE_URL — falling back to mock");
        return new MockProvider();
      }
      return new OpenAiProvider({ apiKey, baseUrl, defaultModel: defaultModel ?? "gpt-4" });

    case "custom":
      if (!apiKey || !baseUrl) {
        console.warn("[AI] AI_PROVIDER=custom requires both AI_API_KEY and AI_BASE_URL — falling back to mock");
        return new MockProvider();
      }
      return new OpenAiProvider({ apiKey, baseUrl, defaultModel: defaultModel ?? "gpt-4o-mini" });

    case "mock":
    default:
      if (providerName !== "mock") {
        console.warn(`[AI] Unknown AI_PROVIDER="${providerName}" — using mock provider`);
      }
      return new MockProvider();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: AiService | null = null;

/**
 * Returns the shared AiService singleton.
 * The provider is resolved once from environment variables.
 * Safe to call from any server-side code.
 */
export function getAiService(): AiService {
  if (!_instance) {
    const provider = createProvider();

    const config: AiServiceConfig = {
      provider,
      defaults: {
        temperature: 0.3,
        maxTokens: 1024,
      },
    };

    _instance = new AiService(config);

    console.log(`[AI] Service initialised — provider: ${provider.name}, model: ${provider.defaultModel}`);
  }
  return _instance;
}

/**
 * Reset the singleton (used in tests to force re-initialisation with different env vars).
 */
export function resetAiService(): void {
  _instance = null;
}

// Re-export everything modules need
export { AiService } from "./service";
export { ALL_HCM_TOOLS, HCM_TOOLS } from "./functions/hcmTools";
export type {
  AiProvider,
  AiRequestOptions,
  AiResponse,
  ChatMessage,
  ClassifyOptions,
  ClassifyResult,
  ExtractionResult,
  ExtractionSchema,
  FunctionCallResult,
  FunctionTool,
} from "./types";
