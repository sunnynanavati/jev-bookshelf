import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CATALOG_PATH = resolve(ROOT, "data/catalog.json");
const REPORT_PATH = resolve(ROOT, "data/catalog-report.json");
const CACHE_DIRECTORY = resolve(ROOT, ".cache/openlibrary");
const DEFAULT_TARGET = 1_000;
const PAGE_SIZE = 100;
const PAGES_PER_SOURCE = 4;
const MAX_BOOKS_PER_AUTHOR = 8;
const USER_AGENT = "JevBookshelf/0.2 (+https://github.com/sunnynanavati/jev-bookshelf)";
const FIELDS = [
  "key", "title", "author_name", "cover_i", "isbn", "first_publish_year", "subject", "person", "place",
  "ratings_count", "readinglog_count", "want_to_read_count", "edition_count",
].join(",");

const sources = [
  { collection: "fiction", genre: "literary-contemporary", query: "subject:literary_fiction language:eng" },
  { collection: "fiction", genre: "mystery-thriller", query: "subject:mystery_and_detective_stories language:eng" },
  { collection: "fiction", genre: "fantasy", query: "subject:fantasy language:eng" },
  { collection: "fiction", genre: "science-fiction", query: "subject:science_fiction language:eng" },
  { collection: "fiction", genre: "romance", query: "subject:romance language:eng" },
  { collection: "fiction", genre: "horror", query: "subject:horror language:eng" },
  { collection: "fiction", genre: "historical-fiction", query: "subject:historical_fiction language:eng" },
  { collection: "fiction", genre: "young-adult", query: "subject:young_adult_fiction language:eng" },
  { collection: "fiction", genre: "children-middle-grade", query: "subject:juvenile_fiction language:eng" },
  { collection: "fiction", genre: "graphic-fiction", query: "subject:graphic_novels language:eng" },
  { collection: "nonfiction", genre: "biography-memoir", query: "subject:biography language:eng" },
  { collection: "nonfiction", genre: "history", query: "subject:history language:eng" },
  { collection: "nonfiction", genre: "science-nature", query: "subject:science language:eng" },
  { collection: "nonfiction", genre: "technology", query: "subject:technology language:eng" },
  { collection: "nonfiction", genre: "psychology", query: "subject:psychology language:eng" },
  { collection: "nonfiction", genre: "philosophy", query: "subject:philosophy language:eng" },
  { collection: "nonfiction", genre: "business-economics", query: "subject:business language:eng" },
  { collection: "nonfiction", genre: "politics-society", query: "subject:politics language:eng" },
  { collection: "nonfiction", genre: "health-wellbeing", query: "subject:health language:eng" },
  { collection: "nonfiction", genre: "essays-travel-true-crime", query: "subject:essays language:eng" },
];

const blockedTitles = new Set([
  "im westen nichts neues", "a sense of words", "amore alla corte degli zar", "ore 8",
  "married at first sight", "dork diaries 7", "fear no evil", "trotzdem ja zum leben sagen",
  "dog days", "bumi manusia", "the scam", "as a man thinketh", "pimp",
]);

const rejectionCounts = new Map();
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function parseArguments(argv) {
  let target = DEFAULT_TARGET;
  let refresh = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--refresh") refresh = true;
    else if (argument === "--target") target = Number(argv[index += 1]);
    else if (argument.startsWith("--target=")) target = Number(argument.split("=")[1]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(target) || target < 200 || target % 2 !== 0) {
    throw new Error("--target must be an even integer of at least 200.");
  }
  return { target, refresh };
}

const normalize = (value) => String(value ?? "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const slugify = (value) => normalize(value).replace(/\s+/g, "-");
const numberFrom = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function reject(reason) {
  rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1);
}

function compact(values = [], limit = 7, fallback) {
  const ignored = /new york times|nyt:|accessible book|protected daisy|internet archive|large type|reading level/i;
  const selected = values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 2 && value.length < 72 && !ignored.test(value))
    .filter((value, index, all) => all.findIndex((item) => normalize(item) === normalize(value)) === index)
    .slice(0, limit);
  return selected.length ? selected : fallback ? [fallback] : [];
}

function pickIsbn(values = []) {
  return values.find((isbn) => /^97[89]\d{10}$/.test(isbn)) ??
    values.find((isbn) => /^\d{9}[\dX]$/.test(isbn)) ?? null;
}

function popularityFrom(document = {}) {
  const ratings = numberFrom(document.ratings_count);
  const readingLog = numberFrom(document.readinglog_count);
  const wantToRead = numberFrom(document.want_to_read_count);
  const editions = numberFrom(document.edition_count);
  const score = 3 * Math.log1p(readingLog) + 2 * Math.log1p(wantToRead) +
    2 * Math.log1p(ratings) + Math.log1p(editions);
  return { ratings, readingLog, wantToRead, editions, score: Number(score.toFixed(4)) };
}

