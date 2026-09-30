import { describe, expect, it } from "vitest";
import { rankBookProbabilities } from "@/lib/jev-search";

describe("rankBookProbabilities", () => {
  it("returns the five highest-probability books in order", () => {
    const ranked = rankBookProbabilities({
      a: 0.08,
      b: 0.42,
      c: 0.12,
      d: 0.21,
      e: 0.04,
      f: 0.13,
    });

    expect(ranked.map((book) => book.id)).toEqual(["b", "d", "f", "c", "a"]);
  });

  it("discards IDs that were not in the shortlisted candidates", () => {
    const ranked = rankBookProbabilities(
      { injected: 0.99, known: 0.62 },
      5,
      new Set(["known"]),
    );

    expect(ranked).toEqual([{ id: "known", probability: 0.62 }]);
  });
});
