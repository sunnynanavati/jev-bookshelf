import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jev-search", () => ({
  searchBooksWithJev: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ checkSearchRateLimit: vi.fn() }));

import { searchBooksWithJev } from "@/lib/jev-search";
import { POST } from "@/app/api/search/route";
import { checkSearchRateLimit } from "@/lib/rate-limit";
import { beforeEach } from "vitest";

beforeEach(() => vi.mocked(checkSearchRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 }));

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
  vi.mocked(checkSearchRateLimit).mockReset();
  if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalApiKey;
});

describe("POST /api/search", () => {
  it.each([null, 1, {}, [], "", "a".repeat(501)])("rejects invalid query %j before Jev", async (query) => {
    const response = await POST(new Request("http://localhost/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }));
    expect(response.status).toBe(400);
    expect(mockedSearch).not.toHaveBeenCalled();
  });
  it.each([
    [{ "Content-Type": "application/json", Origin: "https://attacker.example" }, '{"query":"books"}', 403],
    [{ "Content-Type": "text/plain" }, '{"query":"books"}', 415],
    [{ "Content-Type": "application/json" }, '{broken', 400],
    [{ "Content-Type": "application/json" }, " ".repeat(4097), 413],
  ])("rejects unsafe requests", async (headers, body, status) => {
    const response = await POST(new Request("http://localhost/api/search", { method: "POST", headers, body }));
    expect(response.status).toBe(status);
    expect(mockedSearch).not.toHaveBeenCalled();
  });
  it("returns Retry-After without calling Jev when limited", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    vi.mocked(checkSearchRateLimit).mockResolvedValue({ allowed: false, retryAfter: 42 });
    const response = await POST(searchRequest("books"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(mockedSearch).not.toHaveBeenCalled();
  });
  it("fails closed when protection fails", async () => {
    vi.mocked(checkSearchRateLimit).mockRejectedValue(new Error("secret store detail"));
    const response = await POST(searchRequest("books"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(mockedSearch).not.toHaveBeenCalled();
  });
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
