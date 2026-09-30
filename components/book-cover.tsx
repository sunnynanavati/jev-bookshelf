"use client";

import { type CSSProperties, useState } from "react";
import { motion, type Variants } from "motion/react";
import type { Book } from "@/lib/types";
import { getCoverUrl } from "@/lib/covers";
import { motionTokens, springs } from "@/lib/motion-tokens";

type BookCoverProps = {
  book: Book;
  index: number;
  reducedMotion: boolean;
  offsetX?: number;
  onHoverChange?: (active: boolean) => void;
  onFocusChange?: (active: boolean) => void;
};

const coverVariants: Variants = {
  hidden: (index: number) => ({
    opacity: 0,
    y: index % 2 === 0 ? -190 : 190,
    scaleX: 0.28,
    scaleY: 0.9,
    rotateY: index % 2 === 0 ? -78 : 78,
    rotateZ: index % 2 === 0 ? -2 : 2,
  }),
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotateY: 0,
    rotateZ: 0,
    transition: {
      ...springs.bookReveal,
      delay: index * motionTokens.duration.instant,
    },
  }),
  exit: (index: number) => ({
    opacity: 0,
    y: index % 2 === 0 ? -160 : 160,
    scaleX: 0.25,
    rotateY: index % 2 === 0 ? -70 : 70,
    transition: {
      duration: motionTokens.duration.normal,
      delay: index * 0.035,
      ease: motionTokens.easing.sharp,
    },
  }),
};

const liftVariants: Variants = {
  rest: { y: 0, scale: 1, transition: springs.snappy },
  hover: { y: -motionTokens.distance.sm, scale: 1.06, transition: springs.snappy },
};

const metadataVariants: Variants = {
  rest: { opacity: 0, y: motionTokens.distance.sm },
  hover: {
    opacity: 1,
    y: 0,
    transition: {
      duration: motionTokens.duration.fast,
      ease: motionTokens.easing.smooth,
    },
  },
};

const reducedLiftVariants: Variants = {
  rest: { y: 0 },
  hover: { y: 0 },
};

const reducedMetadataVariants: Variants = {
  rest: { opacity: 0, y: 0 },
  hover: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.fast },
  },
};

export function BookCover({ book, index, reducedMotion, offsetX = 0, onHoverChange, onFocusChange }: BookCoverProps) {
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const interaction = hovered || focused ? "hover" : "rest";
  const coverUrl = getCoverUrl(book);

  const style = {
    "--book-color": book.color,
    "--book-ink": book.ink,
    "--book-accent": book.accent,
  } as CSSProperties;

  const metadataId = `book-result-metadata-${book.id}`;

  return (
    <motion.article
      className="book-result"
      initial={false}
      animate={{ x: reducedMotion ? 0 : offsetX }}
      transition={springs.snappy}
      onHoverStart={() => { setHovered(true); onHoverChange?.(true); }}
      onHoverEnd={() => { setHovered(false); onHoverChange?.(false); }}
      onFocus={() => { setFocused(true); onFocusChange?.(true); }}
      onBlur={() => { setFocused(false); onFocusChange?.(false); }}
      tabIndex={0}
      aria-describedby={metadataId}
    >
      <motion.div
        className="book-cover-lift"
        initial="rest"
        animate={interaction}
        variants={reducedMotion ? reducedLiftVariants : liftVariants}
      >
        <motion.div
          className={`book-cover material-${book.material}${coverLoaded ? " has-cover-art" : ""}`}
          style={style}
          custom={index}
          variants={reducedMotion ? undefined : coverVariants}
          initial={reducedMotion ? { opacity: 0 } : "hidden"}
          animate={reducedMotion ? { opacity: 1 } : "visible"}
          exit={reducedMotion ? { opacity: 0 } : "exit"}
          transition={reducedMotion ? { duration: motionTokens.duration.fast } : undefined}
        >
          {coverUrl && !coverFailed && (
            <img
              className="cover-art"
              src={coverUrl}
              alt=""
              onLoad={() => setCoverLoaded(true)}
              onError={() => setCoverFailed(true)}
              decoding="async"
            />
          )}
          <span className="cover-frame" aria-hidden="true" />
          <span className="cover-mark" aria-hidden="true">{book.mark}</span>
          <h2>{book.title}</h2>
          <p>{book.author}</p>
          <span className="cover-ornament" aria-hidden="true">✦</span>
        </motion.div>
      </motion.div>

      <div className="book-result-metadata-anchor">
        <motion.div
          id={metadataId}
          className="book-result-metadata"
          initial="rest"
          animate={interaction}
          variants={reducedMotion ? reducedMetadataVariants : metadataVariants}
        >
          <strong className="book-result-title">{book.title}</strong>
          <span className="book-result-author">{book.author}</span>
          <span className="book-result-year">{book.firstPublished ?? "Year unknown"}</span>
        </motion.div>
      </div>
    </motion.article>
  );
}
