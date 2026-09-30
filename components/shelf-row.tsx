"use client";

import { useEffect, useRef } from "react";
import { BookSpine } from "@/components/book-spine";
import type { Book } from "@/lib/types";

type ShelfRowProps = {
  direction: "left" | "right";
  position: "top" | "bottom";
  books: Book[];
};

export function ShelfRow({ direction, position, books }: ShelfRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const firstSequence = track?.firstElementChild as HTMLElement | null;
    if (!track || !firstSequence) return;

    const updateDuration = () => {
      const pixelsPerSecond = window.innerWidth < 700 ? 16 : 24;
      track.style.setProperty("--marquee-duration", `${firstSequence.scrollWidth / pixelsPerSecond}s`);
    };

    updateDuration();
    const observer = new ResizeObserver(updateDuration);
    observer.observe(firstSequence);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`shelf-row shelf-row-${position}`} aria-hidden="true">
      <div ref={trackRef} className={`marquee-track marquee-${direction}`}>
        {[0, 1].map((copy) => (
          <div className="book-sequence" key={copy}>
            {books.map((book) => (
              <BookSpine book={book} key={`${copy}-${book.id}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
