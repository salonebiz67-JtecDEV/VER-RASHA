import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const BOUTIQUE_MEDIA_BUCKET = 'boutique-media';
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const CARD_MAX_WIDTH = 560;
export const CARD_MAX_HEIGHT = 700;
export const DETAIL_MAX_WIDTH = 1440;
export const DETAIL_MAX_HEIGHT = 1800;
export const IMMUTABLE_CACHE_CONTROL_SECONDS = '31536000';

export type DetectedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
export type MediaScope = 'products' | 'collections' | 'campaigns' | 'hero' | 'categories';

export interface ProcessedImageVariants {
  contentHash: string;
  sourceMime: DetectedImageMime;
  width: number;
  height: number;
  sourceBytes: number;
  cardBuffer: Buffer;
  cardSizeBytes: number;
  detailBuffer: Buffer;
  detailSizeBytes: number;
  skippedDetailRecompression: boolean;
  skippedCardRecompression: boolean;
}

export interface StoredMediaUploadResult {
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
}

export function detectImageMagicMime(buffer: Buffer): DetectedImageMime | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  // AVIF: .... "ftypavif" or "ftypavis"
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') {
      return 'image/avif';
    }
  }

  return null;
}

export function sanitizeScopeSegment(rawScope: unknown): MediaScope {
  const value = typeof rawScope === 'string' ? rawScope.trim().toLowerCase() : '';
  if (
    value === 'collections' ||
    value === 'campaigns' ||
    value === 'hero' ||
    value === 'categories'
  ) {
    return value;
  }
  return 'products';
}

export function sanitizeEntityFolder(rawId: unknown): string {
  const value = typeof rawId === 'string' ? rawId.trim() : '';
  if (!value) return 'shared';
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return safe || 'shared';
}

export function extractBucketObjectPath(input: string | null | undefined): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;

  // Strip query strings (?v=2) and fragments
  const withoutQuery = trimmed.split('#')[0].split('?')[0].trim();
  if (!withoutQuery || withoutQuery.includes('..')) return null;

  const marker = `/storage/v1/object/public/${BOUTIQUE_MEDIA_BUCKET}/`;
  const markerIdx = withoutQuery.indexOf(marker);
  if (markerIdx !== -1) {
    const extracted = withoutQuery.slice(markerIdx + marker.length).replace(/^\/+/, '');
    return extracted && !extracted.includes('..') ? extracted : null;
  }

  if (
    withoutQuery.startsWith('http://') ||
    withoutQuery.startsWith('https://') ||
    withoutQuery.startsWith('/')
  ) {
    return null;
  }

  return /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(withoutQuery) ? withoutQuery : null;
}

