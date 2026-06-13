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
import { parseNotebook, parseMarimoNotebook, isMarimoSource, extractMetadata } from '@blog/notebook-parser';
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
    
    const slug = file.replace(/\.(md|ipynb|json|py)$/, '');

    try {
      if (file.endsWith('.md')) {
        // Markdown project
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(fileContents);
        
        projects.push({
          category: 'project',
          slug,
          type: data.externalUrl ? 'link' : 'markdown',
          title: data.title || slug,
          date: data.date || new Date().toISOString(),
          categories: data.categories || [],
          description: data.description || '',
          featured: data.featured || false,
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
      } else if (file.endsWith('.py')) {
        // marimo notebook project (skip non-marimo .py scripts)
        const fileContents = fs.readFileSync(filePath, 'utf8');
        if (!isMarimoSource(fileContents)) {
          continue;
        }

        const notebook = parseMarimoNotebook(filePath);
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
          slug,
          type: 'webapp',
          title: config.title || slug,
          date: config.date || new Date().toISOString(),
          categories: config.categories || [],
          description: config.description || '',
          featured: config.featured || false,
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
export function getProjectBySlug(slug: string): Content {
  if (!fs.existsSync(PROJECTS_DIR)) {
    throw new Error('Projects directory not found');
  }
  
  // Try different file extensions (.py last so .md/.ipynb/.json win on collision)
  const extensions = ['.md', '.ipynb', '.json', '.py'];
  
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
              slug,
              type: 'link',
              title: data.title || slug,
              date: data.date || new Date().toISOString(),
              categories: data.categories || [],
              description: data.description || '',
              featured: data.featured || false,
              externalUrl: data.externalUrl,
            },
          };
        }
        
        return {
          type: 'markdown',
          content,
          metadata: {
            slug,
            type: 'markdown',
            title: data.title || slug,
            date: data.date || new Date().toISOString(),
            categories: data.categories || [],
            description: data.description || '',
            featured: data.featured || false,
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
      } else if (ext === '.py') {
        // marimo notebook project (skip non-marimo .py scripts)
        if (!isMarimoSource(fileContents)) {
          continue;
        }

        const notebook = parseMarimoNotebook(filePath);
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
            slug,
            type: 'webapp',
            title: config.title || slug,
            date: config.date || new Date().toISOString(),
            categories: config.categories || [],
            description: config.description || '',
            featured: config.featured || false,
          },
        };
      }
    }
  }
  
  throw new Error(`Project not found: ${slug}`);
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
        slug,
        type: 'markdown',
        title: data.title || slug,
        date: data.date || new Date().toISOString(),
        categories: data.categories || data.tags || [],
        description: data.description || '',
        featured: data.featured || false,
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
export function getBlogPostBySlug(slug: string): MarkdownContent {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Blog post not found: ${slug}`);
  }
  
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);

  return {
    type: 'markdown',
    content: preprocessObsidian(content, slug),
    metadata: {
      slug,
      type: 'markdown',
      title: data.title || slug,
      date: data.date || new Date().toISOString(),
      categories: data.categories || data.tags || [],
      description: data.description || '',
      featured: data.featured || false,
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
        slug,
        type: 'component',
        title: data.title || slug,
        date: data.date || new Date().toISOString(),
        categories: data.categories || [],
        description: data.description || '',
        featured: data.featured || false,
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
export function getConceptBySlug(slug: string): ConceptContent {
  const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Concept not found: ${slug}`);
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);

  return {
    type: 'component',
    content,
    component: data.component || slug,
    metadata: {
      slug,
      type: 'component',
      title: data.title || slug,
      date: data.date || new Date().toISOString(),
      categories: data.categories || [],
      description: data.description || '',
      featured: data.featured || false,
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