function inferGenre(book) {
  const text = normalize(`${book.title} ${book.subjects?.join(" ") ?? ""}`);
  const ordered = [
    ["biography-memoir", /biograph|memoir|autobiograph/],
    ["history", /history|historical study|civilization/],
    ["science-nature", /science|nature|biology|physics|astronomy|environment/],
    ["technology", /technology|computer|engineering|internet|programming/],
    ["psychology", /psychology|behavior|mental health/],
    ["philosophy", /philosophy|ethics|existential/],
    ["business-economics", /business|economics|finance|management|leadership/],
    ["politics-society", /politic|social science|sociology|government/],
    ["health-wellbeing", /health|medicine|wellness|self help/],
    ["essays-travel-true-crime", /essay|travel|true crime|journalism/],
    ["science-fiction", /science fiction|space opera|dystopi/],
    ["fantasy", /fantasy|magic|wizard|myth/],
    ["mystery-thriller", /mystery|detective|thriller|crime fiction/],
    ["romance", /romance|love stor/],
    ["horror", /horror|ghost|supernatural/],
    ["historical-fiction", /historical fiction/],
    ["young-adult", /young adult|adolescen/],
    ["children-middle-grade", /juvenile|children/],
    ["graphic-fiction", /graphic novel|comic/],
  ];
  return ordered.find(([, pattern]) => pattern.test(text))?.[0] ?? "literary-contemporary";
}

function collectionForGenre(genre) {
  return sources.find((source) => source.genre === genre)?.collection ?? "fiction";
}

function upgradeExisting(book) {
  const genre = book.genres?.[0] ?? inferGenre(book);
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    firstPublished: book.firstPublished ?? null,
    subjects: compact(book.subjects, 7, genre.replaceAll("-", " ")),
    coverId: book.coverId ?? null,
    isbn: book.isbn ?? null,
    openLibraryKey: book.openLibraryKey ?? null,
    curated: Boolean(book.curated),
    collection: book.collection ?? collectionForGenre(genre),
    genres: book.genres?.length ? book.genres : [genre],
    people: compact(book.people, 10),
    places: compact(book.places, 6),
    popularity: book.popularity ?? popularityFrom(),
  };
}

function candidateFrom(document, source) {
  return {
    id: slugify(document.title),
    title: String(document.title).trim(),
    author: String(document.author_name[0]).trim(),
    firstPublished: Number(document.first_publish_year),
    subjects: compact(document.subject, 7, source.genre.replaceAll("-", " ")),
    coverId: document.cover_i,
    isbn: pickIsbn(document.isbn),
    openLibraryKey: document.key,
    curated: false,
    collection: source.collection,
    genres: [source.genre],
    people: compact(document.person, 10),
    places: compact(document.place, 6),
    popularity: popularityFrom(document),
  };
}

function candidateProblem(document, source) {
  const title = String(document.title ?? "").trim();
  const author = String(document.author_name?.[0] ?? "").trim();
  if (!title || title.length > 100) return "invalid-title";
  if (!author) return "missing-author";
  const latinShare = (value) => {
    const letters = value.match(/\p{Letter}/gu)?.length ?? 0;
    const latinLetters = value.match(/\p{Script=Latin}/gu)?.length ?? 0;
    return letters ? latinLetters / letters : 0;
  };
  if (latinShare(title) < 0.6 || latinShare(author) < 0.6) return "non-english-script";
  const subjectText = normalize((document.subject ?? []).join(" "));
  const fictionSignal = /\b(fiction|novel|novels|stories|science fiction|fantasy fiction|comic books|graphic novels)\b/.test(subjectText);
  const nonfictionSignal = /\b(nonfiction|biography|autobiography|history|science|technology|psychology|philosophy|business|economics|politics|health|essays|travel)\b/.test(subjectText);
  if (source.collection === "nonfiction" && fictionSignal) return "fiction-in-nonfiction";
  if (source.collection === "fiction" && nonfictionSignal && !fictionSignal) return "nonfiction-in-fiction";
  if (!document.key?.startsWith("/works/")) return "missing-work";
  if (!document.cover_i) return "missing-cover";
  if (!Number.isInteger(Number(document.first_publish_year))) return "missing-year";
  const normalizedTitle = normalize(title);
  if (blockedTitles.has(normalizedTitle.replace(/^\s+/, ""))) return "blocked-title";
  if (/\b(summary|study guide|workbook|companion|coloring book|activity book|box set|boxed set|complete works|volume \d|vol\.? \d)\b/i.test(title)) {
    return "companion-or-collection";
  }
  return null;
}

