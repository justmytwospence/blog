import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import {
  Project,
  BlogPost,
  Concept,
  Content,
  ConceptContent,
  MarkdownContent,
  MarimoContent,
  WebappConfig,
} from './types';
import { parseDocument, type MarimoDocument } from 'marimo-blog';
import { preprocessObsidian } from '@blog/obsidian-md';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const PROJECTS_DIR = path.join(CONTENT_DIR, 'projects');
const BLOG_DIR = path.join(CONTENT_DIR, 'blog');
const CONCEPTS_DIR = path.join(CONTENT_DIR, 'concepts');

const WORDS_PER_MINUTE = 200;

function calculateReadingTime(content: string): number {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

const MARIMO_SUFFIX = '.marimo.json';

function contentSlug(file: string): string | null {
  if (file.endsWith(MARIMO_SUFFIX)) return file.slice(0, -MARIMO_SUFFIX.length);
  if (file.endsWith('.md')) return file.slice(0, -3);
  if (file.endsWith('.json')) return file.slice(0, -5);
  return null;
}

/** Resolve collisions before parsing, so an invalid file cannot hide another publication. */
function assertUniqueSlugs(files: string[], directory: string): void {
  const seen = new Map<string, string>();
  for (const file of files) {
    const slug = contentSlug(file);
    if (slug === null) continue;
    const previous = seen.get(slug);
    if (previous) throw new Error(`Duplicate content slug "${slug}" in ${directory}: ${previous} and ${file}`);
    seen.set(slug, file);
  }
}

function readMarimoDocument(filePath: string, slug: string): MarimoDocument {
  // The content API is synchronous; the package's node readDocument is async.
  // Use its public validator at the filesystem boundary instead.
  const document = parseDocument(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  if (document.metadata.slug !== slug) {
    throw new Error(`Marimo slug mismatch: ${filePath} declares "${document.metadata.slug}", expected "${slug}"`);
  }
  if (!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(document.assetBase) ||
      document.assets.some(asset => !/^[a-f0-9]{64}\.[a-z0-9]+$/.test(asset.path))) {
    throw new Error(`Unsafe marimo asset path in ${filePath}`);
  }
  return document;
}

function marimoMetadata(document: MarimoDocument, slug: string) {
  // The comments thread lives in the publication YAML's host-owned `extra` namespace.
  const bluesky = document.metadata.extra?.bluesky;
  return {
    ...mapCommonMetadata({ ...document.metadata, categories: document.metadata.tags }, slug),
    ...(typeof bluesky === 'string' && bluesky ? { bluesky } : {}),
  };
}

interface CommonFrontmatter {
  title?: unknown;
  date?: unknown;
  categories?: unknown;
  tags?: unknown;
  description?: unknown;
  featured?: unknown;
}

// gray-matter parses unquoted YAML dates as Date objects at UTC midnight,
// so the YYYY-MM-DD slice round-trips the value as written.
export function normalizeDate(date: unknown): string {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  if (date) return String(date);
  return new Date().toISOString();
}

/**
 * Map the frontmatter fields shared by every content type
 * (blog, project, concept, webapp config).
 */
export function mapCommonMetadata(data: CommonFrontmatter, slug: string) {
  return {
    slug,
    title: data.title ? String(data.title) : slug,
    date: normalizeDate(data.date),
    categories: (data.categories ?? data.tags ?? []) as string[],
    description: data.description ? String(data.description) : '',
    featured: Boolean(data.featured),
  };
}

/** Project-only metadata shared by listing and detail readers. */
function mapProjectMetadata(data: {
  externalUrl?: string;
  links?: Project['links'];
  parent?: string;
  collection?: boolean;
  topics?: string[];
}) {
  return {
    externalUrl: data.externalUrl,
    links: data.links,
    parent: data.parent,
    topics: data.topics ?? [],
    collection: Boolean(data.collection),
  };
}

/**
 * Get all projects, ordered by most-recent GitHub push (newest first), falling back to the content
 * date. The `updated` map (project slug -> last-pushed ISO date) comes from the live GitHub fetch
 * (`getActivity()` in lib/github-activity.ts) and is injected by the projects page, so this stays
 * synchronous and free of any network dependency. Callers that don't have the map (sitemap, feed,
 * home featured) order by content date.
 */
export function getAllProjects(updated: Record<string, string> = {}): Project[] {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(PROJECTS_DIR).filter(file =>
    !file.startsWith('.') && fs.statSync(path.join(PROJECTS_DIR, file)).isFile()
  );
  assertUniqueSlugs(files, PROJECTS_DIR);
  const projects: Project[] = [];
  
  for (const file of files) {
    // Skip hidden files and directories
    if (typeof file !== 'string' || file.startsWith('.')) {
      continue;
    }
    
    const filePath = path.join(PROJECTS_DIR, file);
    
    // Skip directories
    if (fs.statSync(filePath).isDirectory()) {
      continue;
    }
    
    const slug = contentSlug(file);
    if (slug === null) continue;

    try {
      if (file.endsWith('.md')) {
        // Markdown project
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(fileContents);
        
        projects.push({
          category: 'project',
          type: data.externalUrl ? 'link' : 'markdown',
          ...mapCommonMetadata(data, slug),
          ...mapProjectMetadata(data),
        });
      } else if (file.endsWith(MARIMO_SUFFIX)) {
        const document = readMarimoDocument(filePath, slug);
        projects.push({
          category: 'project',
          type: 'marimo',
          ...marimoMetadata(document, slug),
          ...mapProjectMetadata({}),
        });
      } else if (file.endsWith('.json')) {
        // Webapp project
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const config: WebappConfig = JSON.parse(fileContents);
        
        projects.push({
          category: 'project',
          type: 'webapp',
          ...mapCommonMetadata(config, slug),
        });
      }
    } catch (error) {
      if (file.endsWith(MARIMO_SUFFIX)) throw error;
      console.error(`Error processing project file ${file}:`, error);
      // Skip malformed legacy files
    }
  }
  
  // Sort by last-updated time (newest first), falling back to the content date.
  const lastTouched = (p: Project) => new Date(updated[p.slug] || p.date).getTime();
  return projects.sort((a, b) => lastTouched(b) - lastTouched(a));
}

/** Portfolio surfaces show collections once; routes and sitemap still use getAllProjects. */
export function getTopLevelProjects(updated: Record<string, string> = {}): Project[] {
  return getAllProjects(updated).filter(project => !project.parent);
}

/**
 * Get project content by slug
 */
export function getProjectBySlug(slug: string): Content | null {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return null;
  }
  
  assertUniqueSlugs(fs.readdirSync(PROJECTS_DIR).filter(file =>
    !file.startsWith('.') && fs.statSync(path.join(PROJECTS_DIR, file)).isFile()
  ), PROJECTS_DIR);
  // Resolve the multi-part extension before the generic webapp JSON.
  const extensions = ['.md', MARIMO_SUFFIX, '.json'];
  
  for (const ext of extensions) {
    const filePath = path.join(PROJECTS_DIR, `${slug}${ext}`);
    
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      
      if (ext === '.md') {
        // Markdown project
        const { data, content } = matter(fileContents);
        
        // Check if this is an external link
        if (data.externalUrl) {
          return {
            type: 'link',
            content,
            metadata: {
              type: 'link',
              ...mapCommonMetadata(data, slug),
              ...mapProjectMetadata(data),
            },
          };
        }

        return {
          type: 'markdown',
          content,
          metadata: {
            type: 'markdown',
            ...mapCommonMetadata(data, slug),
            ...mapProjectMetadata(data),
          },
        };
      } else if (ext === MARIMO_SUFFIX) {
        const document = readMarimoDocument(filePath, slug);
        return {
          type: 'marimo',
          document,
          metadata: {
            type: 'marimo',
            ...marimoMetadata(document, slug),
            ...mapProjectMetadata({}),
          },
        };
      } else if (ext === '.json') {
        // Webapp project
        const config: WebappConfig = JSON.parse(fileContents);
        
        return {
          type: 'webapp',
          url: config.url,
          height: config.height || '800px',
          metadata: {
            type: 'webapp',
            ...mapCommonMetadata(config, slug),
          },
        };
      }
    }
  }
  
  return null;
}

