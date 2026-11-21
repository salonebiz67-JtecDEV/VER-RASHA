import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { resolveAssetUrl } from '../../config/api';

interface LuxuryImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
}

export const LuxuryImage: React.FC<LuxuryImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  loading = 'lazy',
}) => {
  const resolvedSrc = resolveAssetUrl(src);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [resolvedSrc]);

  if (hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFE7DA] text-[#665B51] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Sparkles className="w-5 h-5 text-[#B59972] mb-2" strokeWidth={1.5} />
        <span className="font-serif text-sm tracking-wide text-[#302923]">VEY RASHA</span>
        <span className="text-xs text-[#665B51] mt-1 line-clamp-2 max-w-[180px]">{alt}</span>
      </div>
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
