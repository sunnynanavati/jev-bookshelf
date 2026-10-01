import type { Metadata } from "next";
import { BookshelfExperience } from "@/components/bookshelf-experience";
import { books } from "@/data/books";
import styles from "@/components/bookshelf-theme.module.css";

export const metadata: Metadata = {
  title: "UI comparison | Jev Bookshelf",
  robots: { index: false, follow: false },
};

export default function UIAgenticPreview() {
  return (
    <div className={styles.theme}>
      <BookshelfExperience
        shelfRows={{ top: books.slice(0, 36), bottom: books.slice(36, 72) }}
      />
    </div>
  );
}
