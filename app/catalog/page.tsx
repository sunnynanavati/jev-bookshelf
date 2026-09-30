import type { Metadata } from "next";
import Link from "next/link";
import { CatalogCover } from "@/app/catalog/catalog-cover";
import { bookById, catalogBooks } from "@/data/books";

export const metadata: Metadata = {
  title: "Cover Catalog | Jev Bookshelf",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 100;

type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function pageHref(
  page: number,
  values: { q: string; collection: string; genre: string; decade: string },
) {
  const parameters = new URLSearchParams();
  if (values.q) parameters.set("q", values.q);
  if (values.collection) parameters.set("collection", values.collection);
  if (values.genre) parameters.set("genre", values.genre);
  if (values.decade) parameters.set("decade", values.decade);
  parameters.set("page", String(page));
  return `/catalog?${parameters}`;
}

export default async function CatalogPage({ searchParams }: { searchParams: CatalogSearchParams }) {
  const parameters = await searchParams;
  const q = first(parameters.q).trim().toLowerCase();
  const collection = first(parameters.collection);
  const genre = first(parameters.genre);
  const decade = first(parameters.decade);
  const requestedPage = Number(first(parameters.page) || "1");
  const genres = [...new Set(catalogBooks.flatMap((book) => book.genres))].sort();

  const filtered = catalogBooks.filter((book) => {
    const text = `${book.title} ${book.author} ${book.subjects.join(" ")}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (collection && book.collection !== collection) return false;
    if (genre && !book.genres.includes(genre)) return false;
    if (decade === "2000" && (!book.firstPublished || book.firstPublished < 2000)) return false;
    if (decade === "1980" && (!book.firstPublished || book.firstPublished < 1980 || book.firstPublished >= 2000)) return false;
    if (decade === "1950" && (!book.firstPublished || book.firstPublished < 1950 || book.firstPublished >= 1980)) return false;
    if (decade === "pre1950" && (!book.firstPublished || book.firstPublished >= 1950)) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Number.isFinite(requestedPage)
    ? Math.min(pageCount, Math.max(1, Math.trunc(requestedPage)))
    : 1;
  const visibleEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleBooks = visibleEntries.flatMap((entry) => {
    const book = bookById.get(entry.id);
    return book ? [book] : [];
  });
  const coverCount = catalogBooks.filter((book) => book.coverId).length;
  const values = { q: first(parameters.q).trim(), collection, genre, decade };

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <div>
          <p>Development view</p>
          <h1>Cover catalog</h1>
        </div>
        <div className="catalog-summary">
          <span>{catalogBooks.length} books</span>
          <span>{coverCount} covers</span>
          <span>{catalogBooks.length - coverCount} fallbacks</span>
        </div>
        <Link href="/">Back to search</Link>
      </header>

      <form className="catalog-filters" action="/catalog">
        <label>
          <span>Search</span>
          <input name="q" defaultValue={values.q} placeholder="Title, author, or subject" />
        </label>
        <label>
          <span>Collection</span>
          <select name="collection" defaultValue={collection}>
            <option value="">All</option>
            <option value="fiction">Fiction</option>
            <option value="nonfiction">Nonfiction</option>
          </select>
        </label>
        <label>
          <span>Genre</span>
          <select name="genre" defaultValue={genre}>
            <option value="">All</option>
            {genres.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Published</span>
          <select name="decade" defaultValue={decade}>
            <option value="">Any year</option>
            <option value="2000">2000–present</option>
            <option value="1980">1980–1999</option>
            <option value="1950">1950–1979</option>
            <option value="pre1950">Before 1950</option>
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>

      <div className="catalog-results-summary">
        <span>{filtered.length} matching books</span>
        <span>Page {page} of {pageCount}</span>
      </div>

      <section className="catalog-grid" aria-label="Book cover audit">
        {visibleBooks.map((book) => <CatalogCover book={book} key={book.id} />)}
      </section>

      <nav className="catalog-pagination" aria-label="Catalog pagination">
        {page > 1
          ? <Link href={pageHref(page - 1, values)}>Previous</Link>
          : <span aria-disabled="true">Previous</span>}
        <span>{page} / {pageCount}</span>
        {page < pageCount
          ? <Link href={pageHref(page + 1, values)}>Next</Link>
          : <span aria-disabled="true">Next</span>}
      </nav>

      <footer className="catalog-footer">
        Cover images provided by <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>.
      </footer>
    </main>
  );
}
