import { describe, expect, it } from "vitest";
import { getResults, matchDemoSearch } from "@/lib/search";

describe("curated search", () => {
  it("matches the natural-language Snape query", () => {
    const match = matchDemoSearch("harry potter books which have severus");
    expect(match?.id).toBe("snape");
    expect(match && getResults(match)).toHaveLength(5);
  });

  it("matches the other supported themes", () => {
    expect(matchDemoSearch("dystopian surveillance books")?.id).toBe("surveillance");
    expect(matchDemoSearch("novels with an unreliable narrator")?.id).toBe("unreliable");
  });

  it("returns null for unsupported searches", () => {
    expect(matchDemoSearch("cookbooks about pasta")).toBeNull();
    expect(matchDemoSearch(" ")).toBeNull();
  });
});
