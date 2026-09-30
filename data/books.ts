import catalog from "@/data/catalog.json";
import type { Book, CatalogBook, Material } from "@/lib/types";

const palette = [
  ["#173e54", "#e7dfc9", "#b99352", "cloth"],
  ["#704039", "#f2e9d6", "#c9a869", "linen"],
  ["#334d36", "#eee7d5", "#a98f55", "cloth"],
  ["#26272b", "#f0eadc", "#a8a39a", "leather"],
  ["#8e3d2f", "#f4ead6", "#d2a25e", "cloth"],
  ["#5d5575", "#eee8da", "#b6a66a", "linen"],
  ["#a36a36", "#f8eed9", "#6b3b26", "paper"],
  ["#284a63", "#eef0e8", "#bec5c8", "leather"],
] as const;

const makeMark = (title: string) => title
  .replace(/^(a|an|the)\s+/i, "")
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 3)
  .map((word) => word[0])
  .join("")
  .toUpperCase();

export const catalogBooks: CatalogBook[] = (catalog as Partial<CatalogBook>[]).map((entry) => ({
  id: entry.id ?? "",
  title: entry.title ?? "Untitled",
  author: entry.author ?? "Unknown author",
  firstPublished: entry.firstPublished ?? null,
  subjects: entry.subjects ?? [],
  coverId: entry.coverId ?? null,
  isbn: entry.isbn ?? null,
  openLibraryKey: entry.openLibraryKey ?? null,
  curated: entry.curated ?? false,
  collection: entry.collection ?? "fiction",
  genres: entry.genres ?? [],
  people: entry.people ?? [],
  places: entry.places ?? [],
  popularity: entry.popularity ?? { ratings: 0, readingLog: 0, wantToRead: 0, editions: 0, score: 0 },
}));

export const books: Book[] = catalogBooks.map((entry, index) => {
  const [color, ink, accent, material] = palette[index % palette.length];
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    firstPublished: entry.firstPublished,
    coverId: entry.coverId,
    isbn: entry.isbn,
    openLibraryKey: entry.openLibraryKey,
    mark: makeMark(entry.title),
    color,
    ink,
    accent,
    material: material as Material,
    height: 174 + ((index * 17) % 54),
    width: 37 + ((index * 13) % 24),
  };
});

export const bookById = new Map(books.map((book) => [book.id, book]));

export const catalogBookById = new Map(catalogBooks.map((book) => [book.id, book]));
