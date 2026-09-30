import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { retrieveCandidates } from "@/lib/retrieval";

export type RankedBook = {
  id: string;
  probability: number;
};

export function rankBookProbabilities(
  probabilities: Record<string, number>,
  limit = 5,
  allowedIds?: ReadonlySet<string>,
): RankedBook[] {
  return Object.entries(probabilities)
    .filter(([id, probability]) => Number.isFinite(probability) && (!allowedIds || allowedIds.has(id)))
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([id, probability]) => ({ id, probability }));
}

export async function searchBooksWithJev(query: string, apiKey: string): Promise<RankedBook[]> {
  const client = new TypeSafeClient({ apiKey, timeout: 12_000 });
  const candidates = retrieveCandidates(query);
  const candidateIds = new Set(candidates.map((book) => book.id));
  const criteria = Object.fromEntries(
    candidates.map((book) => [
      book.id,
      [
        `${book.title} by ${book.author}`,
        book.firstPublished ? `published ${book.firstPublished}` : "",
        `${book.collection}; ${book.genres.join(", ")}`,
        book.subjects.length ? `subjects: ${book.subjects.slice(0, 7).join(", ")}` : "",
        book.people.length ? `people: ${book.people.slice(0, 5).join(", ")}` : "",
        book.places.length ? `places: ${book.places.slice(0, 3).join(", ")}` : "",
      ].filter(Boolean).join(". "),
    ]),
  );

  const response = await client.systemOne({
    state: {
      reader_request: query,
      task: "Rank the supplied book catalog by relevance to the reader request.",
    },
    questions: {
      most_relevant_book: choice(
        "Which book is the strongest match? Judge themes, characters, plot, genre, and author intent. Return calibrated relevance probabilities across every candidate.",
        criteria,
      ),
    },
  });

  return rankBookProbabilities(response.answers.most_relevant_book.probabilities, 5, candidateIds);
}
