import { bookById } from "@/data/books";
import { demoSearches } from "@/data/demo-searches";
import type { Book, DemoSearch } from "@/lib/types";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export function matchDemoSearch(input: string): DemoSearch | null {
  const query = normalize(input);
  if (!query) return null;

  return demoSearches.find((demo) => {
    const phrases = [demo.query, ...demo.aliases].map(normalize);
    return phrases.some((phrase) => query.includes(phrase) || phrase.includes(query)) ||
      demo.aliases.map(normalize).filter((term) => query.includes(term)).length >= 2;
  }) ?? null;
}

export function getResults(search: DemoSearch): Book[] {
  return search.resultIds.flatMap((id) => {
    const book = bookById.get(id);
    return book ? [book] : [];
  });
}
