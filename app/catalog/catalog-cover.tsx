"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import { getCoverUrl, getOpenLibraryUrl } from "@/lib/covers";

export function CatalogCover({ book }: { book: Book }) {
  const [failed, setFailed] = useState(false);
  const coverUrl = getCoverUrl(book, "M");

  return (
    <article className="catalog-card">
      <a href={getOpenLibraryUrl(book)} target="_blank" rel="noreferrer" className="catalog-cover-link">
        {coverUrl && !failed ? (
          <img src={coverUrl} alt={`Cover of ${book.title}`} loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <span className="catalog-cover-fallback" style={{ backgroundColor: book.color, color: book.ink }}>
            <strong>{book.title}</strong>
            <small>{book.author}</small>
          </span>
        )}
      </a>
      <div className="catalog-card-copy">
        <h2>{book.title}</h2>
        <p>{book.author}</p>
        <span>{book.coverId && !failed ? `Cover ${book.coverId}` : "Needs cover"}</span>
      </div>
    </article>
  );
}
