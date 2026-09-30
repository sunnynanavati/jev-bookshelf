import type { Book } from "@/lib/types";

export function getCoverUrl(book: Pick<Book, "coverId">, size: "M" | "L" = "L") {
  return book.coverId
    ? `https://covers.openlibrary.org/b/id/${book.coverId}-${size}.jpg?default=false`
    : null;
}

export function getOpenLibraryUrl(book: Pick<Book, "openLibraryKey" | "isbn">) {
  if (book.openLibraryKey) return `https://openlibrary.org${book.openLibraryKey}`;
  if (book.isbn) return `https://openlibrary.org/isbn/${book.isbn}`;
  return "https://openlibrary.org";
}

function preloadCover(book: Book) {
  const url = getCoverUrl(book);
  if (!url) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

export async function preloadBookCovers(books: Book[], timeoutMs = 1_500) {
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs));
  const loading = Promise.all(books.map(preloadCover)).then(() => undefined);
  await Promise.race([loading, timeout]);
}
