import { describe, expect, it } from "vitest";
import { extractUsageMetadata } from "../src/index";

describe("extractUsageMetadata", () => {
  it("omits cost fields when tokens > 0 but pi reports zero cost, so LangSmith prices it", () => {
    const out = extractUsageMetadata({
      role: "assistant",
      usage: {
        input: 2,
        output: 246,
        cacheRead: 2755,
        cacheWrite: 98,
        totalTokens: 3101,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    } as never);

    expect(out).toEqual({
      input_tokens: 2855,
      output_tokens: 246,
      total_tokens: 3101,
      input_token_details: { cache_read: 2755, cache_creation: 98 },
    });
    expect(out).not.toHaveProperty("input_cost");
    expect(out).not.toHaveProperty("output_cost");
    expect(out).not.toHaveProperty("total_cost");
    expect(out).not.toHaveProperty("input_cost_details");
  });
});
