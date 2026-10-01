import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookCover } from "@/components/book-cover";
import { bookById } from "@/data/books";

describe("BookCover hover metadata", () => {
  afterEach(cleanup);

  const movePointer = (element: HTMLElement, pointerType = "mouse") => {
    const event = new MouseEvent("pointermove", { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    fireEvent(element, event);
  };

  it("ignores pointer entry until the mouse actually moves and clears on leave", () => {
    const onHoverChange = vi.fn();
    render(<BookCover book={bookById.get("nineteen-eighty-four")!} index={0} reducedMotion onHoverChange={onHoverChange} />);
    const result = screen.getByRole("article");
    fireEvent.pointerEnter(result, { pointerType: "mouse" });
    expect(result).toHaveAttribute("data-active", "false");
    expect(onHoverChange).not.toHaveBeenCalled();
    movePointer(result, "touch");
    expect(result).toHaveAttribute("data-active", "false");
    movePointer(result);
    expect(result).toHaveAttribute("data-active", "true");
    fireEvent.pointerLeave(result);
    expect(result).toHaveAttribute("data-active", "false");
  });

  it("resets hover for new searches and ignores movement during the reveal", () => {
    const book = bookById.get("nineteen-eighty-four")!;
    const { rerender } = render(<BookCover book={book} index={0} reducedMotion hoverGeneration={1} />);
    const result = screen.getByRole("article");
    movePointer(result);
    expect(result).toHaveAttribute("data-active", "true");
    rerender(<BookCover book={book} index={0} reducedMotion hoverGeneration={2} hoverEnabled={false} />);
    movePointer(result);
    expect(result).toHaveAttribute("data-active", "false");
    rerender(<BookCover book={book} index={0} reducedMotion hoverGeneration={2} />);
    expect(result).toHaveAttribute("data-active", "false");
    movePointer(result);
    expect(result).toHaveAttribute("data-active", "true");
    expect(result.style.transform).toBe("");
  });

  it("retains keyboard-focus metadata without requiring mouse movement", () => {
    render(<BookCover book={bookById.get("nineteen-eighty-four")!} index={0} reducedMotion hoverEnabled={false} />);
    const result = screen.getByRole("article");
    fireEvent.focus(result);
    expect(result).toHaveAttribute("data-active", "true");
    fireEvent.blur(result);
    expect(result).toHaveAttribute("data-active", "false");
  });

  it("returns to rest after a mouse click and pointer leave even while browser focus remains", () => {
    const onFocusChange = vi.fn();
    render(<BookCover book={bookById.get("nineteen-eighty-four")!} index={0} reducedMotion onFocusChange={onFocusChange} />);
    const result = screen.getByRole("article");
    movePointer(result);
    const press = new MouseEvent("pointerdown", { bubbles: true });
    Object.defineProperty(press, "pointerType", { value: "mouse" });
    fireEvent(result, press);
    fireEvent.focus(result);
    fireEvent.click(result);
    expect(result).toHaveAttribute("data-active", "true");
    fireEvent.pointerLeave(result);
    expect(result).toHaveAttribute("data-active", "false");
    expect(onFocusChange).not.toHaveBeenCalledWith(true);
    fireEvent.blur(result);
    fireEvent.focus(result);
    expect(result).toHaveAttribute("data-active", "true");
  });

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
