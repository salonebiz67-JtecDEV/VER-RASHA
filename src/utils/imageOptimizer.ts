export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export const MAX_RAW_IMAGE_BYTES = 12 * 1024 * 1024;
export const CARD_MAX_WIDTH = 560;
export const CARD_MAX_HEIGHT = 700;
export const DETAIL_MAX_WIDTH = 1440;
export const DETAIL_MAX_HEIGHT = 1800;

const CARD_WEBP_QUALITY = 0.78;
const DETAIL_WEBP_QUALITY = 0.86;
const SKIP_CARD_RECOMPRESS_BYTES = 150 * 1024;
const SKIP_DETAIL_RECOMPRESS_BYTES = 450 * 1024;

export interface ClientOptimizedImage {
  cardBlob: Blob;
  detailBlob: Blob;
  originalBytes: number;
  cardBytes: number;
  detailBytes: number;
  width: number;
  height: number;
  contentHash: string;
  skippedDetailRecompression: boolean;
  skippedCardRecompression: boolean;
  mimeType: string;
}

export function formatFileSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateImageFile(file: File): void {
  if (!file || !(file instanceof File)) {
    throw new Error('Please choose a valid image file.');
  }

  const normalizedMime = file.type.trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime)) {
    throw new Error(
      'Unsupported image format. Please choose a JPEG, PNG, WebP, or AVIF image.'
    );
  }

  if (file.size <= 0) {
    throw new Error('The selected image file is empty.');
  }

  if (file.size > MAX_RAW_IMAGE_BYTES) {
    throw new Error(
      `Image file is too large (${formatFileSizeLabel(file.size)}). Maximum allowed size is ${formatFileSizeLabel(MAX_RAW_IMAGE_BYTES)}.`
    );
  }
}

async function computeSha256Hex(file: Blob): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return '';
  }
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface DecodedBitmapSource {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) => void;
  cleanup: () => void;
}

async function decodeImageFile(file: File): Promise<DecodedBitmapSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below for older mobile WebViews
    }
  }

  return await new Promise<DecodedBitmapSource>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read image dimensions. The file may be corrupted.'));
    };
    img.src = objectUrl;
  });
}

function fitDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
    return { width: srcWidth, height: srcHeight };
  }
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: Math.max(1, Math.round(srcWidth * ratio)),
    height: Math.max(1, Math.round(srcHeight * ratio)),
  };
}

async function renderCanvasBlob(
  decoded: DecodedBitmapSource,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize image compression canvas.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  decoded.draw(ctx, targetWidth, targetHeight);

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
  });

  if (webpBlob && webpBlob.size > 0 && webpBlob.type === 'image/webp') {
    return webpBlob;
  }

  // Fallback for legacy WebViews lacking WebP canvas encoder
  const jpegBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', Math.min(0.92, quality + 0.04));
  });

  if (!jpegBlob || jpegBlob.size <= 0) {
    throw new Error('Image compression failed in this browser.');
  }
  return jpegBlob;
}

/**
 * Validates, resizes, and compresses an image into two optimized WebP variants
 * (card thumbnail + high-resolution product detail) BEFORE uploading.
 * Skips redundant recompression when an image is already a compact WebP within target size.
 */
export async function optimizeImageForUpload(file: File): Promise<ClientOptimizedImage> {
  validateImageFile(file);

  const [contentHash, decoded] = await Promise.all([
    computeSha256Hex(file),
    decodeImageFile(file),
  ]);

  try {
    const { width, height } = decoded;
    if (width < 32 || height < 32) {
      throw new Error('Image resolution must be at least 32×32 pixels.');
    }
    if (width > 10000 || height > 10000) {
      throw new Error('Image dimensions must not exceed 10,000 pixels.');
    }

    const isAlreadyWebp = file.type.trim().toLowerCase() === 'image/webp';

    // 1. Detail variant
    let detailBlob: Blob;
    let skippedDetailRecompression = false;
    if (
      isAlreadyWebp &&
      width <= DETAIL_MAX_WIDTH &&
      height <= DETAIL_MAX_HEIGHT &&
      file.size <= SKIP_DETAIL_RECOMPRESS_BYTES
    ) {
      detailBlob = file;
      skippedDetailRecompression = true;
    } else {
      const detailDims = fitDimensions(width, height, DETAIL_MAX_WIDTH, DETAIL_MAX_HEIGHT);
      const encodedDetail = await renderCanvasBlob(
        decoded,
        detailDims.width,
        detailDims.height,
        DETAIL_WEBP_QUALITY
      );
      if (
        isAlreadyWebp &&
        width <= DETAIL_MAX_WIDTH &&
        height <= DETAIL_MAX_HEIGHT &&
        file.size <= encodedDetail.size
      ) {
        detailBlob = file;
        skippedDetailRecompression = true;
      } else {
        detailBlob = encodedDetail;
      }
    }

    // 2. Card variant
    let cardBlob: Blob;
    let skippedCardRecompression = false;
    if (
      isAlreadyWebp &&
      width <= CARD_MAX_WIDTH &&
      height <= CARD_MAX_HEIGHT &&
      file.size <= SKIP_CARD_RECOMPRESS_BYTES
    ) {
      cardBlob = file;
      skippedCardRecompression = true;
    } else {
      const cardDims = fitDimensions(width, height, CARD_MAX_WIDTH, CARD_MAX_HEIGHT);
      const encodedCard = await renderCanvasBlob(
        decoded,
        cardDims.width,
        cardDims.height,
        CARD_WEBP_QUALITY
      );
      if (
        isAlreadyWebp &&
        width <= CARD_MAX_WIDTH &&
        height <= CARD_MAX_HEIGHT &&
        file.size <= encodedCard.size
      ) {
        cardBlob = file;
        skippedCardRecompression = true;
      } else {
        cardBlob = encodedCard;
      }
    }

    return {
      cardBlob,
      detailBlob,
      originalBytes: file.size,
      cardBytes: cardBlob.size,
      detailBytes: detailBlob.size,
      width,
      height,
      contentHash,
      skippedDetailRecompression,
      skippedCardRecompression,
      mimeType: detailBlob.type || 'image/webp',
    };
  } finally {
    decoded.cleanup();
  }
}
