import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Heart, Minus, Plus, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import { formatPrice } from '../../utils/formatCurrency';
import { LuxuryImage } from '../ui/LuxuryImage';
import { ProductCard } from '../ui/ProductCard';

export const ProductDetailView: React.FC = () => {
  const {
    products,
    selectedProductId,
    navigate,
    currency,
    addToCart,
    isWishlisted,
    toggleWishlist,
    isCatalogLoading,
  } = useBoutique();

  const product = selectedProductId
    ? (products.find((p) => p.id === selectedProductId) ?? null)
    : (products[0] ?? null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] ?? '');
  const [selectedColor, setSelectedColor] = useState(
    product?.colors[0] ?? { name: '', hex: '#D8C3A5' }
  );
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    if (!product) return;
    setActiveImageIdx(0);
    setSelectedSize(product.sizes[0] ?? '');
    setSelectedColor(product.colors[0] ?? { name: '', hex: '#D8C3A5' });
    setQuantity(1);
    setAddedFeedback(false);
  }, [product]);

  if (!product && isCatalogLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6" aria-busy="true">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-[#EFE7DA] lg:col-span-7" />
          <div className="h-96 w-full animate-pulse rounded-2xl bg-[#EFE7DA] lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 pb-20 text-center">
        <h1 className="font-serif text-3xl font-medium text-[#302923]">
          {products.length === 0 ? 'New Collections Coming Soon' : 'Piece Unavailable'}
        </h1>
        <p className="mt-2 text-sm text-[#665B51]">
          {products.length === 0
            ? 'Our upcoming curated pieces are currently being prepared for release.'
            : 'This piece is no longer available. Explore our boutique collection for current silhouettes.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('explore')}
          className="mt-6 min-h-[46px] rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
        >
          Return to Shop
        </button>
      </div>
    );
  }

  const saved = isWishlisted(product.id);
  const relatedProducts = products
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.category === product.category ||
          (product.collectionId !== '' && p.collectionId === product.collectionId))
    )
    .slice(0, 3);

  const hasSelectableVariants =
    product.sizes.length > 0 && product.colors.length > 0 && selectedSize !== '' && selectedColor.name !== '';
  const canAddToBag = product.stockStatus !== 'out_of_stock' && hasSelectableVariants;

  const availabilityLabel =
    product.stockStatus === 'out_of_stock'
      ? 'Currently Unavailable'
      : !hasSelectableVariants
      ? 'Sizing Pending Confirmation'
      : 'Available';

  const handleAddToCart = () => {
    if (!canAddToBag) return;
    addToCart(product, selectedSize, selectedColor, quantity);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1600);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 pb-24 sm:px-6 md:pt-8 md:pb-12">
      {/* Back Breadcrumb */}
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('explore')}
          className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium tracking-wider text-[#665B51] uppercase hover:text-[#302923]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
          <span>Back to Shop</span>
        </button>
        <span className="text-xs text-[#665B51]">{product.categoryLabel}</span>
      </div>

      {/* Main Product Details Split */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
        {/* Left: Multi-Photo Gallery */}
        <div className="space-y-3.5 lg:col-span-7">
          <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#EFE7DA] sm:aspect-[4/3]">
            <LuxuryImage
              src={product.images[activeImageIdx] ?? product.images[0] ?? ''}
              alt={`${product.name} — view ${activeImageIdx + 1}`}
              loading="eager"
              fetchPriority="high"
              className="h-full w-full"
            />
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-3 gap-3">
              {product.images.map((img, idx) => {
                const isCurrent = idx === activeImageIdx;
                return (
                  <button
                    key={`${product.id}-thumb-${idx}`}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    aria-label={`View photo ${idx + 1} of ${product.name}`}
                    aria-pressed={isCurrent}
                    className={`aspect-[4/3] overflow-hidden rounded-xl border transition-all ${
                      isCurrent
                        ? 'border-[#302923] ring-1 ring-[#302923]'
                        : 'border-[#E4D8C5] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <LuxuryImage
                      src={product.cardImages?.[idx] ?? img}
                      alt={`${product.name} alternate view ${idx + 1}`}
                      loading="lazy"
                      className="h-full w-full"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:p-8 lg:sticky lg:top-8 lg:col-span-5">
          <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
            {product.categoryLabel} · {product.subtitle}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-[#302923]">
            {product.name}
          </h1>

          <div className="mt-4 flex items-baseline justify-between border-b border-[#E4D8C5] pb-5">
            <p className="text-2xl font-medium text-[#302923] tabular-nums">
              {formatPrice(product.priceUsd, currency)}
            </p>
            <p className="text-xs font-medium text-[#665B51]">{availabilityLabel}</p>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-[#665B51]">{product.description}</p>

          {/* Colour Selector */}
          {product.colors.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold tracking-wider text-[#302923] uppercase">Colour</span>
                <span className="text-[#665B51]">{selectedColor.name}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-3">
                {product.colors.map((color) => {
                  const active = color.name === selectedColor.name;
                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Select colour ${color.name}`}
                      aria-pressed={active}
                      className={`flex min-h-[44px] items-center gap-2.5 rounded-full border px-4 py-2 text-xs transition-colors ${
                        active
                          ? 'border-[#302923] bg-[#EFE7DA] font-medium text-[#302923]'
                          : 'border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:border-[#B59972]'
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-[#302923]/20"
                        style={{ backgroundColor: color.hex }}
                        aria-hidden="true"
                      />
                      <span>{color.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selector */}
          {product.sizes.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold tracking-wider text-[#302923] uppercase">Size</span>
                <span className="text-[#665B51]">Selected: {selectedSize}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const active = size === selectedSize;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      aria-pressed={active}
                      className={`min-h-[44px] min-w-[48px] rounded-lg border px-3 text-xs font-medium transition-colors ${
                        active
                          ? 'border-[#302923] bg-[#302923] text-[#F6F1E8]'
                          : 'border-[#E4D8C5] bg-[#FCF9F4] text-[#302923] hover:border-[#B59972]'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity & Actions */}
          <div className="mt-7 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 items-center rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#302923] hover:bg-[#EFE7DA]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-medium text-[#302923] tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#302923] hover:bg-[#EFE7DA]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canAddToBag}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#302923] px-6 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] disabled:opacity-50"
              >
                {addedFeedback ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={2} />
                    <span>Added to Bag</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
                    <span>{canAddToBag ? 'Add to Bag' : 'Currently Unavailable'}</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#D8C3A5] bg-transparent px-5 text-xs font-medium tracking-wider text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA]"
            >
              <Heart
                className={`h-4 w-4 ${saved ? 'fill-[#302923] text-[#302923]' : ''}`}
                strokeWidth={1.6}
              />
              <span>{saved ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
            </button>
          </div>

          {/* Composition & Care */}
          <div className="mt-7 space-y-3 border-t border-[#E4D8C5] pt-5 text-xs text-[#665B51]">
            <div>
              <span className="font-semibold text-[#302923]">Composition: </span>
              <span>{product.material}</span>
            </div>
            <div>
              <span className="font-semibold text-[#302923]">Atelier Care: </span>
              <span>{product.care}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 text-[#302923]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#8C6D46]" strokeWidth={1.6} />
              <span>Delivery fee and final total are confirmed by VEY RASHA after checkout review</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related Pieces */}
      {relatedProducts.length > 0 && (
        <section className="mt-16 border-t border-[#E4D8C5] pt-10" aria-label="Complementary Pieces">
          <h2 className="font-serif text-2xl font-medium text-[#302923]">
            Complementary Pieces
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-8 sm:gap-x-6 lg:grid-cols-3">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
