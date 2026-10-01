import { BookshelfExperience } from "@/components/bookshelf-experience";
import { books } from "@/data/books";
import styles from "@/components/bookshelf-theme.module.css";

export default function Home() {
  return (
    <div className={styles.theme}>
      <BookshelfExperience
        shelfRows={{
          top: books.slice(0, 36),
          bottom: books.slice(36, 72),
        }}
      />
    </div>
  );
}
