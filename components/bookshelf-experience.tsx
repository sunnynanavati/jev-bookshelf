"use client";

import { type CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Book } from "@/lib/types";
import { preloadBookCovers } from "@/lib/covers";
import { BookCover } from "@/components/book-cover";
import { ShelfRow } from "@/components/shelf-row";

type ExperienceState = "idle" | "searching" | "extracting" | "settled" | "unsupported" | "error";

type SearchResponse = {
  mode: "demo" | "jev";
  results: Array<{ book: Book; probability: number | null }>;
};

type BookshelfExperienceProps = {
  shelfRows: { top: Book[]; bottom: Book[] };
};

export function BookshelfExperience({ shelfRows }: BookshelfExperienceProps) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const [showDevControls, setShowDevControls] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ExperienceState>("idle");
  const [results, setResults] = useState<Book[]>([]);
  const [resultLayout, setResultLayout] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchEntranceComplete, setSearchEntranceComplete] = useState(false);
  const [readyShelves, setReadyShelves] = useState({ top: false, bottom: false });
  const onShelfReady = useCallback((position: "top" | "bottom") => {
    setReadyShelves((current) => current[position] ? current : { ...current, [position]: true });
  }, []);
  const [shelfBlur, setShelfBlur] = useState(0);
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);
  const [focusedBook, setFocusedBook] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const reducedMotion = Boolean(useReducedMotion());
  const timers = useRef<number[]>([]);
  const searchSequence = useRef(0);

  const clearTimers = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (!isDevelopment) return clearTimers;
    const savedBlur = window.localStorage.getItem("jev-shelf-blur");
    if (savedBlur !== null) {
      const parsedBlur = Number(savedBlur);
      if (Number.isFinite(parsedBlur) && parsedBlur >= 0 && parsedBlur <= 8) setShelfBlur(parsedBlur);
    }
    return clearTimers;
  }, [isDevelopment]);

  useEffect(() => {
    if (!isDevelopment) return;
    const toggleDevControls = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey
        && event.key.toLowerCase() === "b" && !event.repeat) {
        event.preventDefault();
        setShowDevControls((visible) => !visible);
      }
    };
    window.addEventListener("keydown", toggleDevControls);
    return () => window.removeEventListener("keydown", toggleDevControls);
  }, [isDevelopment]);

  const updateShelfBlur = (value: number) => {
    setShelfBlur(value);
    window.localStorage.setItem("jev-shelf-blur", String(value));
  };

  const runSearch = async (value: string) => {
    if (state === "searching") return;
    setSearchError("");
    clearTimers();
    const searchId = ++searchSequence.current;
    setHoveredBook(null);
    const isUpdatingResults = resultLayout;
    if (!isUpdatingResults) setResults([]);
    setState("searching");
    const searchDelay = reducedMotion ? 120 : 320;
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value.trim() }),
      });

      if (!response.ok) {
        if (searchId !== searchSequence.current) return;
        if (response.status === 429) {
          const seconds = Number(response.headers.get("Retry-After")) || 60;
          setSearchError(`Too many searches. Try again in ${seconds} seconds.`);
        } else {
          setSearchError("Search is temporarily unavailable. Please try again later.");
        }
        throw new Error(`Search failed with ${response.status}`);
      }
      const payload = await response.json() as SearchResponse;
      const books = payload.results.map(({ book }) => book);

      const remainingDelay = Math.max(0, searchDelay - (performance.now() - startedAt));
      await Promise.all([
        preloadBookCovers(books),
        new Promise((resolve) => window.setTimeout(resolve, remainingDelay)),
      ]);
      if (searchId !== searchSequence.current) return;

      if (books.length === 0) {
        setResults([]);
        setState("unsupported");
        return;
      }

      setState("extracting");
      setResultLayout(true);
      timers.current.push(window.setTimeout(
        () => {
          if (searchId !== searchSequence.current) return;
          setResults(books);
          setSearchExpanded(false);
          timers.current.push(window.setTimeout(
            () => {
              if (searchId === searchSequence.current) setState("settled");
            },
            reducedMotion ? 120 : 1_060,
          ));
        },
        reducedMotion || isUpdatingResults ? 0 : 240,
      ));
    } catch {
      if (searchId !== searchSequence.current) return;
      setState("error");
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim()) void runSearch(query);
  };

  const clearSearch = () => {
    clearTimers();
    searchSequence.current += 1;
    setQuery("");
    setResults([]);
    setResultLayout(false);
    setSearchExpanded(false);
    setHoveredBook(null);
    setFocusedBook(null);
    setState("idle");
    setSearchError("");
  };

  const hasResults = results.length > 0;
  const effectiveBlur = hasResults ? 2.25 : shelfBlur;
  const activeIndex = results.findIndex((book) => book.id === (hoveredBook ?? focusedBook));
  const showClear = resultLayout || hasResults;

  return (
    <main
      className={`experience state-${state}${readyShelves.top && readyShelves.bottom ? " is-entry-ready" : ""}${resultLayout ? " has-result-layout" : ""}`}
      style={{ "--shelf-blur": `${effectiveBlur}px` } as CSSProperties}
    >
      <h1 className="sr-only">Jev Bookshelf</h1>
      <div className="shelves" aria-hidden="true">
        <ShelfRow position="top" direction="right" books={shelfRows.top} onReady={onShelfReady} />
        <ShelfRow position="bottom" direction="left" books={shelfRows.bottom} onReady={onShelfReady} />
      </div>

      <section className="interaction-layer" aria-label="Book search">
        <AnimatePresence mode="wait">
          {hasResults && (
            <motion.div
              className="result-region"
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              aria-label="Search results"
            >
              <div className="cover-row">
                <AnimatePresence>
                  {results.map((book, index) => (
                    <BookCover
                      key={book.id}
                      book={book}
                      index={index}
                      reducedMotion={reducedMotion}
                      hoverEnabled={state === "settled" || state === "error"}
                      hoverGeneration={searchSequence.current}
                      offsetX={activeIndex < 0 || index === activeIndex ? 0 : index < activeIndex ? -10 : 10}
                      onHoverChange={(active) => setHoveredBook((current) => active ? book.id : current === book.id ? null : current)}
                      onFocusChange={(active) => setFocusedBook((current) => active ? book.id : current === book.id ? null : current)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`search-cluster${resultLayout ? " has-result-layout" : ""}${hasResults && !searchExpanded ? " is-compact" : ""}`}>
          <div
            className={`search-entrance page-entrance${searchEntranceComplete ? " is-entered" : ""}`}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && event.animationName === "page-enter") {
                setSearchEntranceComplete(true);
              }
            }}
          >
            <form
              className="search-form"
              onSubmit={onSubmit}
              onPointerDown={(event) => {
                // Keep action buttons stationary between pointer-down and click.
                if (event.target instanceof Element && !event.target.closest("button")) {
                  setSearchExpanded(true);
                }
              }}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setSearchExpanded(false);
              }}
            >
              <label className="sr-only" htmlFor="book-search">Ask your bookshelf</label>
              <span
                className={`search-leading-icon${query.trim() && searchExpanded && !reducedMotion ? " is-scanning" : ""}`}
                aria-hidden="true"
              >
                <MagnifyingGlass size={24} weight="regular" />
              </span>
              <input
                id="book-search"
                value={query}
                onFocus={() => setSearchExpanded(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchExpanded(true);
                }}
                placeholder="Ask your bookshelf"
                autoComplete="off"
                spellCheck="false"
                maxLength={500}
              />
              <button
                type={showClear ? "button" : "submit"}
                aria-label={showClear ? "Clear search and results" : "Search books"}
                disabled={!showClear && (!query.trim() || state === "searching")}
                onClick={showClear ? clearSearch : undefined}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    className="search-action-icon"
                    key={showClear ? "clear" : "submit"}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "rotate(-45deg) scale(0.92)" }}
                    animate={{ opacity: 1, transform: "rotate(0deg) scale(1)" }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "rotate(45deg) scale(0.92)" }}
                    transition={{ duration: reducedMotion ? 0.01 : 0.16, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {showClear
                      ? <X size={22} weight="bold" aria-hidden="true" />
                      : <ArrowRight size={21} weight="bold" aria-hidden="true" />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </form>
          </div>

          <div className="status" role="status" aria-live="polite">
            {state === "unsupported" && "No matching books. Try another search."}
            {state === "error" && searchError}
          </div>

        </div>
      </section>

      {isDevelopment && showDevControls && (
        <aside className="dev-controls" aria-label="Visual development controls">
          <div className="dev-controls-heading">
            <SlidersHorizontal size={15} weight="bold" aria-hidden="true" />
            <span>Blur</span>
            <output htmlFor="shelf-blur">{effectiveBlur.toFixed(2)} px</output>
          </div>
          <input
            id="shelf-blur"
            type="range"
            min="0"
            max="8"
            step="0.25"
            value={effectiveBlur}
            disabled={hasResults}
            onChange={(event) => updateShelfBlur(Number(event.target.value))}
            aria-label="Shelf blur strength"
          />
        </aside>
      )}

      <a className="cover-credit" href="https://openlibrary.org" target="_blank" rel="noreferrer">
        Cover images from Open Library
      </a>
    </main>
  );
}
