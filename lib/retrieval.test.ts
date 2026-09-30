import { describe, expect, it } from "vitest";
import { retrieveCandidates } from "@/lib/retrieval";

describe("retrieveCandidates", () => {
  it("caps candidate sets and returns deterministic results", () => {
    const first = retrieveCandidates("recent philosophical books about meaning");
    const second = retrieveCandidates("recent philosophical books about meaning");

    expect(first).toHaveLength(100);
    expect(second.map((book) => book.id)).toEqual(first.map((book) => book.id));
  });

  it("retrieves exact titles, authors, and prefix matches", () => {
    expect(retrieveCandidates("Never Let Me Go", 20).map((book) => book.id)).toContain(
      "never-let-me-go",
    );
    expect(
      retrieveCandidates("Kazuo Ishiguro", 20).some(
        (book) => book.author === "Kazuo Ishiguro",
      ),
    ).toBe(true);
    expect(
      retrieveCandidates("philosoph", 20).some((book) =>
        book.genres.includes("philosophy"),
      ),
    ).toBe(true);
  });

  it("normalizes diacritics", () => {
    expect(
      retrieveCandidates("Gabriel Garcia Marquez", 20).some(
        (book) => book.author === "Gabriel García Márquez",
      ),
    ).toBe(true);
  });

  it("always injects curated character-search results", () => {
    expect(
      retrieveCandidates("Harry Potter books featuring Severus Snape", 5).map(
        (book) => book.id,
      ),
    ).toEqual([
      "philosophers-stone",
      "chamber-secrets",
      "prisoner-azkaban",
      "goblet-fire",
      "half-blood-prince",
    ]);
  });

  it("uses a balanced popularity fallback for zero-match queries", () => {
    const candidates = retrieveCandidates("qzxvjkl", 100);

    expect(candidates.filter((book) => book.collection === "fiction")).toHaveLength(50);
    expect(candidates.filter((book) => book.collection === "nonfiction")).toHaveLength(50);
  });
});
