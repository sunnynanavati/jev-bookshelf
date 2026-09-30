import { catalogBooks } from "@/data/books";
import { matchDemoSearch } from "@/lib/search";
import type { CatalogBook } from "@/lib/types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "about", "book", "books", "by", "for", "from", "in", "is",
  "of", "on", "or", "that", "the", "to", "which", "who", "with",
]);

const SYNONYMS: Record<string, string[]> = {
  biography: ["memoir"],
  biographies: ["memoir"],
  memoir: ["biography"],
  dystopia: ["dystopian"],
  dystopian: ["dystopia"],
  scifi: ["science", "fiction"],
  sci: ["science", "fiction"],
  wellbeing: ["wellness", "health"],
  wellness: ["wellbeing", "health"],
};

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/sci[\s-]?fi/g, "scifi")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularize(token: string) {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function tokenize(value: string) {
  const base = normalizeSearchText(value)
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .map(singularize);
  return [...new Set(base.flatMap((token) => [token, ...(SYNONYMS[token] ?? [])]))];
}

type SearchDocument = {
  book: CatalogBook;
  title: string;
  author: string;
  people: string[];
  titleTokens: string[];
  authorTokens: string[];
  peopleTokens: string[];
  genreTokens: string[];
  subjectTokens: string[];
  placeTokens: string[];
};

function makeDocument(book: CatalogBook): SearchDocument {
  return {
    book,
    title: normalizeSearchText(book.title),
    author: normalizeSearchText(book.author),
    people: book.people.map(normalizeSearchText),
    titleTokens: tokenize(book.title),
    authorTokens: tokenize(book.author),
    peopleTokens: tokenize(book.people.join(" ")),
    genreTokens: tokenize(book.genres.join(" ")),
    subjectTokens: tokenize(book.subjects.join(" ")),
    placeTokens: tokenize(book.places.join(" ")),
  };
}

const searchIndex = catalogBooks.map(makeDocument);

function tokenScore(queryTokens: string[], fieldTokens: string[], weight: number) {
  let score = 0;
  for (const queryToken of queryTokens) {
    if (fieldTokens.includes(queryToken)) {
      score += weight;
      continue;
    }
    if (queryToken.length >= 4 && fieldTokens.some((token) => token.startsWith(queryToken))) {
      score += weight / 2;
    }
  }
  return score;
}

function relevanceScore(document: SearchDocument, query: string, queryTokens: string[]) {
  let score = 0;
  if (document.title && (query.includes(document.title) || document.title.includes(query))) score += 30;
  if (document.author && (query.includes(document.author) || document.author.includes(query))) score += 25;
  if (document.people.some((person) => person && (query.includes(person) || person.includes(query)))) score += 20;
  score += tokenScore(queryTokens, document.titleTokens, 10);
  score += tokenScore(queryTokens, document.authorTokens, 8);
  score += tokenScore(queryTokens, document.peopleTokens, 7);
  score += tokenScore(queryTokens, document.genreTokens, 6);
  score += tokenScore(queryTokens, document.subjectTokens, 4);
  score += tokenScore(queryTokens, document.placeTokens, 3);
  return score;
}

function comparePopularity(left: CatalogBook, right: CatalogBook) {
  return right.popularity.score - left.popularity.score || left.id.localeCompare(right.id);
}

export function retrieveCandidates(query: string, limit = 100): CatalogBook[] {
  const cappedLimit = Math.max(1, Math.min(limit, catalogBooks.length));
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenize(normalizedQuery);
  const demo = matchDemoSearch(query);
  const forcedIds = demo?.resultIds ?? [];
  const forcedIdSet = new Set(forcedIds);

  const lexical = searchIndex
    .map((document) => ({ document, score: relevanceScore(document, normalizedQuery, queryTokens) }))
    .filter(({ score, document }) => score > 0 && !forcedIdSet.has(document.book.id))
    .sort((left, right) =>
      right.score - left.score ||
      comparePopularity(left.document.book, right.document.book),
    )
    .map(({ document }) => document.book);

  const selected: CatalogBook[] = forcedIds.flatMap((id) => {
    const match = catalogBooks.find((book) => book.id === id);
    return match ? [match] : [];
  });
  const selectedIds = new Set(selected.map((book) => book.id));

  for (const book of lexical) {
    if (selected.length >= cappedLimit) break;
    if (!selectedIds.has(book.id)) {
      selected.push(book);
      selectedIds.add(book.id);
    }
  }

  if (selected.length < cappedLimit) {
    const fiction = catalogBooks.filter((book) => book.collection === "fiction").sort(comparePopularity);
    const nonfiction = catalogBooks.filter((book) => book.collection === "nonfiction").sort(comparePopularity);
    let fictionIndex = 0;
    let nonfictionIndex = 0;
    let nextCollection: "fiction" | "nonfiction" = "fiction";

    while (selected.length < cappedLimit && (fictionIndex < fiction.length || nonfictionIndex < nonfiction.length)) {
      const pool = nextCollection === "fiction" ? fiction : nonfiction;
      let index = nextCollection === "fiction" ? fictionIndex : nonfictionIndex;
      while (index < pool.length && selectedIds.has(pool[index].id)) index += 1;
      if (nextCollection === "fiction") fictionIndex = index + 1;
      else nonfictionIndex = index + 1;
      const book = pool[index];
      if (book) {
        selected.push(book);
        selectedIds.add(book.id);
      }
      nextCollection = nextCollection === "fiction" ? "nonfiction" : "fiction";
    }
  }

  return selected.slice(0, cappedLimit);
}
