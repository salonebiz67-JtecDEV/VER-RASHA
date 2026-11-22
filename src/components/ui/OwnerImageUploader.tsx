import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import {
  deleteBoutiqueImage,
  replaceBoutiqueImage,
  uploadBoutiqueImage,
  type MediaScope,
  type UploadedImageResponse,
} from '../../services/imageUpload.service';
import {
  formatFileSizeLabel,
  type ClientOptimizedImage,
  validateImageFile,
} from '../../utils/imageOptimizer';
import { LuxuryImage } from './LuxuryImage';

interface OwnerImageUploaderProps {
  scope?: MediaScope;
  entityId?: string;
  productId?: string;
  existingImageId?: string;
  currentImageUrl?: string | null;
  altText?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  onSuccess?: (result: UploadedImageResponse) => void;
  onDeleted?: () => void;
}

/**
 * Reusable luxury-styled media management widget strictly for owner admin modules.
 * Must NEVER be mounted inside public customer routes or customer account screens.
 */
export const OwnerImageUploader: React.FC<OwnerImageUploaderProps> = ({
  scope = 'products',
  entityId,
  productId,
  existingImageId,
  currentImageUrl,
  altText,
  isPrimary = false,
  sortOrder = 0,
  onSuccess,
  onDeleted,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [optimizationInfo, setOptimizationInfo] = useState<ClientOptimizedImage | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg(null);
    setStatusMsg(null);
    setOptimizationInfo(null);
    setProgress(0);

    if (!file) return;

    try {
      validateImageFile(file);
    } catch (err) {
      setSelectedFile(null);
      setErrorMsg(err instanceof Error ? err.message : 'Unsupported image selected.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadOrReplace = async () => {
    if (!selectedFile) return;
    setIsBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    setProgress(1);

    try {
      const response = existingImageId
        ? await replaceBoutiqueImage({
            imageId: existingImageId,
            file: selectedFile,
            altText,
            onOptimized: setOptimizationInfo,
            onProgress: setProgress,
          })
        : await uploadBoutiqueImage({
            file: selectedFile,
            scope,
            entityId,
            productId,
            altText,
            isPrimary,
            sortOrder,
            onOptimized: setOptimizationInfo,
            onProgress: setProgress,
          });

      setStatusMsg(
        response.deduplicated
          ? 'Identical optimized asset already stored — reused cleanly without creating duplicates.'
          : `Saved WebP variants (${formatFileSizeLabel(response.cardSizeBytes)} card · ${formatFileSizeLabel(
              response.detailSizeBytes
            )} detail).`
      );
      setSelectedFile(null);
      onSuccess?.(response);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!existingImageId) return;
    setIsBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      await deleteBoutiqueImage(existingImageId);
      setStatusMsg('Image removed cleanly.');
      onDeleted?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to remove image.');
    } finally {
      setIsBusy(false);
    }
  };

  const activePreview = previewUrl || currentImageUrl || '';

  return (
    <div className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-xl border border-[#E4D8C5] bg-[#EFE7DA]">
          <LuxuryImage src={activePreview} alt={altText || 'Boutique image preview'} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#8C6D46] uppercase">
              Boutique Media Asset
            </p>
            <p className="mt-0.5 text-xs text-[#665B51]">
              Automatically compressed into Card &amp; Detail WebP versions before upload.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleFilePicked}
            className="hidden"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] transition-colors hover:bg-[#EFE7DA] disabled:opacity-50"
            >
              <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span>{existingImageId ? 'Choose Replacement' : 'Select Image'}</span>
            </button>

            {selectedFile && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleUploadOrReplace()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#302923] px-4 py-2 text-xs font-semibold tracking-wide text-[#F6F1E8] transition-colors hover:bg-[#463D35] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} strokeWidth={1.6} />
                <span>{isBusy ? `Uploading ${progress}%` : existingImageId ? 'Replace Image' : 'Optimize & Upload'}</span>
              </button>
            )}

            {existingImageId && !selectedFile && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleDelete()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#E4D8C5] px-4 py-2 text-xs font-medium text-[#665B51] transition-colors hover:border-[#302923] hover:text-[#302923] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span>Delete</span>
              </button>
            )}
          </div>

          {isBusy && progress > 0 && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFE7DA]">
                <div
                  className="h-full rounded-full bg-[#302923] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-[#665B51] tabular-nums">Uploading… {progress}%</p>
            </div>
          )}

          {optimizationInfo && !isBusy && !errorMsg && (
            <p className="text-[11px] text-[#665B51] tabular-nums">
              Source {formatFileSizeLabel(optimizationInfo.originalBytes)} → Card{' '}
              {formatFileSizeLabel(optimizationInfo.cardBytes)} · Detail{' '}
              {formatFileSizeLabel(optimizationInfo.detailBytes)} ({optimizationInfo.width}×
              {optimizationInfo.height})
            </p>
          )}

          {errorMsg && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#8C6D46]/50 bg-[#EFE7DA] px-3 py-2 text-xs text-[#302923]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8C6D46]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-[#D8C3A5] bg-[#F6F1E8] px-3 py-2 text-xs text-[#302923]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8C6D46]" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
