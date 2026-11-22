function normalizeBasePath(rawBase: string | undefined): string {
  const trimmed = (rawBase || '/').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);

export function resolveAssetUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return '';

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    if (APP_BASE_PATH !== '/' && trimmed.startsWith(APP_BASE_PATH)) {
      return trimmed;
    }
    return `${APP_BASE_PATH}${trimmed.slice(1)}`;
  }

  return `${APP_BASE_PATH}${trimmed}`;
}
