import React from 'react';
import { Heart } from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import type { Product } from '../../types/boutique';
import { formatPrice } from '../../utils/formatCurrency';
import { LuxuryImage } from './LuxuryImage';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { navigate, currency, isWishlisted, toggleWishlist } = useBoutique();
  const saved = isWishlisted(product.id);

  const subtleTag =
    product.stockStatus === 'out_of_stock'
      ? 'Unavailable'
      : product.isNewArrival
      ? 'New'
      : null;

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[#E4D8C5]/80 bg-[#EFE7DA] transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_28px_-14px_rgba(48,41,35,0.2)] active:scale-[0.99]">
        <button
          type="button"
          onClick={() => navigate('product', { productId: product.id })}
          className="block h-full w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#302923]"
          aria-label={`View ${product.name}`}
        >
          <LuxuryImage
            src={product.cardImages?.[0] ?? product.images[0] ?? ''}
            alt={product.name}
            loading="lazy"
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 32vw, 24vw"
            className="h-full w-full"
            imgClassName="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035]"
          />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          aria-label={
            saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`
          }
          aria-pressed={saved}
          className="absolute top-2.5 right-2.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[#E4D8C5]/75 bg-[#FCF9F4]/90 text-[#302923] backdrop-blur-sm transition-transform duration-150 hover:bg-[#FCF9F4] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#302923]"
        >
          <Heart
            className={`h-4 w-4 transition-colors duration-150 ${
              saved ? 'fill-[#302923] text-[#302923]' : 'text-[#302923]'
            }`}
            strokeWidth={1.6}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate('product', { productId: product.id })}
        className="mt-3.5 flex flex-col items-start text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#302923]"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium tracking-[0.12em] text-[#8C6D46] uppercase">
            {product.categoryLabel}
          </span>
          {subtleTag && (
            <span className="shrink-0 text-[11px] font-medium text-[#665B51]">
              {subtleTag}
            </span>
          )}
        </div>
        <h3 className="mt-1 font-serif text-lg font-medium leading-snug text-[#302923] line-clamp-1 sm:text-[21px]">
          {product.name}
        </h3>
        <p className="mt-0.5 text-xs text-[#665B51] line-clamp-1">{product.subtitle}</p>
        <p className="mt-2 text-sm font-semibold tracking-wide text-[#302923] tabular-nums sm:text-[15px]">
          {formatPrice(product.priceUsd, currency)}
        </p>
      </button>
    </article>
  );
};
