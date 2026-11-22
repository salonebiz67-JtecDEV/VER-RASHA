import { resolveApiUrl } from '../config/api';
import { supabase } from '../lib/supabase';
import { optimizeImageForUpload, type ClientOptimizedImage } from '../utils/imageOptimizer';

export type MediaScope = 'products' | 'collections' | 'campaigns' | 'hero' | 'categories';

export interface UploadedImageResponse {
  deduplicated: boolean;
  storagePath: string;
  cardStoragePath: string;
  detailStoragePath: string;
  publicUrl: string;
  cardPublicUrl: string;
  detailPublicUrl: string;
  contentHash: string;
  imageVersion: number;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  cardSizeBytes: number;
  detailSizeBytes: number;
  imageRecord?: {
    id: string;
    product_id: string;
    storage_path: string;
    card_storage_path: string | null;
    detail_storage_path: string | null;
    image_version: number;
    is_primary: boolean;
    sort_order: number;
  } | null;
}

export interface UploadBoutiqueImageOptions {
  file: File;
  scope?: MediaScope;
  entityId?: string;
  productId?: string;
  altText?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  onProgress?: (percent: number) => void;
  onOptimized?: (summary: ClientOptimizedImage) => void;
  signal?: AbortSignal;
}

async function resolveOwnerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'VEYRASHA-Client',
  };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

function sendMultipartWithProgress<T>(params: {
  method: 'POST' | 'PUT';
  url: string;
  formData: FormData;
  headers: Record<string, string>;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<T> {
  const { method, url, formData, headers, onProgress, signal } = params;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.withCredentials = true;

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    const abortHandler = () => {
      xhr.abort();
      reject(new Error('Image upload was cancelled.'));
    };

    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const pct = Math.min(99, Math.max(5, Math.round((event.loaded / event.total) * 100)));
      onProgress(pct);
    };

    xhr.onerror = () => {
      signal?.removeEventListener('abort', abortHandler);
      reject(new Error('Network error while uploading image. Please verify connection and retry.'));
    };

    xhr.onload = () => {
      signal?.removeEventListener('abort', abortHandler);
      let parsed: Record<string, unknown> = {};
      try {
        parsed = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(parsed as T);
        return;
      }

      const errorMessage =
        typeof parsed.error === 'string' && parsed.error.trim()
          ? parsed.error
          : xhr.status === 401 || xhr.status === 403
          ? 'Owner authorization is required to upload or modify boutique images.'
          : `Upload failed (${xhr.status}). Please try again.`;

      reject(new Error(errorMessage));
    };

    xhr.send(formData);
  });
}

/**
 * Compresses image on-device into Card + Detail WebP blobs and uploads through
 * the owner-protected backend endpoint (`POST /api/owner/images/upload`).
 */
export async function uploadBoutiqueImage(
  options: UploadBoutiqueImageOptions
): Promise<UploadedImageResponse> {
  const {
    file,
    scope = 'products',
    entityId,
    productId,
    altText,
    isPrimary,
    sortOrder,
    onProgress,
    onOptimized,
    signal,
  } = options;

  onProgress?.(2);
  const optimized = await optimizeImageForUpload(file);
  onOptimized?.(optimized);
  onProgress?.(10);

  const formData = new FormData();
  formData.append(
    'image',
    optimized.detailBlob,
    optimized.detailBlob.type === 'image/webp' ? 'detail.webp' : 'detail.jpg'
  );
  if (optimized.cardBlob.type === 'image/webp') {
    formData.append('card', optimized.cardBlob, 'card.webp');
  }

  formData.append('scope', scope);
  if (entityId) formData.append('entityId', entityId);
  if (productId) formData.append('productId', productId);
  if (altText) formData.append('altText', altText);
  if (typeof isPrimary === 'boolean') formData.append('isPrimary', String(isPrimary));
  if (typeof sortOrder === 'number') formData.append('sortOrder', String(sortOrder));

  const headers = await resolveOwnerHeaders();
  return sendMultipartWithProgress<UploadedImageResponse>({
    method: 'POST',
    url: resolveApiUrl('/api/owner/images/upload'),
    formData,
    headers,
    onProgress,
    signal,
  });
}

/**
 * Compresses and replaces an existing product image record safely via `PUT /api/owner/images/:id/replace`.
 * The backend removes old Storage files ONLY after replacement succeeds and ONLY when unreferenced.
 */
export async function replaceBoutiqueImage(params: {
  imageId: string;
  file: File;
  altText?: string;
  onProgress?: (percent: number) => void;
  onOptimized?: (summary: ClientOptimizedImage) => void;
  signal?: AbortSignal;
}): Promise<UploadedImageResponse> {
  const { imageId, file, altText, onProgress, onOptimized, signal } = params;

  onProgress?.(2);
  const optimized = await optimizeImageForUpload(file);
  onOptimized?.(optimized);
  onProgress?.(10);

  const formData = new FormData();
  formData.append(
    'image',
    optimized.detailBlob,
    optimized.detailBlob.type === 'image/webp' ? 'detail.webp' : 'detail.jpg'
  );
  if (optimized.cardBlob.type === 'image/webp') {
    formData.append('card', optimized.cardBlob, 'card.webp');
  }
  if (altText !== undefined) {
    formData.append('altText', altText);
  }

  const headers = await resolveOwnerHeaders();
  return sendMultipartWithProgress<UploadedImageResponse>({
    method: 'PUT',
    url: resolveApiUrl(`/api/owner/images/${encodeURIComponent(imageId)}/replace`),
    formData,
    headers,
    onProgress,
    signal,
  });
}

export async function deleteBoutiqueImage(imageId: string): Promise<{ ok: boolean }> {
  const headers = await resolveOwnerHeaders();
  const response = await fetch(resolveApiUrl(`/api/owner/images/${encodeURIComponent(imageId)}`), {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
  if (!response.ok) {
    throw new Error(payload.error || 'Unable to delete boutique image.');
  }
  return { ok: true };
}
