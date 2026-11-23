import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import { formatPrice } from '../../utils/formatCurrency';
import {
  getFirstAvailableSelection,
  getMaxStockForSelection,
  isColorInStock,
  isSizeInStock,
} from '../../utils/stock';
import { LuxuryImage } from '../ui/LuxuryImage';
import { ProductCard } from '../ui/ProductCard';

export const ProductDetailView: React.FC = () => {
  const {
    products,
    selectedProductId,
    navigate,
    currency,
    cart,
    addToCart,
    isWishlisted,
    toggleWishlist,
    isCatalogLoading,
    catalogError,
    retryCatalogLoad,
  } = useBoutique();

  const product = selectedProductId
    ? (products.find((p) => p.id === selectedProductId) ?? null)
    : (products[0] ?? null);

  const initialSelection = product
    ? getFirstAvailableSelection(product)
    : { size: '', color: { name: '', hex: '#D8C3A5' } };

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState(initialSelection.size);
  const [selectedColor, setSelectedColor] = useState(initialSelection.color);
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!product) return;
    const firstValid = getFirstAvailableSelection(product);
    setActiveImageIdx(0);
    setSelectedSize(firstValid.size);
    setSelectedColor(firstValid.color);
    setQuantity(1);
    setAddedFeedback(false);
  }, [product]);

  if (!product && catalogError) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 pb-20 text-center">
        <div className="rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] p-8">
          <AlertCircle className="mx-auto h-7 w-7 text-[#7A5D39]" strokeWidth={1.5} />
          <h1 className="mt-3 font-serif text-2xl font-medium text-[#302923]">
            Couldn&apos;t load piece
          </h1>
          <p className="mt-2 text-sm text-[#665B51]">{catalogError}</p>
          <button
            type="button"
            onClick={retryCatalogLoad}
            className="mt-6 min-h-[46px] rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
          >
            Couldn&apos;t load, tap to retry
          </button>
        </div>
      </div>
    );
  }

  if (!product && isCatalogLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6" aria-busy="true">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-[#EFE7DA] lg:col-span-7" />
          <div className="space-y-4 rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 lg:col-span-5">
            <div className="h-3 w-28 animate-pulse rounded bg-[#EFE7DA]" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-[#EFE7DA]" />
            <div className="h-6 w-24 animate-pulse rounded bg-[#EFE7DA]" />
            <div className="h-24 w-full animate-pulse rounded bg-[#EFE7DA]" />
            <div className="h-12 w-full animate-pulse rounded-full bg-[#EFE7DA]" />
          </div>
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
          Shop now
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

  const imageCount = product.images.length;
  const hasMultipleImages = imageCount > 1;

  const goToPrevImage = () => {
    if (!hasMultipleImages) return;
    setActiveImageIdx((prev) => (prev - 1 + imageCount) % imageCount);
  };

  const goToNextImage = () => {
    if (!hasMultipleImages) return;
    setActiveImageIdx((prev) => (prev + 1) % imageCount);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null || !hasMultipleImages) {
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goToNextImage();
      } else {
        goToPrevImage();
      }
    }
  };

  const handleSelectColor = (color: { name: string; hex: string }) => {
    if (!isColorInStock(product, color.name)) return;
    setSelectedColor(color);
    // Keep current size if available in this colour; otherwise choose first available size in this colour
    if (!isSizeInStock(product, selectedSize, color.name)) {
      const nextAvailableSize = product.sizes.find((s) => isSizeInStock(product, s, color.name));
      if (nextAvailableSize) {
        setSelectedSize(nextAvailableSize);
      }
    }
    setQuantity(1);
  };

  const handleSelectSize = (size: string) => {
    if (!isSizeInStock(product, size, selectedColor.name)) return;
    setSelectedSize(size);
    setQuantity(1);
  };

  const hasSelectableVariants =
    product.sizes.length > 0 &&
    product.colors.length > 0 &&
    selectedSize !== '' &&
    selectedColor.name !== '';

  const selectedVariantStock = hasSelectableVariants
    ? getMaxStockForSelection(product, selectedSize, selectedColor.name)
    : 0;

  const existingBagQty = cart.reduce((sum, item) => {
    if (
      item.productId === product.id &&
      item.selectedSize === selectedSize &&
      item.selectedColor.name === selectedColor.name
    ) {
      return sum + item.quantity;
    }
    return sum;
  }, 0);

  const maxAddable = Math.max(0, selectedVariantStock - existingBagQty);
  const effectiveQty = maxAddable > 0 ? Math.min(quantity, maxAddable) : 1;
  const canAddToBag =
    product.stockStatus !== 'out_of_stock' &&
    hasSelectableVariants &&
    selectedVariantStock > 0 &&
    maxAddable > 0;

  let stockText = 'Available';
  if (!hasSelectableVariants) {
    stockText = 'Sizing Pending Confirmation';
  } else if (selectedVariantStock <= 0 || product.stockStatus === 'out_of_stock') {
    stockText = 'Out of stock';
  } else if (selectedVariantStock <= 5) {
    stockText = `Only ${selectedVariantStock} left`;
  } else {
    stockText = `In stock (${selectedVariantStock} available)`;
  }

  const handleAddToCart = () => {
    if (!canAddToBag) return;
    addToCart(product, selectedSize, selectedColor, effectiveQty);
    setQuantity(1);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1600);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 pb-16 sm:px-6 md:pt-8 md:pb-12">
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
        {/* Left: Swipeable Multi-Photo Gallery */}
        <div className="space-y-3.5 lg:col-span-7">
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative aspect-[4/5] w-full touch-pan-y overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#EFE7DA] sm:aspect-[4/3]"
          >
            <LuxuryImage
              src={product.images[activeImageIdx] ?? product.images[0] ?? ''}
              alt={`${product.name} — view ${activeImageIdx + 1}`}
              loading="eager"
              fetchPriority="high"
              className="h-full w-full"
            />

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={goToPrevImage}
                  aria-label="Previous product photo"
                  className="absolute top-1/2 left-3 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-[#E4D8C5]/80 bg-[#FCF9F4]/90 text-[#302923] shadow-sm backdrop-blur-sm transition-colors hover:bg-[#FCF9F4]"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={goToNextImage}
                  aria-label="Next product photo"
                  className="absolute top-1/2 right-3 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-[#E4D8C5]/80 bg-[#FCF9F4]/90 text-[#302923] shadow-sm backdrop-blur-sm transition-colors hover:bg-[#FCF9F4]"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                </button>

                <div
                  className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5"
                  aria-label={`Photo ${activeImageIdx + 1} of ${imageCount}`}
                >
                  {product.images.map((_, idx) => (
                    <button
                      key={`${product.id}-dot-${idx}`}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      aria-label={`Show photo ${idx + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        idx === activeImageIdx
                          ? 'w-6 bg-[#FCF9F4]'
                          : 'w-2 bg-[#FCF9F4]/55 hover:bg-[#FCF9F4]/85'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {hasMultipleImages && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {product.images.map((img, idx) => {
                const isCurrent = idx === activeImageIdx;
                return (
                  <button
                    key={`${product.id}-thumb-${idx}`}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    aria-label={`View photo ${idx + 1} of ${product.name}`}
                    aria-pressed={isCurrent}
                    className={`aspect-[4/3] min-h-[44px] overflow-hidden rounded-xl border transition-all ${
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
          <p className="text-xs font-medium tracking-[0.14em] text-[#7A5D39] uppercase">
            {product.categoryLabel}
            {product.subtitle ? ` · ${product.subtitle}` : ''}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-[#302923]">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E4D8C5] pb-5">
            <p className="text-2xl font-medium text-[#302923] tabular-nums">
              {formatPrice(product.priceUsd, currency)}
            </p>
            <p
              className={`text-xs font-medium ${
                selectedVariantStock <= 0
                  ? 'text-[#665B51]'
                  : selectedVariantStock <= 5
                  ? 'text-[#7A5D39]'
                  : 'text-[#302923]'
              }`}
            >
              {stockText}
              {existingBagQty > 0 && selectedVariantStock > 0
                ? ` · ${existingBagQty} in bag`
                : ''}
            </p>
          </div>

          {product.description && (
            <p className="mt-5 text-sm leading-relaxed text-[#665B51]">{product.description}</p>
          )}

          {/* Colour Selector */}
          {product.colors.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold tracking-wider text-[#302923] uppercase">Colour</span>
                <span className="text-[#665B51]">{selectedColor.name}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {product.colors.map((color) => {
                  const active = color.name === selectedColor.name;
                  const available = isColorInStock(product, color.name);
                  return (
                    <button
                      key={color.name}
                      type="button"
                      disabled={!available}
                      onClick={() => handleSelectColor(color)}
                      aria-label={
                        available
                          ? `Select colour ${color.name}`
                          : `${color.name} — Out of stock`
                      }
                      aria-pressed={active}
                      className={`flex min-h-[44px] items-center gap-2.5 rounded-full border px-4 py-2 text-xs transition-colors ${
                        !available
                          ? 'cursor-not-allowed border-[#E4D8C5] bg-[#F6F1E8] text-[#665B51]/70 line-through opacity-60'
                          : active
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
                      {!available && (
                        <span className="text-[10px] no-underline">(Sold out)</span>
                      )}
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
                <span className="text-[#665B51]">
                  Selected: {selectedSize}
                  {selectedVariantStock > 0 && selectedVariantStock <= 5
                    ? ` · Only ${selectedVariantStock} left`
                    : ''}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const active = size === selectedSize;
                  const available = isSizeInStock(product, size, selectedColor.name);
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={!available}
                      onClick={() => handleSelectSize(size)}
                      aria-pressed={active}
                      aria-label={available ? `Size ${size}` : `Size ${size} — Out of stock`}
                      className={`min-h-[44px] min-w-[52px] rounded-lg border px-3 text-xs font-medium transition-colors ${
                        !available
                          ? 'cursor-not-allowed border-[#E4D8C5] bg-[#F6F1E8] text-[#665B51]/70 line-through opacity-55'
                          : active
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
              <div className="flex h-12 items-center rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-1.5">
                <button
                  type="button"
                  disabled={!canAddToBag || effectiveQty <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#302923] hover:bg-[#EFE7DA] disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-medium text-[#302923] tabular-nums">
                  {canAddToBag ? effectiveQty : 0}
                </span>
                <button
                  type="button"
                  disabled={!canAddToBag || effectiveQty >= maxAddable}
                  onClick={() => setQuantity((q) => Math.min(maxAddable, q + 1))}
                  aria-label="Increase quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#302923] hover:bg-[#EFE7DA] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canAddToBag}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#302923] px-6 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addedFeedback ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={2} />
                    <span>Added to Bag</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
                    <span>
                      {selectedVariantStock <= 0
                        ? 'Out of Stock'
                        : maxAddable <= 0
                        ? 'Max Stock in Bag'
                        : 'Add to Bag'}
                    </span>
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
            {product.material && (
              <div>
                <span className="font-semibold text-[#302923]">Composition: </span>
                <span>{product.material}</span>
              </div>
            )}
            {product.care && (
              <div>
                <span className="font-semibold text-[#302923]">Atelier Care: </span>
                <span>{product.care}</span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1 text-[#302923]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#7A5D39]" strokeWidth={1.6} />
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
