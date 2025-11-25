import { Feed } from 'feed';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import {
  getAllBlogPosts,
  getAllProjects,
  getBlogPostBySlug,
  getProjectBySlug,
} from './content';
import { BlogPost, Project } from './types';

const SITE_URL = 'https://spencerboucher.com';
const AUTHOR = {
  name: 'Spencer Boucher',
  link: SITE_URL,
};

/**
 * Convert markdown content to HTML string
 */
async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);

  return String(result);
}

/**
 * Generate the RSS/Atom feed with all blog posts and projects
 */
export async function generateFeed(): Promise<Feed> {
  const feed = new Feed({
    title: 'Spencer Boucher',
    description: 'Blog posts and projects by Spencer Boucher',
    id: SITE_URL,
    link: SITE_URL,
    language: 'en',
    image: `${SITE_URL}/images/avatar.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}, Spencer Boucher`,
    updated: new Date(),
    feedLinks: {
      rss2: `${SITE_URL}/feed.xml`,
      atom: `${SITE_URL}/atom.xml`,
    },
    author: AUTHOR,
  });

  // Get all content
  const blogPosts = getAllBlogPosts();
  const projects = getAllProjects();

  // Combine and sort by date (newest first)
  const allContent: Array<{ item: BlogPost | Project; category: 'blog' | 'project' }> = [
    ...blogPosts.map((post) => ({ item: post, category: 'blog' as const })),
    ...projects.map((project) => ({ item: project, category: 'project' as const })),
  ];

  allContent.sort(
    (a, b) => new Date(b.item.date).getTime() - new Date(a.item.date).getTime()
  );

  // Process each item
  for (const { item, category } of allContent) {
    const url =
      category === 'blog'
        ? `${SITE_URL}/blog/${item.slug}`
        : `${SITE_URL}/projects/${item.slug}`;

    let htmlContent = '';

    try {
      if (category === 'blog') {
        // Get full blog post content and convert to HTML
        const fullPost = getBlogPostBySlug(item.slug);
        htmlContent = await markdownToHtml(fullPost.content);
      } else {
        // Get project content
        const fullProject = getProjectBySlug(item.slug);

        if (fullProject.type === 'markdown') {
          htmlContent = await markdownToHtml(fullProject.content);
        } else if (fullProject.type === 'notebook') {
          // For notebooks, use description with a link to view the full notebook
          htmlContent = `<p>${item.description || 'View the full notebook on the website.'}</p>
            <p><a href="${url}">View full notebook →</a></p>`;
        } else if (fullProject.type === 'webapp') {
          // For webapps, use description with a link to the interactive app
          htmlContent = `<p>${item.description || 'View the interactive application on the website.'}</p>
            <p><a href="${url}">View interactive app →</a></p>`;
        } else if (fullProject.type === 'link') {
          // For external links, include description and link
          const externalUrl = fullProject.metadata.externalUrl;
          htmlContent = `<p>${item.description || ''}</p>
            <p><a href="${externalUrl}">View external resource →</a></p>`;
        }
      }
    } catch (error) {
      console.error(`Error processing feed item ${item.slug}:`, error);
      htmlContent = `<p>${item.description || ''}</p>`;
    }

    feed.addItem({
      title: item.title,
      id: url,
      link: url,
      description: item.description || '',
      content: htmlContent,
      author: [AUTHOR],
      date: new Date(item.date),
      category: (item.categories || []).map((cat) => ({ name: cat })),
    });
  }

  return feed;
}
