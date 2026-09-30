import { describe, expect, it } from "vitest";
import catalog from "@/data/catalog.json";
import { demoSearches } from "@/data/demo-searches";
import type { CatalogBook } from "@/lib/types";

const books = catalog as CatalogBook[];

describe("book catalog", () => {
  it("contains 1,000 uniquely identified Open Library works", () => {
    expect(books).toHaveLength(1_000);
    expect(new Set(books.map((book) => book.id)).size).toBe(1_000);
    expect(new Set(books.map((book) => book.openLibraryKey)).size).toBe(1_000);
  });

  it("has an even fiction and nonfiction split across 20 balanced genres", () => {
    expect(books.filter((book) => book.collection === "fiction")).toHaveLength(500);
    expect(books.filter((book) => book.collection === "nonfiction")).toHaveLength(500);

    const genreCounts = books.reduce<Record<string, number>>((counts, book) => {
      for (const genre of book.genres) {
        counts[genre] = (counts[genre] ?? 0) + 1;
      }
      return counts;
    }, {});

    expect(Object.keys(genreCounts)).toHaveLength(20);
    expect(Object.values(genreCounts).every((count) => count === 50)).toBe(true);
  });

  it("meets cover, recency, and author-diversity requirements", () => {
    expect(books.filter((book) => book.coverId).length / books.length).toBeGreaterThanOrEqual(0.99);
    expect(
      books.filter((book) => (book.firstPublished ?? 0) >= 1980).length / books.length,
    ).toBeGreaterThanOrEqual(0.65);
    expect(
      books.filter((book) => (book.firstPublished ?? 0) >= 2000).length / books.length,
    ).toBeGreaterThanOrEqual(0.4);

    const authorCounts = books.reduce<Record<string, number>>((counts, book) => {
      counts[book.author] = (counts[book.author] ?? 0) + 1;
      return counts;
    }, {});

    expect(Math.max(...Object.values(authorCounts))).toBeLessThanOrEqual(8);
  });

  it("preserves every curated demo result", () => {
    const ids = new Set(books.map((book) => book.id));

    for (const id of demoSearches.flatMap((demo) => demo.resultIds)) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