export function appendVersionQuery(url: string, version: number): string {
  if (!url) return '';
  if (/[?&]v=\d+/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Math.max(1, Math.floor(version))}`;
}

export function getPublicMediaUrl(
  admin: SupabaseClient,
  storagePath: string,
  version = 1
): string {
  const cleanPath = extractBucketObjectPath(storagePath) ?? storagePath.replace(/^\/+/, '');
  if (!cleanPath) return '';
  const { data } = admin.storage.from(BOUTIQUE_MEDIA_BUCKET).getPublicUrl(cleanPath);
  return appendVersionQuery(data.publicUrl, version);
}

/**
 * Validates raw bytes, strips EXIF metadata, prevents upscaling, and generates
 * optimized Card (small WebP) + Detail (large high-quality WebP) variants.
 * Also supports pre-compressed client variants while enforcing server-side caps.
 */
export async function processImageVariants(
  sourceBuffer: Buffer,
  precompressedCardBuffer?: Buffer | null
): Promise<ProcessedImageVariants> {
  if (!Buffer.isBuffer(sourceBuffer) || sourceBuffer.length === 0) {
    throw new Error('Uploaded image file is empty.');
  }
  if (sourceBuffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Image exceeds the 12 MB upload size limit.');
  }

  const sourceMime = detectImageMagicMime(sourceBuffer);
  if (!sourceMime) {
    throw new Error('Unsupported image format. Upload JPEG, PNG, WebP, or AVIF images only.');
  }

  const metadata = await sharp(sourceBuffer, { failOn: 'error', limitInputPixels: 64_000_000 }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 32 || height < 32) {
    throw new Error('Image resolution is too small (minimum 32x32 pixels).');
  }
  if (width > 10000 || height > 10000) {
    throw new Error('Image dimensions exceed 10,000 pixels.');
  }

  const contentHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex');

  // Skip recompression when source is already compact WebP within Detail bounds
  let detailBuffer: Buffer;
  let skippedDetailRecompression = false;

  if (
    sourceMime === 'image/webp' &&
    width <= DETAIL_MAX_WIDTH &&
    height <= DETAIL_MAX_HEIGHT &&
    sourceBuffer.length <= 480 * 1024
  ) {
    detailBuffer = sourceBuffer;
    skippedDetailRecompression = true;
  } else {
    detailBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: DETAIL_MAX_WIDTH,
        height: DETAIL_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 86, effort: 4 })
      .toBuffer();

    // If source was already an appropriately bounded WebP and smaller, keep original
    if (
      sourceMime === 'image/webp' &&
      width <= DETAIL_MAX_WIDTH &&
      height <= DETAIL_MAX_HEIGHT &&
      sourceBuffer.length <= detailBuffer.length
    ) {
      detailBuffer = sourceBuffer;
      skippedDetailRecompression = true;
    }
  }

  // Validate pre-compressed card buffer if client uploaded one; otherwise generate via sharp
  let cardBuffer: Buffer | null = null;
  let skippedCardRecompression = false;

  if (precompressedCardBuffer && precompressedCardBuffer.length > 0 && precompressedCardBuffer.length <= 2 * 1024 * 1024) {
    const cardMime = detectImageMagicMime(precompressedCardBuffer);
    if (cardMime === 'image/webp') {
      try {
        const cardMeta = await sharp(precompressedCardBuffer, { failOn: 'error' }).metadata();
        if (
          (cardMeta.width ?? 0) >= 32 &&
          (cardMeta.height ?? 0) >= 32 &&
          (cardMeta.width ?? 0) <= CARD_MAX_WIDTH &&
          (cardMeta.height ?? 0) <= CARD_MAX_HEIGHT &&
          precompressedCardBuffer.length <= 180 * 1024
        ) {
          cardBuffer = precompressedCardBuffer;
          skippedCardRecompression = true;
        }
      } catch {
        cardBuffer = null;
      }
    }
  }

  if (!cardBuffer) {
    if (
      sourceMime === 'image/webp' &&
      width <= CARD_MAX_WIDTH &&
      height <= CARD_MAX_HEIGHT &&
      sourceBuffer.length <= 150 * 1024
    ) {
      cardBuffer = sourceBuffer;
      skippedCardRecompression = true;
    } else {
      cardBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize({
          width: CARD_MAX_WIDTH,
          height: CARD_MAX_HEIGHT,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();
    }
  }

  const finalMeta = await sharp(detailBuffer).metadata();

  return {
    contentHash,
    sourceMime,
    width: finalMeta.width ?? width,
    height: finalMeta.height ?? height,
    sourceBytes: sourceBuffer.length,
    cardBuffer,
    cardSizeBytes: cardBuffer.length,
    detailBuffer,
    detailSizeBytes: detailBuffer.length,
    skippedDetailRecompression,
    skippedCardRecompression,
  };
}

/**
 * Checks if an identical image hash already exists in `public.product_images`
 * and still has valid paths so duplicate uploads do not create redundant copies.
 */
async function findReusableImageByHash(
  admin: SupabaseClient,
  contentHash: string,
  excludeImageId?: string
): Promise<{
  storage_path: string;
  card_storage_path: string | null;
  detail_storage_path: string | null;
  image_version: number;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  card_size_bytes: number | null;
  detail_size_bytes: number | null;
} | null> {
  let query = admin
    .from('product_images')
    .select(
      'id, storage_path, card_storage_path, detail_storage_path, image_version, width, height, size_bytes, card_size_bytes, detail_size_bytes'
    )
    .eq('content_hash', contentHash)
    .limit(1);

  if (excludeImageId) {
    query = query.neq('id', excludeImageId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (!row || typeof row.storage_path !== 'string' || !row.storage_path) {
    return null;
  }

  return row;
}

export async function uploadOptimizedMediaToSupabase(params: {
  admin: SupabaseClient;
  sourceBuffer: Buffer;
  precompressedCardBuffer?: Buffer | null;
  scope: MediaScope;
  entityId?: string;
  version?: number;
  excludeImageId?: string;
  allowDedup?: boolean;
}): Promise<{ result: StoredMediaUploadResult; newlyUploadedPaths: string[] }> {
  const {
    admin,
    sourceBuffer,
    precompressedCardBuffer,
    scope,
    entityId,
    version = 1,
    excludeImageId,
    allowDedup = true,
  } = params;

  const processed = await processImageVariants(sourceBuffer, precompressedCardBuffer);

  if (allowDedup) {
    const existing = await findReusableImageByHash(admin, processed.contentHash, excludeImageId);
    if (existing) {
      const cardPath = existing.card_storage_path || existing.storage_path;
      const detailPath = existing.detail_storage_path || existing.storage_path;
      const resolvedVersion = existing.image_version || 1;
      return {
        result: {
          deduplicated: true,
          storagePath: detailPath,
          cardStoragePath: cardPath,
          detailStoragePath: detailPath,
          publicUrl: getPublicMediaUrl(admin, detailPath, resolvedVersion),
          cardPublicUrl: getPublicMediaUrl(admin, cardPath, resolvedVersion),
          detailPublicUrl: getPublicMediaUrl(admin, detailPath, resolvedVersion),
          contentHash: processed.contentHash,
          imageVersion: resolvedVersion,
          mimeType: 'image/webp',
          width: existing.width ?? processed.width,
          height: existing.height ?? processed.height,
          sizeBytes: existing.size_bytes ?? processed.detailSizeBytes,
          cardSizeBytes: existing.card_size_bytes ?? processed.cardSizeBytes,
          detailSizeBytes: existing.detail_size_bytes ?? processed.detailSizeBytes,
        },
        newlyUploadedPaths: [],
      };
    }
  }

  const folder = sanitizeEntityFolder(entityId);
  const hashPrefix = processed.contentHash.slice(0, 16);
  const uniqueSuffix = crypto.randomBytes(3).toString('hex');
  const safeVersion = Math.max(1, Math.floor(version));

  const cardStoragePath = `${scope}/${folder}/${hashPrefix}-v${safeVersion}-${uniqueSuffix}-card.webp`;
  const detailStoragePath = `${scope}/${folder}/${hashPrefix}-v${safeVersion}-${uniqueSuffix}-detail.webp`;

  const uploadedPaths: string[] = [];

  const { error: cardErr } = await admin.storage
    .from(BOUTIQUE_MEDIA_BUCKET)
    .upload(cardStoragePath, processed.cardBuffer, {
      cacheControl: IMMUTABLE_CACHE_CONTROL_SECONDS,
      contentType: 'image/webp',
      upsert: false,
    });

  if (cardErr) {
    throw new Error(`Failed to upload card image variant: ${cardErr.message}`);
  }
  uploadedPaths.push(cardStoragePath);

  const { error: detailErr } = await admin.storage
    .from(BOUTIQUE_MEDIA_BUCKET)
    .upload(detailStoragePath, processed.detailBuffer, {
      cacheControl: IMMUTABLE_CACHE_CONTROL_SECONDS,
      contentType: 'image/webp',
      upsert: false,
    });

  if (detailErr) {
    await admin.storage.from(BOUTIQUE_MEDIA_BUCKET).remove(uploadedPaths).catch(() => {});
    throw new Error(`Failed to upload detail image variant: ${detailErr.message}`);
  }
  uploadedPaths.push(detailStoragePath);

  return {
    result: {
      deduplicated: false,
      storagePath: detailStoragePath,
      cardStoragePath,
      detailStoragePath,
      publicUrl: getPublicMediaUrl(admin, detailStoragePath, safeVersion),
      cardPublicUrl: getPublicMediaUrl(admin, cardStoragePath, safeVersion),
      detailPublicUrl: getPublicMediaUrl(admin, detailStoragePath, safeVersion),
      contentHash: processed.contentHash,
      imageVersion: safeVersion,
      mimeType: 'image/webp',
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.detailSizeBytes,
      cardSizeBytes: processed.cardSizeBytes,
      detailSizeBytes: processed.detailSizeBytes,
    },
    newlyUploadedPaths: uploadedPaths,
  };
}

/**
 * Collects every Storage path currently referenced across all catalog and historical
 * order snapshot tables so live or historical assets are NEVER deleted prematurely.
 */
async function collectAllReferencedPaths(admin: SupabaseClient): Promise<Set<string>> {
  const referenced = new Set<string>();

  const addCandidate = (value: unknown): void => {
    if (typeof value !== 'string') return;
    const path = extractBucketObjectPath(value);
    if (path) referenced.add(path);
  };

  const [productImagesRes, categoriesRes, collectionsRes, campaignsRes, settingsRes, orderItemsRes] =
    await Promise.all([
      admin.from('product_images').select('storage_path, card_storage_path, detail_storage_path'),
      admin.from('categories').select('image_path'),
      admin.from('collections').select('image_path'),
      admin.from('campaigns').select('image_path'),
      admin.from('store_settings').select('hero_image_path').eq('id', 1).maybeSingle(),
      admin.from('order_items').select('image_url_snapshot'),
    ]);

  if (Array.isArray(productImagesRes.data)) {
    for (const row of productImagesRes.data as Record<string, unknown>[]) {
      addCandidate(row.storage_path);
      addCandidate(row.card_storage_path);
      addCandidate(row.detail_storage_path);
    }
  }
  if (Array.isArray(categoriesRes.data)) {
    for (const row of categoriesRes.data as Record<string, unknown>[]) {
      addCandidate(row.image_path);
    }
  }
  if (Array.isArray(collectionsRes.data)) {
    for (const row of collectionsRes.data as Record<string, unknown>[]) {
      addCandidate(row.image_path);
    }
  }
  if (Array.isArray(campaignsRes.data)) {
    for (const row of campaignsRes.data as Record<string, unknown>[]) {
      addCandidate(row.image_path);
    }
  }
  if (settingsRes.data && typeof settingsRes.data === 'object') {
    addCandidate((settingsRes.data as Record<string, unknown>).hero_image_path);
  }
  if (Array.isArray(orderItemsRes.data)) {
    for (const row of orderItemsRes.data as Record<string, unknown>[]) {
      addCandidate(row.image_url_snapshot);
    }
  }

  return referenced;
}

/**
 * Safely deletes candidate paths from `boutique-media` ONLY if zero database rows
 * or historical order snapshots reference them.
 */
export async function deleteUnreferencedStorageObjects(
  admin: SupabaseClient,
  candidatePaths: (string | null | undefined)[]
): Promise<{ removed: string[]; retainedBecauseReferenced: string[] }> {
  const uniqueCandidates = Array.from(
    new Set(
      candidatePaths
        .map((p) => extractBucketObjectPath(p))
        .filter((p): p is string => Boolean(p))
    )
  );

  if (uniqueCandidates.length === 0) {
    return { removed: [], retainedBecauseReferenced: [] };
  }

  const referenced = await collectAllReferencedPaths(admin);
  const toRemove: string[] = [];
  const retained: string[] = [];

  for (const path of uniqueCandidates) {
    if (referenced.has(path)) {
      retained.push(path);
    } else {
      toRemove.push(path);
    }
  }

  if (toRemove.length > 0) {
    const { error } = await admin.storage.from(BOUTIQUE_MEDIA_BUCKET).remove(toRemove);
    if (error) {
      console.error('Failed to remove unused boutique-media files:', error.message);
      return { removed: [], retainedBecauseReferenced: retained };
    }
  }

  return { removed: toRemove, retainedBecauseReferenced: retained };
}
