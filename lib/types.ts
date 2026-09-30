export type Material = "cloth" | "linen" | "leather" | "paper";
export type Collection = "fiction" | "nonfiction";

export type Popularity = {
  ratings: number;
  readingLog: number;
  wantToRead: number;
  editions: number;
  score: number;
};

export type CatalogBook = {
  id: string;
  title: string;
  author: string;
  firstPublished: number | null;
  subjects: string[];
  coverId: number | null;
  isbn: string | null;
  openLibraryKey: string | null;
  curated: boolean;
  collection: Collection;
  genres: string[];
  people: string[];
  places: string[];
  popularity: Popularity;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  firstPublished: number | null;
  color: string;
  ink: string;
  accent: string;
  material: Material;
  height: number;
  width: number;
  mark: string;
  coverId: number | null;
  isbn: string | null;
  openLibraryKey: string | null;
};

export type DemoSearch = {
  id: string;
  query: string;
  aliases: string[];
  resultIds: string[];
};
