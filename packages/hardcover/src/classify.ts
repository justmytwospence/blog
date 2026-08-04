/**
 * Fiction / non-fiction classification for Hardcover books.
 *
 * Hardcover has no single reliable "is this fiction" field, so this walks a ladder of signals from
 * most to least authoritative and stops at the first one that answers:
 *
 *  1. `literary_type_id` — Hardcover's own curated field (1 = fiction, 2 = non-fiction). Trustworthy
 *     but null for a large share of books, especially newer or less-popular ones.
 *  2. Crowd genre tags (`cached_tags`, the Genre + Tag buckets) scored as a weighted vote. An
 *     explicit "Fiction"/"Nonfiction" tag outweighs a genre that merely implies one (e.g. "Science
 *     Fiction", "Memoir").
 *  3. `book_category_id` — a few categories are decisive on their own (Short Story, Graphic Novel,
 *     Research Paper); most (Book, Collection, Poetry) are not.
 *  4. Subtitle shape — a last-resort tiebreak. An explanatory subtitle ("Confronting the Mystery of
 *     the World's Strangest Drug") is overwhelmingly a non-fiction convention; fiction subtitles are
 *     rare and usually genre markers ("A Novel").
 *
 * Only when every signal is silent do we fall back to a default. That default used to apply to most
 * of the shelf, which is why non-fiction kept surfacing under "Fiction".
 */

/** Hardcover `literary_type_id` values. */
const LITERARY_TYPE = { FICTION: 1, NONFICTION: 2 } as const;

/** `book_category_id` values that settle the question by themselves. */
const DECISIVE_CATEGORIES: Record<number, boolean> = {
  2: true, // Novella
  3: true, // Short Story
  4: true, // Graphic Novel
  5: true, // Fan Fiction
  6: false, // Research Paper
  9: true, // Web Novel
  10: true, // Light Novel
};

/**
 * Genres that imply fiction without saying "fiction". Compared against the normalized tag (see
 * `normalizeTag`), so entries here are lowercase and stripped of punctuation and spaces.
 */
const FICTION_GENRES = new Set([
  'fantasy',
  'horror',
  'mystery',
  'thriller',
  'suspense',
  'romance',
  'dystopian',
  'dystopia',
  'novel',
  'novels',
  'novella',
  'shortstory',
  'shortstories',
  'graphicnovel',
  'comics',
  'manga',
  'fairytale',
  'fairytales',
  'fairytaleretelling',
  'folklore',
  'magicalrealism',
  'paranormal',
  'urbanfantasy',
  'cyberpunk',
  'steampunk',
  'spaceopera',
  'litrpg',
  'lightnovel',
  'webnovel',
  'gothic',
  'westerns',
  'scifi',
  'sciencefantasy',
  'aliens',
  'timetravel',
  'superheroes',
]);

/** Genres that imply non-fiction. Same normalization rules as `FICTION_GENRES`. */
const NONFICTION_GENRES = new Set([
  'biography',
  'autobiography',
  'memoir',
  'memoirs',
  'history',
  'truecrime',
  'psychology',
  'psychiatry',
  'neuroscience',
  'selfhelp',
  'personaldevelopment',
  'philosophy',
  'theology',
  'apologetics',
  'religion',
  'religions',
  'spirituality',
  'mindspirit',
  'bodymindspirit',
  'meditation',
  'mindfulness',
  'buddhism',
  'christianity',
  'science',
  'popularscience',
  'mathematics',
  'physics',
  'biology',
  'chemistry',
  'medicine',
  'medical',
  'health',
  'nutrition',
  'fitness',
  'sociology',
  'anthropology',
  'socialscience',
  'politics',
  'political',
  'government',
  'foreignpolicy',
  'economics',
  'business',
  'finance',
  'investing',
  'management',
  'leadership',
  'entrepreneurship',
  'journalism',
  'essays',
  'technology',
  'computers',
  'programming',
  'engineering',
  'education',
  'parenting',
  'cooking',
  'cookbooks',
  'travel',
  'nature',
  'environment',
  'ecology',
  'military',
  'linguistics',
  'language',
  'law',
  'reference',
  'textbook',
  'howto',
  'guide',
]);

/**
 * Subtitle phrases that mark fiction rather than the usual explanatory non-fiction subtitle.
 * Matched against the normalized subtitle.
 */
