const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const API_BASE_URL = rawApiBase;

function normalizeBasePath(rawBase: string | undefined): string {
  const trimmed = (rawBase || '/').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function wsUrl(path = '/ws'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE_URL) {
    try {
      const parsed = new URL(API_BASE_URL);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${parsed.host}${normalizedPath}`;
    } catch {
      // Fall through to current host if VITE_API_BASE_URL is relative or malformed
    }
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${normalizedPath}`;
  }

  return normalizedPath;
}

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
