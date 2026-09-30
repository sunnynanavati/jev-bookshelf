import { BookshelfExperience } from "@/components/bookshelf-experience";
import { books } from "@/data/books";

export default function Home() {
  return (
    <BookshelfExperience
      shelfRows={{
        top: books.slice(0, 36),
        bottom: books.slice(36, 72),
      }}
    />
  );
}
