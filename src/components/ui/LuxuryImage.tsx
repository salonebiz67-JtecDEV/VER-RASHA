import React, { useEffect, useState } from 'react';
import { resolveAssetUrl } from '../../config/api';

interface LuxuryImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  sizes?: string;
}

export const LuxuryImage: React.FC<LuxuryImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  loading = 'lazy',
  fetchPriority = 'auto',
  sizes,
}) => {
  const resolvedSrc = resolveAssetUrl(src ?? '');
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || hasError) {
    return (
      <div
        className={`bg-[#EFE7DA] ${className}`}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#EFE7DA] ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#EFE7DA] animate-pulse" aria-hidden="true" />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        sizes={sizes}
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`h-full w-full object-cover object-center transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
      />
    </div>
  );
};
