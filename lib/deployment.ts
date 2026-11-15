/** Deployment identity for server-side runtime isolation. */
export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === 'preview';
}

export function assertProductionDeployment(): void {
  if (!isProductionDeployment()) throw new Error('Production deployment required');
}

export function previewCachePrefix(): string {
  return `preview:${encodeURIComponent(process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_URL || 'unknown')}:`;
}
