import React from 'react';
import { AlertCircle, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import { formatPrice } from '../../utils/formatCurrency';
import { getFirstAvailableSelection, getMaxStockForSelection } from '../../utils/stock';
import { LuxuryImage } from '../ui/LuxuryImage';

export const WishlistView: React.FC = () => {
  const {
    products,
    wishlistIds,
    toggleWishlist,
    cart,
    addToCart,
    navigate,
    currency,
    isCatalogLoading,
    catalogError,
    retryCatalogLoad,
  } = useBoutique();

  const savedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 md:pt-10">
      <div className="border-b border-[#E4D8C5] pb-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-[#7A5D39] uppercase">
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

      {catalogError ? (
        <div
          role="alert"
          className="mt-10 flex flex-col items-center rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] px-6 py-12 text-center"
        >
          <AlertCircle className="h-7 w-7 text-[#7A5D39]" strokeWidth={1.5} />
          <h2 className="mt-3 font-serif text-xl font-medium text-[#302923]">
            Couldn&apos;t load wishlist items
          </h2>
          <p className="mt-1 max-w-md text-sm text-[#665B51]">{catalogError}</p>
          <button
            type="button"
            onClick={retryCatalogLoad}
            className="mt-5 min-h-[44px] rounded-full bg-[#302923] px-6 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
          >
            Couldn&apos;t load, tap to retry
          </button>
        </div>
      ) : isCatalogLoading && products.length === 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="space-y-3 rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-4">
              <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-[#EFE7DA]" />
              <div className="h-3 w-24 animate-pulse rounded bg-[#EFE7DA]" />
              <div className="h-5 w-40 animate-pulse rounded bg-[#EFE7DA]" />
            </div>
          ))}
        </div>
      ) : savedProducts.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-16 text-center">
          <Heart className="h-8 w-8 text-[#B59972]" strokeWidth={1.4} />
          <h2 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
            Your wishlist is currently empty
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#665B51]">
            Save your favourite pieces while browsing to revisit them anytime.
          </p>
          <button
            type="button"
            onClick={() => navigate('explore')}
            className="mt-6 min-h-[46px] rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.12em] text-[#F6F1E8] uppercase hover:bg-[#463D35]"
          >
            Shop now
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedProducts.map((product) => {
            const firstSelection = getFirstAvailableSelection(product);
            const variantStock =
              firstSelection.size && firstSelection.color.name
                ? getMaxStockForSelection(product, firstSelection.size, firstSelection.color.name)
                : 0;
            const inBag = cart.reduce(
              (sum, item) =>
                item.productId === product.id &&
                item.selectedSize === firstSelection.size &&
                item.selectedColor.name === firstSelection.color.name
                  ? sum + item.quantity
                  : sum,
              0
            );
            const canMove =
              product.stockStatus !== 'out_of_stock' &&
              Boolean(firstSelection.size && firstSelection.color.name) &&
              variantStock > inBag;

            return (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4]"
              >
                <button
                  type="button"
                  onClick={() => navigate('product', { productId: product.id })}
                  className="aspect-[4/5] w-full overflow-hidden bg-[#EFE7DA] text-left"
                >
                  <LuxuryImage
                    src={product.cardImages?.[0] ?? product.images[0] ?? ''}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full transition-transform duration-300 hover:scale-[1.03]"
                  />
                </button>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.12em] text-[#7A5D39] uppercase">
                      {product.categoryLabel}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('product', { productId: product.id })}
                      className="mt-1 text-left font-serif text-xl font-medium text-[#302923] hover:underline"
                    >
                      {product.name}
                    </button>
                    <p className="mt-1 text-sm font-semibold text-[#302923] tabular-nums">
                      {formatPrice(product.priceUsd, currency)}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canMove}
                      onClick={() => {
                        if (!canMove) return;
                        addToCart(product, firstSelection.size, firstSelection.color, 1);
                      }}
                      className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-[#302923] px-4 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>
                        {product.stockStatus === 'out_of_stock'
                          ? 'Out of Stock'
                          : 'Move to Bag'}
                      </span>
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
            );
          })}
        </div>
      )}
    </div>
  );
};