/**
 * Get all blog posts sorted by date (newest first)
 */
export function getAllBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(BLOG_DIR).filter(
    file => typeof file === 'string' && !file.startsWith('.') &&
      (file.endsWith('.md') || file.endsWith(MARIMO_SUFFIX))
  );
  assertUniqueSlugs(files, BLOG_DIR);
  const posts: BlogPost[] = [];

  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file);
    const slug = contentSlug(file)!;

    try {
      if (file.endsWith(MARIMO_SUFFIX)) {
        const document = readMarimoDocument(filePath, slug);
        posts.push({
          category: 'blog',
          type: 'marimo',
          ...marimoMetadata(document, slug),
          readingTime: calculateReadingTime(document.plainText),
        });
        continue;
      }

      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);

      posts.push({
        category: 'blog',
        type: 'markdown',
        ...mapCommonMetadata(data, slug),
        readingTime: calculateReadingTime(content),
      });
    } catch (error) {
      if (file.endsWith(MARIMO_SUFFIX)) throw error;
      console.error(`Error processing blog post ${file}:`, error);
      // Skip malformed legacy files
    }
  }
  
  // Sort by date (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get blog post content by slug
 */
export function getBlogPostBySlug(slug: string): MarkdownContent | MarimoContent | null {
  if (!fs.existsSync(BLOG_DIR)) return null;
  assertUniqueSlugs(fs.readdirSync(BLOG_DIR).filter(file =>
    !file.startsWith('.') && (file.endsWith('.md') || file.endsWith(MARIMO_SUFFIX))
  ), BLOG_DIR);
  const mdPath = path.join(BLOG_DIR, `${slug}.md`);

  if (fs.existsSync(mdPath)) {
    const fileContents = fs.readFileSync(mdPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
      type: 'markdown',
      content: preprocessObsidian(content, slug),
      metadata: {
        type: 'markdown',
        ...mapCommonMetadata(data, slug),
        bluesky: data.bluesky || undefined,
        component: data.component || undefined,
      },
    };
  }

  const documentPath = path.join(BLOG_DIR, `${slug}${MARIMO_SUFFIX}`);
  if (fs.existsSync(documentPath)) {
    const document = readMarimoDocument(documentPath, slug);
    return {
      type: 'marimo',
      document,
      metadata: {
        type: 'marimo',
        ...marimoMetadata(document, slug),
      },
    };
  }

  return null;
}

