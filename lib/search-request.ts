export class SearchRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function readSearchQuery(request: Request): Promise<string> {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new SearchRequestError(403, "Cross-site searches are not permitted.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new SearchRequestError(415, "Use an application/json request.");
  }
  const maximum = 4096;
  if (Number(request.headers.get("content-length")) > maximum) throw new SearchRequestError(413, "Request body too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new SearchRequestError(400, "Invalid JSON body.");
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        throw new SearchRequestError(413, "Request body too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new SearchRequestError(400, "Invalid JSON body."); }
  const query = typeof body === "object" && body !== null && !Array.isArray(body) && "query" in body && typeof body.query === "string"
    ? body.query.trim() : "";
  if (!query || query.length > 500) throw new SearchRequestError(400, "Query must contain 1 to 500 characters.");
  return query;
}
