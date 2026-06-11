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
  WebappConfig,
} from './types';
import { parseNotebook, extractMetadata } from '@blog/notebook-parser';
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
function normalizeDate(date: unknown): string {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  if (date) return String(date);
  return new Date().toISOString();
}

/**
 * Map the frontmatter fields shared by every content type
 * (blog, project, concept, webapp config).
 */
function mapCommonMetadata(data: CommonFrontmatter, slug: string) {
  return {
    slug,
    title: data.title ? String(data.title) : slug,
    date: normalizeDate(data.date),
    categories: (data.categories ?? data.tags ?? []) as string[],
    description: data.description ? String(data.description) : '',
    featured: Boolean(data.featured),
  };
}

/**
 * Get all projects sorted by date (newest first)
 */
export function getAllProjects(): Project[] {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(PROJECTS_DIR);
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
    
    const slug = file.replace(/\.(md|ipynb|json)$/, '');
    
    try {
      if (file.endsWith('.md')) {
        // Markdown project
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(fileContents);
        
        projects.push({
          category: 'project',
          type: data.externalUrl ? 'link' : 'markdown',
          ...mapCommonMetadata(data, slug),
          externalUrl: data.externalUrl,
        });
      } else if (file.endsWith('.ipynb')) {
        // Notebook project
        const notebook = parseNotebook(filePath);
        
        // Extract metadata from notebook metadata or first cell
        const metadata = extractMetadata(notebook, slug);
        
        projects.push({
          category: 'project',
          slug,
          type: 'notebook',
          title: metadata.title,
          date: metadata.date,
          categories: metadata.categories,
          description: metadata.description,
          featured: metadata.featured,
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
      console.error(`Error processing project file ${file}:`, error);
      // Skip malformed files
    }
  }
  
  // Sort by date (newest first)
  return projects.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get project content by slug
 */
export function getProjectBySlug(slug: string): Content | null {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return null;
  }
  
  // Try different file extensions
  const extensions = ['.md', '.ipynb', '.json'];
  
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
              externalUrl: data.externalUrl,
            },
          };
        }

        return {
          type: 'markdown',
          content,
          metadata: {
            type: 'markdown',
            ...mapCommonMetadata(data, slug),
            externalUrl: data.externalUrl,
          },
        };
      } else if (ext === '.ipynb') {
        // Notebook project
        const notebook = parseNotebook(filePath);
        
        const metadata = extractMetadata(notebook, slug);
        
        return {
          type: 'notebook',
          notebookData: notebook,
          metadata: {
            slug,
            type: 'notebook',
            title: metadata.title,
            date: metadata.date,
            categories: metadata.categories,
            description: metadata.description,
            featured: metadata.featured,
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
  
  const files = fs.readdirSync(BLOG_DIR).filter(file => typeof file === 'string' && file.endsWith('.md'));
  const posts: BlogPost[] = [];
  
  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file);
    const slug = file.replace(/\.md$/, '');
    
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);

      posts.push({
        category: 'blog',
        type: 'markdown',
        ...mapCommonMetadata(data, slug),
        readingTime: calculateReadingTime(content),
      });
    } catch (error) {
      console.error(`Error processing blog post ${file}:`, error);
      // Skip malformed files
    }
  }
  
  // Sort by date (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get blog post content by slug
 */
export function getBlogPostBySlug(slug: string): MarkdownContent | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);

  return {
    type: 'markdown',
    content: preprocessObsidian(content, slug),
    metadata: {
      type: 'markdown',
      ...mapCommonMetadata(data, slug),
    },
  };
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
  const allProjects = getAllProjects();
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


