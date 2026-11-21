import React from 'react';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import { formatPrice } from '../../utils/formatCurrency';
import { LuxuryImage } from '../ui/LuxuryImage';

export const WishlistView: React.FC = () => {
  const { products, wishlistIds, toggleWishlist, addToCart, navigate, currency } = useBoutique();

  const savedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 md:pt-10">
      <div className="border-b border-[#E4D8C5] pb-6">
        <p className="text-xs font-medium tracking-[0.16em] text-[#8C6D46] uppercase">
          Curated Selection
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h1 className="font-serif text-3xl font-medium text-[#302923] sm:text-4xl">
            Your Wishlist
          </h1>
          <p className="text-sm text-[#665B51] tabular-nums">
            {savedProducts.length} {savedProducts.length === 1 ? 'piece' : 'pieces'}
          </p>
        </div>
      </div>

      {savedProducts.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-16 text-center">
          <Heart className="h-8 w-8 text-[#B59972]" strokeWidth={1.4} />
          <h2 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
            Your wishlist is currently empty
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#665B51]">
            Save your favourite silk silhouettes, tailored blazers, and leather goods to revisit
            them anytime.
          </p>
          <button
            type="button"
            onClick={() => navigate('explore')}
            className="mt-6 min-h-[44px] rounded-full bg-[#302923] px-7 py-3 text-xs font-medium tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
          >
            Explore Boutique
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedProducts.map((product) => (
            <div
              key={product.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4]"
            >
              <button
                type="button"
                onClick={() => navigate('product', { productId: product.id })}
                className="aspect-[4/3] w-full overflow-hidden bg-[#EFE7DA] text-left"
              >
                <LuxuryImage
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full transition-transform duration-300 hover:scale-[1.03]"
                />
              </button>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <p className="text-xs text-[#665B51]">{product.categoryLabel}</p>
                  <button
                    type="button"
                    onClick={() => navigate('product', { productId: product.id })}
                    className="mt-1 text-left font-serif text-xl font-medium text-[#302923] hover:underline"
                  >
                    {product.name}
                  </button>
                  <p className="mt-1 text-sm font-medium text-[#302923] tabular-nums">
                    {formatPrice(product.priceUsd, currency)}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      addToCart(product, product.sizes[0], product.colors[0], 1)
                    }
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-[#302923] px-4 py-2 text-xs font-medium tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Move to Bag</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={`Remove ${product.name} from wishlist`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[#E4D8C5] text-[#665B51] hover:border-[#302923] hover:text-[#302923]"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
