import React from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { PRODUCTS } from '../../data/catalog';
import { useBoutique } from '../../context/BoutiqueContext';
import { formatPrice } from '../../utils/formatCurrency';
import { LuxuryImage } from '../ui/LuxuryImage';

export const CartView: React.FC = () => {
  const {
    cart,
    cartCount,
    cartSubtotalUsd,
    updateCartQuantity,
    removeFromCart,
    giftWrap,
    setGiftWrap,
    navigate,
    currency,
    storeSettings,
  } = useBoutique();

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-6 md:pt-10 md:pb-14">
      <div className="flex flex-col justify-between gap-2 border-b border-[#E4D8C5] pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
            Your Selection
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-[#302923] sm:text-4xl">
            Shopping Bag
          </h1>
        </div>
        {cartCount > 0 && (
          <p className="text-sm text-[#665B51] tabular-nums">
            {cartCount} {cartCount === 1 ? 'piece' : 'pieces'}
          </p>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-16 text-center">
          <ShoppingBag className="h-8 w-8 text-[#B59972]" strokeWidth={1.4} />
          <h2 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
            Your shopping bag is empty
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#665B51]">
            Explore our collection of dresses, tailoring, handbags, and fine jewellery to add pieces
            to your bag.
          </p>
          <button
            type="button"
            onClick={() => navigate('explore')}
            className="mt-6 min-h-[46px] rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.12em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] active:scale-[0.98]"
          >
            Explore Collection
          </button>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Bag Line Items */}
          <div className="space-y-4 lg:col-span-7">
            {cart.map((item) => {
              const product = PRODUCTS.find((p) => p.id === item.productId);
              if (!product) return null;

              const lineTotalUsd = product.priceUsd * item.quantity;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-4 transition-colors hover:border-[#D8C3A5] sm:p-5"
                >
                  <div className="flex gap-4 sm:gap-5">
                    {/* Portrait Product Thumbnail */}
                    <button
                      type="button"
                      onClick={() => navigate('product', { productId: product.id })}
                      aria-label={`View ${product.name}`}
                      className="aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-xl border border-[#E4D8C5]/80 bg-[#EFE7DA] sm:w-28 focus-visible:outline-2 focus-visible:outline-[#302923]"
                    >
                      <LuxuryImage
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full"
                        imgClassName="transition-transform duration-300 hover:scale-[1.03]"
                      />
                    </button>

                    {/* Item Details */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium tracking-[0.12em] text-[#8C6D46] uppercase">
                              {product.categoryLabel}
                            </p>
                            <button
                              type="button"
                              onClick={() => navigate('product', { productId: product.id })}
                              className="mt-0.5 block text-left font-serif text-lg font-medium leading-snug text-[#302923] hover:underline sm:text-xl"
                            >
                              {product.name}
                            </button>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-[#302923] tabular-nums sm:text-base">
                            {formatPrice(lineTotalUsd, currency)}
                          </p>
                        </div>

                        {/* Selected Size & Color */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#302923]">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-[#665B51]">Size:</span>
                            <span className="font-semibold">{item.selectedSize}</span>
                          </div>
                          <span className="text-[#D8C3A5]" aria-hidden="true">
                            |
                          </span>
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-[#665B51]">Colour:</span>
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border border-[#302923]/25"
                              style={{ backgroundColor: item.selectedColor.hex }}
                              aria-hidden="true"
                            />
                            <span className="font-medium">{item.selectedColor.name}</span>
                          </div>
                        </div>

                        {item.quantity > 1 && (
                          <p className="mt-1 text-[11px] text-[#665B51] tabular-nums">
                            {formatPrice(product.priceUsd, currency)} each
                          </p>
                        )}
                      </div>

                      {/* Quantity Stepper & Remove Button */}
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E4D8C5]/70 pt-3">
                        <div
                          className="inline-flex h-10 items-center rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-1"
                          role="group"
                          aria-label={`Quantity for ${product.name}`}
                        >
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, -1)}
                            aria-label={`Decrease quantity of ${product.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#302923] transition-colors hover:bg-[#EFE7DA] active:scale-95"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-semibold text-[#302923] tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, 1)}
                            aria-label={`Increase quantity of ${product.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#302923] transition-colors hover:bg-[#EFE7DA] active:scale-95"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${product.name} from bag`}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#665B51] transition-colors hover:bg-[#EFE7DA] hover:text-[#302923] active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Bag Summary Panel (No hardcoded delivery region, fee, or invented total) */}
          <aside className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:p-8 lg:sticky lg:top-24 lg:col-span-5">
            <h2 className="font-serif text-2xl font-medium text-[#302923]">Order Summary</h2>

            {storeSettings.giftPresentationAvailable && (
              <label className="mt-5 flex cursor-pointer items-start gap-3 border-b border-[#E4D8C5] pb-5">
                <input
                  type="checkbox"
                  checked={giftWrap}
                  onChange={(e) => setGiftWrap(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#302923]"
                />
                <span className="text-xs leading-relaxed text-[#665B51]">
                  <strong className="block font-medium text-[#302923]">
                    Gift Presentation
                  </strong>
                  {storeSettings.giftPresentationLabel}
                </span>
              </label>
            )}

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between text-[#302923]">
                <dt className="font-medium">Product Subtotal</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {formatPrice(cartSubtotalUsd, currency)}
                </dd>
              </div>
              <div className="border-t border-[#E4D8C5] pt-3 text-xs leading-relaxed text-[#665B51]">
                <p>Delivery fee will be confirmed by the boutique after reviewing your delivery address.</p>
                <p className="mt-1.5 font-medium text-[#302923]">
                  Your order total will be confirmed by the boutique.
                </p>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => navigate('checkout')}
              className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#302923] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] active:scale-[0.98]"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={() => navigate('explore')}
              className="mt-2.5 flex min-h-[44px] w-full items-center justify-center text-xs font-medium text-[#665B51] transition-colors hover:text-[#302923]"
            >
              Continue Shopping
            </button>
          </aside>
        </div>
      )}
    </div>
  );
};
