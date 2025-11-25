/**
 * Shared language configuration for syntax highlighting
 * Adds dockerfile and other commonly needed languages to the default set
 */
import { common } from 'lowlight';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';

// Create languages object with common languages plus extras
export const languages = {
  ...common,
  dockerfile,
  docker: dockerfile, // alias
  nginx,
};
