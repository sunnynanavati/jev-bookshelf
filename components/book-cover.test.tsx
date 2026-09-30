import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookCover } from "@/components/book-cover";
import { bookById } from "@/data/books";

describe("BookCover hover metadata", () => {
  it("renders title, author, and publication year as separate metadata lines", () => {
    const book = bookById.get("nineteen-eighty-four");
    expect(book).toBeDefined();

    render(<BookCover book={book!} index={0} reducedMotion />);

    const metadata = screen.getByText((_, element) =>
      element?.classList.contains("book-result-metadata") ?? false,
    );
    expect(metadata.querySelector(".book-result-title")).toHaveTextContent("Nineteen Eighty-Four");
    expect(metadata.querySelector(".book-result-author")).toHaveTextContent("George Orwell");
    expect(metadata.querySelector(".book-result-year")).toHaveTextContent("1949");
  });
});