function cachePath(source, page) {
  return resolve(CACHE_DIRECTORY, `${source.collection}-${source.genre}-${page}.json`);
}

async function openLibraryPage(source, page, refresh) {
  const path = cachePath(source, page);
  if (!refresh && existsSync(path)) return JSON.parse(await readFile(path, "utf8"));
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", source.query);
  url.searchParams.set("sort", "readinglog");
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Open Library returned ${response.status} for ${source.genre} page ${page}`);
  const payload = await response.json();
  await writeFile(path, `${JSON.stringify(payload)}\n`);
  await sleep(1_050);
  return payload;
}

function selectionScore(book) {
  const modernBonus = book.firstPublished >= 2000 ? 12 : book.firstPublished >= 1980 ? 8 : 0;
  return book.popularity.score + modernBonus;
}

function candidateSort(left, right) {
  return selectionScore(right) - selectionScore(left) || left.id.localeCompare(right.id);
}

function canonicalKey(book) {
  return `${normalize(book.title).replace(/^(a|an|the) /, "")}::${normalize(book.author)}`;
}

function assignUniqueId(book, usedIds) {
  const base = book.id || "book";
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  return { ...book, id };
}

function selectCatalog(seeds, candidatesByGenre, target) {
  const half = target / 2;
  const catalog = [...seeds];
  const selectedIds = new Set(seeds.map((book) => book.id));
  const selectedWorks = new Set(seeds.map((book) => book.openLibraryKey));
  const selectedCanonical = new Set(seeds.map(canonicalKey));
  const authorCounts = new Map();
  const genreCounts = new Map();
  const collectionCounts = { fiction: 0, nonfiction: 0 };
  for (const book of seeds) {
    authorCounts.set(book.author, (authorCounts.get(book.author) ?? 0) + 1);
    genreCounts.set(book.genres[0], (genreCounts.get(book.genres[0]) ?? 0) + 1);
    collectionCounts[book.collection] += 1;
  }
  if (collectionCounts.fiction > half || collectionCounts.nonfiction > half) {
    throw new Error("The preserved catalog already exceeds the requested fiction/nonfiction split.");
  }

  const positions = new Map(sources.map((source) => [source.genre, 0]));
  const canSelect = (book) =>
    collectionCounts[book.collection] < half &&
    !selectedWorks.has(book.openLibraryKey) &&
    !selectedCanonical.has(canonicalKey(book)) &&
    (authorCounts.get(book.author) ?? 0) < MAX_BOOKS_PER_AUTHOR;

  const add = (candidate) => {
    if (!canSelect(candidate)) return false;
    const book = assignUniqueId(candidate, selectedIds);
    catalog.push(book);
    selectedIds.add(book.id);
    selectedWorks.add(book.openLibraryKey);
    selectedCanonical.add(canonicalKey(book));
    authorCounts.set(book.author, (authorCounts.get(book.author) ?? 0) + 1);
    genreCounts.set(book.genres[0], (genreCounts.get(book.genres[0]) ?? 0) + 1);
    collectionCounts[book.collection] += 1;
    return true;
  };

  const categoryTarget = half / 10;
  let progressed = true;
  while (catalog.length < target && progressed) {
    progressed = false;
    for (const source of sources) {
      if ((genreCounts.get(source.genre) ?? 0) >= categoryTarget) continue;
      const candidates = candidatesByGenre.get(source.genre) ?? [];
      let position = positions.get(source.genre) ?? 0;
      while (position < candidates.length) {
        const candidate = candidates[position++];
        positions.set(source.genre, position);
        if (add(candidate)) {
          progressed = true;
          break;
        }
      }
    }
  }

  const reserves = [...candidatesByGenre.values()].flat().sort(candidateSort);
  for (const candidate of reserves) {
    if (catalog.length >= target) break;
    add(candidate);
  }

  return { catalog, authorCounts, genreCounts, collectionCounts };
}

function decadeFor(year) {
  if (!year) return "unknown";
  if (year < 1950) return "pre-1950";
  if (year < 1980) return "1950-1979";
  if (year < 2000) return "1980-1999";
  return "2000-present";
}

function validateCatalog(catalog, target) {
  const failures = [];
  const count = (predicate) => catalog.filter(predicate).length;
  const authorCounts = Object.values(catalog.reduce((counts, book) => {
    counts[book.author] = (counts[book.author] ?? 0) + 1;
    return counts;
  }, {}));
  if (catalog.length !== target) failures.push(`expected ${target} books, received ${catalog.length}`);
  if (new Set(catalog.map((book) => book.id)).size !== target) failures.push("book IDs are not unique");
  if (new Set(catalog.map((book) => book.openLibraryKey)).size !== target) failures.push("Open Library works are not unique");
  if (count((book) => book.collection === "fiction") !== target / 2) failures.push("fiction count is not 50 percent");
  if (count((book) => book.collection === "nonfiction") !== target / 2) failures.push("nonfiction count is not 50 percent");
  if (count((book) => book.coverId) / target < 0.99) failures.push("cover coverage is below 99 percent");
  if (count((book) => book.firstPublished >= 1980) / target < 0.65) failures.push("post-1980 coverage is below 65 percent");
  if (count((book) => book.firstPublished >= 2000) / target < 0.4) failures.push("post-2000 coverage is below 40 percent");
  if (Math.max(...authorCounts) > MAX_BOOKS_PER_AUTHOR) failures.push("author cap exceeded");
  const expectedPerGenre = target / sources.length;
  for (const source of sources) {
    if (count((book) => book.genres.includes(source.genre)) !== expectedPerGenre) {
      failures.push(`${source.genre} count is not ${expectedPerGenre}`);
    }
  }
  if (failures.length) throw new Error(`Catalog validation failed:\n- ${failures.join("\n- ")}`);
}

function makeReport(catalog, target) {
  const tally = (values) => Object.fromEntries([...values.entries()].sort(([left], [right]) => left.localeCompare(right)));
  const collections = new Map();
  const genres = new Map();
  const decades = new Map();
  const authors = new Map();
  for (const book of catalog) {
    collections.set(book.collection, (collections.get(book.collection) ?? 0) + 1);
    for (const genre of book.genres) genres.set(genre, (genres.get(genre) ?? 0) + 1);
    const decade = decadeFor(book.firstPublished);
    decades.set(decade, (decades.get(decade) ?? 0) + 1);
    authors.set(book.author, (authors.get(book.author) ?? 0) + 1);
  }
  return {
    generatedAt: new Date().toISOString(),
    target,
    total: catalog.length,
    collections: tally(collections),
    genres: tally(genres),
    decades: tally(decades),
    covers: catalog.filter((book) => book.coverId).length,
    coverCoverage: Number((catalog.filter((book) => book.coverId).length / catalog.length).toFixed(4)),
    modernSince1980: catalog.filter((book) => book.firstPublished >= 1980).length,
    modernSince2000: catalog.filter((book) => book.firstPublished >= 2000).length,
    topAuthors: [...authors.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 25),
    rejections: tally(rejectionCounts),
  };
}

async function writeJsonAtomic(path, value) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
}

async function main() {
  const { target, refresh } = parseArguments(process.argv.slice(2));
  await mkdir(CACHE_DIRECTORY, { recursive: true });
  const existing = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const seeds = existing.slice(0, Math.min(existing.length, 200)).map(upgradeExisting);
  const seedWorks = new Set(seeds.map((book) => book.openLibraryKey));
  const seedCanonical = new Set(seeds.map(canonicalKey));
  const candidatesByGenre = new Map();

  for (const source of sources) {
    console.log(`[source] ${source.collection}/${source.genre}`);
    const candidates = [];
    const seenWorks = new Set();
    const seenCanonical = new Set();
    for (let page = 1; page <= PAGES_PER_SOURCE; page += 1) {
      const payload = await openLibraryPage(source, page, refresh);
      for (const document of payload.docs ?? []) {
        const problem = candidateProblem(document, source);
        if (problem) {
          reject(problem);
          continue;
        }
        const candidate = candidateFrom(document, source);
        const canonical = canonicalKey(candidate);
        if (seedWorks.has(candidate.openLibraryKey) || seedCanonical.has(canonical) ||
          seenWorks.has(candidate.openLibraryKey) || seenCanonical.has(canonical)) {
          reject("duplicate");
          continue;
        }
        seenWorks.add(candidate.openLibraryKey);
        seenCanonical.add(canonical);
        candidates.push(candidate);
      }
    }
    candidates.sort(candidateSort);
    candidatesByGenre.set(source.genre, candidates);
    console.log(`  ${candidates.length} eligible candidates`);
  }

  const { catalog } = selectCatalog(seeds, candidatesByGenre, target);
  validateCatalog(catalog, target);
  const report = makeReport(catalog, target);
  await writeJsonAtomic(CATALOG_PATH, catalog);
  await writeJsonAtomic(REPORT_PATH, report);
  console.log(`Wrote ${catalog.length} books to ${CATALOG_PATH}`);
  console.log(JSON.stringify(report, null, 2));
}

export { candidateProblem, canonicalKey, selectCatalog, validateCatalog };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
