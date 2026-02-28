/**
 * Obsidian Markdown Preprocessor
 *
 * Transforms Obsidian-specific syntax to standard markdown before rendering.
 * Handles wiki links, image embeds, and highlights. Skips transforms inside
 * code blocks/fences.
 */

/**
 * Preprocess Obsidian markdown into standard markdown.
 * Safe no-op on standard markdown — regexes simply don't match.
 */
export function preprocessObsidian(markdown: string, slug: string): string {
  // Split content into code-fenced and non-fenced segments
  // to avoid transforming syntax inside code blocks
  const segments = splitCodeFences(markdown);

  return segments
    .map((segment) => {
      if (segment.isCode) return segment.text;
      let text = segment.text;
      text = transformImageEmbeds(text, slug);
      text = transformWikiLinks(text);
      text = transformHighlights(text);
      return text;
    })
    .join('');
}

interface Segment {
  text: string;
  isCode: boolean;
}

/**
 * Split markdown into alternating non-code / code-fence segments.
 * Also protects inline code (`...`) from transformation.
 */
function splitCodeFences(markdown: string): Segment[] {
  const segments: Segment[] = [];
  // Match fenced code blocks (``` or ~~~) and inline code
  const codePattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codePattern.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: markdown.slice(lastIndex, match.index), isCode: false });
    }
    segments.push({ text: match[0], isCode: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    segments.push({ text: markdown.slice(lastIndex), isCode: false });
  }

  return segments;
}

/**
 * Transform Obsidian image embeds to standard markdown images.
 * ![[image.png]] → ![image.png](/blog/images/{slug}/image.png)
 * ![[image.png|alt text]] → ![alt text](/blog/images/{slug}/image.png)
 */
function transformImageEmbeds(text: string, slug: string): string {
  return text.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_match, filename: string, altOrSize: string | undefined) => {
      const alt = altOrSize ?? filename;
      return `![${alt}](/blog/images/${slug}/${filename})`;
    },
  );
}

/**
 * Transform Obsidian wiki links to bold text.
 * [[page-name]] → **page-name**
 * [[page-name|display text]] → **display text**
 *
 * Note: Cross-linking to other blog posts can be added later by resolving
 * wiki link targets to /blog/{slug} URLs.
 */
function transformWikiLinks(text: string): string {
  return text.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_match, page: string, display: string | undefined) => {
      return `**${display ?? page}**`;
    },
  );
}

/**
 * Transform Obsidian highlights to HTML mark tags.
 * ==highlighted text== → <mark>highlighted text</mark>
 */
function transformHighlights(text: string): string {
  return text.replace(/==((?:(?!==).)+)==/g, '<mark>$1</mark>');
}
