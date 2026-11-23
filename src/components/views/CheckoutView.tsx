import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  MapPin,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { STORE_CURRENCY } from '../../data/storeConfig';
import { useAuth } from '../../context/AuthContext';
import { useBoutique } from '../../context/BoutiqueContext';
import { formatPrice } from '../../utils/formatCurrency';
import { CustomerAuthPanel } from '../auth/CustomerAuthPanel';
import { LuxuryImage } from '../ui/LuxuryImage';

export const CheckoutView: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const {
    products,
    cart,
    cartSubtotalUsd,
    giftWrap,
    addresses,
    addAddress,
    customer,
    submitOrderRequest,
    clearCart,
    navigate,
    currency,
    storeSettings,
    showToast,
    backendStatus,
    backendErrorMessage,
    checkBackendHealth,
  } = useBoutique();

  // Manual Customer Information (never auto-retrieved, zero geolocation)
  const [fullName, setFullName] = useState(customer.fullName);
  const [phone, setPhone] = useState(customer.phone);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [saveAddressForSession, setSaveAddressForSession] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applySavedAddress = (addressId: string) => {
    const found = addresses.find((a) => a.id === addressId);
    if (!found) return;
    if (!fullName.trim() && found.recipientName) setFullName(found.recipientName);
    if (!phone.trim() && found.phone) setPhone(found.phone);
    setCountry(found.country);
    setCity(found.city);
    setArea(found.area);
    setDeliveryAddress(found.deliveryAddress);
    setDeliveryInstructions(found.deliveryInstructions ?? '');
  };

  const handlePlaceOrderRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 6) {
      setFormError('Please enter a valid phone number.');
      return;
    }
    if (!country.trim()) {
      setFormError('Please enter your delivery country.');
      return;
    }
    if (!city.trim()) {
      setFormError('Please enter your city.');
      return;
    }
    if (!area.trim()) {
      setFormError('Please enter your area or neighborhood.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setFormError('Please enter your complete delivery address.');
      return;
    }
    if (cart.length === 0) {
      setFormError('Your shopping bag is empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      const items = cart
        .map((item) => {
          const prod = products.find((p) => p.id === item.productId);
          if (!prod) return null;
          return {
            productId: prod.id,
            size: item.selectedSize,
            colorName: item.selectedColor.name,
            quantity: item.quantity,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const result = await submitOrderRequest({
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          country: country.trim(),
          city: city.trim(),
          area: area.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryInstructions: deliveryInstructions.trim() || undefined,
        },
        items,
        giftPresentation: giftWrap,
        currency: STORE_CURRENCY,
      });

      if (result.status !== 'pending_review' || !result.order) {
        setFormError(result.message);
        return;
      }

      if (saveAddressForSession) {
        await addAddress({
          label: `${city.trim()} — ${area.trim()}`,
          recipientName: fullName.trim(),
          phone: phone.trim(),
          country: country.trim(),
          city: city.trim(),
          area: area.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          isDefault: addresses.length === 0,
        });
      }

      clearCart();
      showToast(`Order request received — ${result.order.orderReference}`);
      navigate('account', { accountTab: 'orders', orderId: result.order.id });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 pb-20 text-center">
        <h1 className="font-serif text-3xl font-medium text-[#302923]">Your Bag Is Empty</h1>
        <p className="mt-2 text-sm text-[#665B51]">
          Add at least one piece to your shopping bag before starting checkout.
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

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-8 pb-16">
        <button
          type="button"
          onClick={() => navigate('cart')}
          className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-xs font-medium tracking-wider text-[#665B51] uppercase hover:text-[#302923]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
          <span>Return to Shopping Bag</span>
        </button>

        <div className="rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] p-6 sm:p-8">
          <p className="text-[11px] font-medium tracking-[0.18em] text-[#7A5D39] uppercase">
            Boutique Checkout
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-[#302923]">
            Sign In to Submit Your Order
          </h1>
          <p className="mt-2 mb-6 text-sm leading-relaxed text-[#665B51]">
            Your shopping bag stays saved. Sign in to submit your order request and track live
            delivery fee confirmations.
          </p>
          <CustomerAuthPanel compact />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-24 sm:px-6 md:pt-9 md:pb-16">
      <button
        type="button"
        onClick={() => navigate('cart')}
        className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-xs font-medium tracking-wider text-[#665B51] uppercase hover:text-[#302923]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
        <span>Return to Shopping Bag</span>
      </button>

      <div className="border-b border-[#E4D8C5] pb-5">
        <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
          Boutique Checkout
        </p>
        <h1 className="mt-1 font-serif text-3xl font-medium text-[#302923] sm:text-4xl">
          Delivery &amp; Order Request
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#665B51]">
          Enter your delivery details below. After submitting your request, the boutique will review
          your address and confirm your delivery fee and final order total.
        </p>
      </div>

      <form
        onSubmit={handlePlaceOrderRequest}
        className="mt-7 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start"
      >
        {/* Left: Manual Customer & Delivery Information */}
        <div className="space-y-6 lg:col-span-7">
          {backendStatus === 'unavailable' && (
            <div
              role="status"
              className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#D8C3A5] bg-[#EFE7DA] px-4 py-3.5 text-xs text-[#302923] sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                <span>
                  {backendErrorMessage ??
                    'The boutique order server is currently unreachable. Please reconnect before placing your order request.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void checkBackendHealth()}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-[#302923]/30 bg-[#FCF9F4] px-3.5 py-1.5 text-[11px] font-semibold tracking-wider text-[#302923] uppercase hover:bg-[#F6F1E8]"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-sm text-[#302923]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
              <span>{formError}</span>
            </div>
          )}

          {/* Optional Session Saved Addresses */}
          {addresses.length > 0 && (
            <section className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5">
              <p className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                Fill from Saved Session Address
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => applySavedAddress(addr.id)}
                    className="min-h-[40px] rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                  >
                    {addr.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Customer Contact Details */}
          <section className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 sm:p-7">
            <div className="flex items-center gap-2.5">
              <User className="h-5 w-5 text-[#8C6D46]" strokeWidth={1.6} />
              <h2 className="font-serif text-2xl font-medium text-[#302923]">
                Customer Information
              </h2>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="checkout-full-name"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Full Name <span className="text-[#8C6D46]">*</span>
                </label>
                <input
                  id="checkout-full-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="checkout-phone"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Phone Number <span className="text-[#8C6D46]">*</span>
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="Include country code (e.g. +232 ...)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Manual Delivery Address Entry */}
          <section className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 sm:p-7">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-[#8C6D46]" strokeWidth={1.6} />
              <h2 className="font-serif text-2xl font-medium text-[#302923]">
                Delivery Address
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#665B51]">
              Enter your exact delivery destination manually. VEY RASHA never tracks or requests
              your device location.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="checkout-country"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Country <span className="text-[#8C6D46]">*</span>
                </label>
                <input
                  id="checkout-country"
                  type="text"
                  required
                  autoComplete="country-name"
                  placeholder="Enter delivery country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="checkout-city"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  City <span className="text-[#8C6D46]">*</span>
                </label>
                <input
                  id="checkout-city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  placeholder="Enter city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-area"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Area or Neighborhood <span className="text-[#8C6D46]">*</span>
                </label>
                <input
                  id="checkout-area"
                  type="text"
                  required
                  placeholder="District, neighborhood, or local area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-address"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Complete Delivery Address <span className="text-[#8C6D46]">*</span>
                </label>
                <textarea
                  id="checkout-address"
                  rows={2}
                  required
                  autoComplete="street-address"
                  placeholder="House/building number, street name, apartment or floor, and helpful nearby landmark"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-instructions"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Delivery Instructions (Optional)
                </label>
                <textarea
                  id="checkout-instructions"
                  rows={2}
                  placeholder="Preferred call window, gate code, or handoff notes"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  className="w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 pt-1 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={saveAddressForSession}
                  onChange={(e) => setSaveAddressForSession(e.target.checked)}
                  className="h-4 w-4 accent-[#302923]"
                />
                <span className="text-xs text-[#665B51]">
                  Save this manually entered address to my session
                </span>
              </label>
            </div>
          </section>

          <div className="flex items-start gap-2.5 rounded-xl border border-[#E4D8C5] bg-[#EFE7DA]/55 p-4 text-xs text-[#665B51]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" strokeWidth={1.6} />
            <span>
              Submitting this form sends an order request for boutique review. No payment is
              processed now, and your final total will only be set after the boutique confirms your
              delivery fee.
            </span>
          </div>
        </div>

        {/* Right: Order Summary */}
        <aside className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 sm:p-7 lg:sticky lg:top-8 lg:col-span-5">
          <h2 className="font-serif text-2xl font-medium text-[#302923]">Order Summary</h2>

          <ul className="mt-4 divide-y divide-[#E4D8C5]">
            {cart.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              if (!product) return null;
              return (
                <li key={item.id} className="flex gap-3.5 py-3.5">
                  <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg border border-[#E4D8C5]/70 bg-[#EFE7DA]">
                    <LuxuryImage
                      src={product.cardImages?.[0] ?? product.images[0] ?? ''}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-base font-medium text-[#302923] line-clamp-2">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[#665B51]">
                      Size {item.selectedSize} · {item.selectedColor.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[#665B51] tabular-nums">
                      Qty {item.quantity} × {formatPrice(product.priceUsd, currency)}
                    </p>
                  </div>
                  <p className="shrink-0 self-center text-sm font-semibold text-[#302923] tabular-nums">
                    {formatPrice(product.priceUsd * item.quantity, currency)}
                  </p>
                </li>
              );
            })}
          </ul>

          <dl className="mt-4 space-y-3 border-t border-[#E4D8C5] pt-4 text-sm">
            <div className="flex justify-between text-[#302923]">
              <dt className="font-medium">Product Subtotal</dt>
              <dd className="text-base font-semibold tabular-nums">
                {formatPrice(cartSubtotalUsd, currency)}
              </dd>
            </div>
            <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/80 p-3.5 text-xs leading-relaxed text-[#665B51]">
              <p>Delivery fee will be confirmed by the boutique after reviewing your delivery address.</p>
              <p className="mt-1.5 font-medium text-[#302923]">
                Your order total will be confirmed by the boutique.
              </p>
              {storeSettings.pickupLocationNote && (
                <p className="mt-1.5 text-[#665B51]">{storeSettings.pickupLocationNote}</p>
              )}
            </div>
          </dl>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting Order Request...' : 'Place Order Request'}
          </button>
        </aside>
      </form>
    </div>
  );
};