export { calculateReadingTime };

/**
 * Get all concepts sorted by date (newest first)
 */
export function getAllConcepts(): Concept[] {
  if (!fs.existsSync(CONCEPTS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(CONCEPTS_DIR).filter(file => typeof file === 'string' && file.endsWith('.md'));
  const concepts: Concept[] = [];

  for (const file of files) {
    const filePath = path.join(CONCEPTS_DIR, file);
    const slug = file.replace(/\.md$/, '');

    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContents);

      concepts.push({
        category: 'concept',
        type: 'component',
        ...mapCommonMetadata(data, slug),
        component: data.component || slug,
      });
    } catch (error) {
      console.error(`Error processing concept file ${file}:`, error);
    }
  }

  return concepts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get concept content by slug
 */
export function getConceptBySlug(slug: string): ConceptContent | null {
  const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);

  return {
    type: 'component',
    content,
    component: data.component || slug,
    metadata: {
      type: 'component',
      ...mapCommonMetadata(data, slug),
    },
  };
}

/**
 * Get featured content for home page
 */
export function getFeaturedContent(): {
  projects: Project[];
  posts: BlogPost[];
  concepts: Concept[];
} {
  const allProjects = getTopLevelProjects();
  const allPosts = getAllBlogPosts();
  const allConcepts = getAllConcepts();

  // Get featured items or fallback to most recent
  const featuredProjects = allProjects.filter(p => p.featured);
  const featuredPosts = allPosts.filter(p => p.featured);
  const featuredConcepts = allConcepts.filter(c => c.featured);

  return {
    projects: featuredProjects.length > 0 ? featuredProjects : allProjects.slice(0, 3),
    posts: featuredPosts.length > 0 ? featuredPosts : allPosts.slice(0, 3),
    concepts: featuredConcepts.length > 0 ? featuredConcepts : allConcepts.slice(0, 3),
  };
}


