import { describe, expect, it } from "vitest";
import { candidateProblem, selectCatalog, validateCatalog } from "./build-catalog.mjs";

const genreDefinitions = [
  ["fiction", "literary-contemporary"],
  ["fiction", "mystery-thriller"],
  ["fiction", "fantasy"],
  ["fiction", "science-fiction"],
  ["fiction", "romance"],
  ["fiction", "horror"],
  ["fiction", "historical-fiction"],
  ["fiction", "young-adult"],
  ["fiction", "children-middle-grade"],
  ["fiction", "graphic-fiction"],
  ["nonfiction", "biography-memoir"],
  ["nonfiction", "history"],
  ["nonfiction", "science-nature"],
  ["nonfiction", "technology"],
  ["nonfiction", "psychology"],
  ["nonfiction", "philosophy"],
  ["nonfiction", "business-economics"],
  ["nonfiction", "politics-society"],
  ["nonfiction", "health-wellbeing"],
  ["nonfiction", "essays-travel-true-crime"],
];

function candidate(collection, genre, suffix, work = `/works/${suffix}`) {
  return {
    id: `book-${suffix}`,
    title: `Book ${suffix}`,
    author: `Author ${suffix}`,
    firstPublished: 2020,
    subjects: [genre],
    coverId: 1000,
    isbn: null,
    openLibraryKey: work,
    curated: false,
    collection,
    genres: [genre],
    people: [],
    places: [],
    popularity: { ratings: 10, readingLog: 20, wantToRead: 30, editions: 2, score: 10 },
  };
}

function completeCandidatePool() {
  return new Map(genreDefinitions.map(([collection, genre], index) => [
    genre,
    [candidate(collection, genre, `${index}-primary`), candidate(collection, genre, `${index}-reserve`)],
  ]));
}

describe("catalog builder", () => {
  it("rejects derivatives and non-English-script records", () => {
    const source = { collection: "fiction", genre: "fantasy" };
    const base = {
      key: "/works/OL1W",
      title: "A Real Book",
      author_name: ["A Real Author"],
      cover_i: 1,
      first_publish_year: 2020,
      subject: ["Fiction"],
    };

    expect(candidateProblem({ ...base, title: "A Real Book Study Guide" }, source)).toBe(
      "companion-or-collection",
    );
    expect(candidateProblem({ ...base, title: "三体" }, source)).toBe("non-english-script");
  });

  it("selects deterministically and collapses duplicate works", () => {
    const pool = completeCandidatePool();
    const duplicate = candidate("fiction", "mystery-thriller", "duplicate", "/works/0-primary");
    pool.get("mystery-thriller").unshift(duplicate);

    const first = selectCatalog([], pool, 20).catalog;
    const second = selectCatalog([], pool, 20).catalog;

    expect(first.map((book) => book.id)).toEqual(second.map((book) => book.id));
    expect(first).toHaveLength(20);
    expect(new Set(first.map((book) => book.openLibraryKey)).size).toBe(20);
  });

  it("fails validation when a balanced category is missing", () => {
    const catalog = selectCatalog([], completeCandidatePool(), 20).catalog;
    catalog[0] = { ...catalog[0], genres: ["fantasy"] };

    expect(() => validateCatalog(catalog, 20)).toThrow(/literary-contemporary count/);
  });
});
