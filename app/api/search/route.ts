import { NextResponse } from "next/server";
import { bookById } from "@/data/books";
import { getResults, matchDemoSearch } from "@/lib/search";
import { searchBooksWithJev } from "@/lib/jev-search";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = typeof body === "object" && body !== null && "query" in body
    ? String(body.query).trim()
    : "";

  if (!query || query.length > 500) {
    return NextResponse.json({ error: "Query must contain 1 to 500 characters." }, { status: 400 });
  }

  const apiKey = process.env.TYPESAFE_API_KEY;

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
  } catch (error) {
    console.error("Jev search failed", error);
    return NextResponse.json({ error: "Jev search is temporarily unavailable." }, { status: 502 });
  }
}
