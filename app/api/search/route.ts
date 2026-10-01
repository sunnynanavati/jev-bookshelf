import { NextResponse } from "next/server";
import { bookById } from "@/data/books";
import { getResults, matchDemoSearch } from "@/lib/search";
import { searchBooksWithJev } from "@/lib/jev-search";
import { checkSearchRateLimit } from "@/lib/rate-limit";
import { readSearchQuery, SearchRequestError } from "@/lib/search-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let query: string;

  try {
    query = await readSearchQuery(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof SearchRequestError ? error.message : "Invalid request." }, {
      status: error instanceof SearchRequestError ? error.status : 400,
    });
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  try {
    const limit = await checkSearchRateLimit(request, Boolean(apiKey));
    if (!limit.allowed) return NextResponse.json({ error: "Too many searches. Please try again later." }, {
      status: 429, headers: { "Retry-After": String(limit.retryAfter) },
    });
  } catch {
    console.error("Search protection unavailable; request blocked.");
    return NextResponse.json({ error: "Search is temporarily unavailable. Please try again later." }, { status: 503 });
  }

  if (!apiKey) {
    const demo = matchDemoSearch(query);
    return NextResponse.json({
      mode: "demo",
      results: demo ? getResults(demo).map((book) => ({ book, probability: null })) : [],
    });
  }

  try {
    const results = await searchBooksWithJev(query, apiKey);
    return NextResponse.json({
      mode: "jev",
      results: results.flatMap(({ id, probability }) => {
        const book = bookById.get(id);
        return book ? [{ book, probability }] : [];
      }),
    });
  } catch {
    // SDK errors can contain request data or credentials; don't log them verbatim.
    console.error("Jev search failed.");
    return NextResponse.json({ error: "Jev search is temporarily unavailable." }, { status: 502 });
  }
}
