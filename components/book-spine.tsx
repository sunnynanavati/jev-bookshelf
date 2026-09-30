import type { CSSProperties } from "react";
import type { Book } from "@/lib/types";

type BookSpineProps = {
  book: Book;
};

export function BookSpine({ book }: BookSpineProps) {
  // Stable per-title art direction; independent of catalog order and marquee copy.
  const signature = [...book.id].reduce((total, character) => (Math.imul(total, 31) + character.charCodeAt(0)) >>> 0, 7);
  const binding = signature % 6;
  const palettes = [
    ["#d6c6a6", "#302d25"], ["#243d30", "#e2d6b9"],
    ["#214d69", "#e5d8be"], ["#a0412c", "#f0dfbe"],
    ["#c3b699", "#302e27"], ["#1c211f", "#d7caae"],
    ["#485533", "#eadcba"], ["#e2d8bf", "#342f27"],
    ["#71372e", "#ead8b4"], ["#ad803d", "#282a22"],
    ["#3b6679", "#ede0c5"], ["#272a2c", "#ded5bf"],
  ];
  const [color, ink] = palettes[(signature >>> 4) % palettes.length];
  const material = ["cloth", "paper", "linen", "paper", "cloth", "leather"][binding];
  const style = {
    "--book-color": color,
    "--book-ink": ink,
    "--book-accent": ink,
    "--spine-print-size": `${book.title.length > 45 ? 8 : book.title.length > 28 ? 9 : 11}px`,
    "--spine-wear": `${0.48 + (signature % 4) * 0.08}`,
    "--grain-x": `${signature % 173}px`,
    "--grain-y": `${(signature >>> 8) % 227}px`,
    "--grain-size": `${130 + (signature % 4) * 23}px`,
    "--book-height": `${book.height}px`,
    "--book-width": `${book.width}px`,
  } as CSSProperties;

  return (
    <div
      className={`book-spine material-${material} binding-${binding}`}
      style={style}
      aria-hidden="true"
    >
      <span className="spine-headband spine-headband-top" />
      <span className="spine-headband spine-headband-bottom" />
      <span className="spine-rule spine-rule-top" />
      <span className="spine-title">{book.title}</span>
      <span className="spine-author">{book.author}</span>
      <span className="spine-mark">{book.mark}</span>
      <span className="spine-rule spine-rule-bottom" />
    </div>
  );
}