const FICTION_SUBTITLES = [
  'anovel',
  'novel',
  'stories',
  'astory',
  'tales',
  'apoem',
  'poems',
  'anovella',
];

/** Lowercase and strip everything but letters and digits, so "Non-Fiction" and "non fiction" agree. */
function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** One crowd tag as it appears inside a `cached_tags` bucket. */
export interface CachedTag {
  tag?: string | null;
}

/** The `cached_tags` jsonb column: buckets of tags keyed by kind ("Genre", "Tag", "Mood", …). */
export type CachedTags = Record<string, CachedTag[] | null | undefined> | null | undefined;

/** Everything the classifier looks at. All fields optional — any of them can be missing. */
export interface ClassifyInput {
  literaryTypeId?: number | null;
  bookCategoryId?: number | null;
  cachedTags?: CachedTags;
  title?: string | null;
  subtitle?: string | null;
}

/**
 * Vote over the crowd genre tags. An exact "Fiction"/"Nonfiction" tag is worth 3, a compound genre
 * containing the word ("Science Fiction", "Literature & Fiction") 2, and a genre that merely implies
 * one ("Memoir", "Fantasy") 1.
 *
 * Tag *counts* are deliberately ignored: Hardcover carries BISAC imports whose counts run into the
 * thousands ("Body, Mind & Spirit"), and weighting by them lets one imported category outvote every
 * real reader tag on the book.
 *
 * Returns null when no tag carries a signal either way.
 */
function voteOnTags(cachedTags: CachedTags): boolean | null {
  if (!cachedTags) return null;

  // Genre is the meaningful bucket; Tag is freeform but often carries "nonfiction"/"memoir" too.
  // Mood ("reflective", "informative") is about tone, not form, so it is left out.
  const tags = [...(cachedTags.Genre ?? []), ...(cachedTags.Tag ?? [])];

  let fiction = 0;
  let nonfiction = 0;

  for (const entry of tags) {
    const raw = entry?.tag;
    if (!raw) continue;
    const norm = normalizeTag(raw);
    if (!norm) continue;

    // Order matters: "nonfiction" contains "fiction" as a substring.
    if (norm === 'nonfiction') nonfiction += 3;
    else if (norm.includes('nonfiction')) nonfiction += 2;
    else if (norm === 'fiction') fiction += 3;
    else if (norm.includes('fiction')) fiction += 2;
    else if (NONFICTION_GENRES.has(norm)) nonfiction += 1;
    else if (FICTION_GENRES.has(norm)) fiction += 1;
  }

  if (fiction === 0 && nonfiction === 0) return null;
  if (fiction === nonfiction) return null;
  return fiction > nonfiction;
}

/**
 * Last-resort tiebreak on subtitle shape. A colon-and-explanation subtitle is a non-fiction
 * convention ("Soul Boom: Why We Need a Spiritual Revolution"); fiction subtitles are rare and
 * usually just genre markers ("A Novel"). Returns null when there is no subtitle to read.
 */
function voteOnSubtitle(title?: string | null, subtitle?: string | null): boolean | null {
  // Hardcover sometimes leaves `subtitle` null but keeps it glued to the title after a colon.
  const raw = subtitle?.trim() || title?.split(':').slice(1).join(':').trim() || '';
  if (!raw) return null;

  const norm = normalizeTag(raw);
  if (FICTION_SUBTITLES.some((marker) => norm === marker || norm.endsWith(marker))) return true;

  return false;
}

/**
 * Decide whether a book is fiction. See the module comment for the signal ladder.
 *
 * `fallback` is what to return when every signal is silent (no curated type, no genre tags, no
 * decisive category, no subtitle) — a genuinely unknowable book. Defaults to fiction.
 */
export function classifyIsFiction(input: ClassifyInput, fallback = true): boolean {
  if (input.literaryTypeId === LITERARY_TYPE.FICTION) return true;
  if (input.literaryTypeId === LITERARY_TYPE.NONFICTION) return false;

  const byTags = voteOnTags(input.cachedTags);
  if (byTags !== null) return byTags;

  if (input.bookCategoryId != null) {
    const byCategory = DECISIVE_CATEGORIES[input.bookCategoryId];
    if (byCategory !== undefined) return byCategory;
  }

  const bySubtitle = voteOnSubtitle(input.title, input.subtitle);
  if (bySubtitle !== null) return bySubtitle;

  return fallback;
}
