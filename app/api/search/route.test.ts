import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jev-search", () => ({
  searchBooksWithJev: vi.fn(),
}));

import { searchBooksWithJev } from "@/lib/jev-search";
import { POST } from "@/app/api/search/route";

const originalApiKey = process.env.TYPESAFE_API_KEY;
const mockedSearch = vi.mocked(searchBooksWithJev);

function searchRequest(query: string) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

afterEach(() => {
  mockedSearch.mockReset();
  if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalApiKey;
});

describe("POST /api/search", () => {
  it("returns display-ready books for offline demos", async () => {
    delete process.env.TYPESAFE_API_KEY;

    const response = await POST(searchRequest("Harry Potter books featuring Severus Snape"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("demo");
    expect(payload.results).toHaveLength(5);
    expect(payload.results[0]).toMatchObject({
      book: {
        id: "philosophers-stone",
        title: expect.any(String),
        firstPublished: expect.any(Number),
      },
      probability: null,
    });
  });

  it("hydrates Jev rankings into the new response contract", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    mockedSearch.mockResolvedValue([
      { id: "nineteen-eighty-four", probability: 0.81 },
      { id: "unknown-book", probability: 0.19 },
    ]);

    const response = await POST(searchRequest("surveillance dystopia"));
    const payload = await response.json();

    expect(mockedSearch).toHaveBeenCalledWith("surveillance dystopia", "test-key");
    expect(payload).toMatchObject({
      mode: "jev",
      results: [{ book: { id: "nineteen-eighty-four" }, probability: 0.81 }],
    });
  });
});
