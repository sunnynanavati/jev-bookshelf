"use client";

import { useEffect, useRef, useState } from "react";
import { BookSpine } from "@/components/book-spine";
import type { Book } from "@/lib/types";

type ShelfRowProps = {
  direction: "left" | "right";
  position: "top" | "bottom";
  books: Book[];
};

export function ShelfRow({ direction, position, books }: ShelfRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [repeats, setRepeats] = useState(1);

  useEffect(() => {
    const track = trackRef.current;
    const firstSequence = track?.firstElementChild as HTMLElement | null;
    if (!track || !firstSequence) return;

    const updateDuration = () => {
      // Each half of the loop must span the viewport, including wide monitors.
      const sampleWidth = firstSequence.scrollWidth / repeats;
      if (sampleWidth <= 0) return;
      setRepeats(Math.max(1, Math.ceil(window.innerWidth / sampleWidth)));
      const pixelsPerSecond = window.innerWidth < 700 ? 16 : 24;
      track.style.setProperty("--marquee-duration", `${firstSequence.scrollWidth / pixelsPerSecond}s`);
    };

    updateDuration();
    const observer = new ResizeObserver(updateDuration);
    observer.observe(firstSequence);
    if (track.parentElement) observer.observe(track.parentElement);
    return () => observer.disconnect();
  }, [repeats]);

  return (
    <div className={`shelf-row shelf-row-${position}`} aria-hidden="true">
      <div ref={trackRef} className={`marquee-track marquee-${direction}`}>
        {[0, 1].map((copy) => (
          <div className="book-sequence" key={copy}>
            {Array.from({ length: repeats }, (_, repeat) => books.map((book) => (
              <BookSpine book={book} key={`${copy}-${repeat}-${book.id}`} />
            )))}
          </div>
        ))}
      </div>
    </div>
  );
}
