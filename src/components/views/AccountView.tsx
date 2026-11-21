import React, { useState } from 'react';
import {
  Bell,
  Check,
  MapPin,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import type { CurrencyCode, OrderRecord } from '../../types/boutique';
import { formatPrice } from '../../utils/formatCurrency';
import {
  formatOrderDate,
  getOrderTimelineIndex,
  isOrderConfirmedOrLater,
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE_STEPS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/orderStatus';
import { PrintableReceiptModal } from '../orders/PrintableReceiptModal';
import { LuxuryImage } from '../ui/LuxuryImage';

type AccountTab = 'orders' | 'profile' | 'addresses' | 'preferences';

export const AccountView: React.FC = () => {
  const {
    customer,
    updateCustomer,
    addresses,
    addAddress,
    removeAddress,
    setDefaultAddress,
    orders,
    isLoadingOrders,
    refreshOrders,
    storeSettings,
    currency,
    setCurrency,
    navigate,
    unreadNotificationCount,
    browserNotificationPermission,
    requestBrowserNotifications,
  } = useBoutique();

  const [activeTab, setActiveTab] = useState<AccountTab>('orders');
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);

  // Personal Info Form State
  const [profileName, setProfileName] = useState(customer.fullName);
  const [profileEmail, setProfileEmail] = useState(customer.email);
  const [profilePhone, setProfilePhone] = useState(customer.phone);

  // Manual Address Form State (never auto-retrieved)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [label, setLabel] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomer({
      fullName: profileName.trim(),
      email: profileEmail.trim(),
      phone: profilePhone.trim(),
    });
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !label.trim() ||
      !country.trim() ||
      !city.trim() ||
      !area.trim() ||
      !deliveryAddress.trim()
    ) {
      return;
    }
    addAddress({
      label: label.trim(),
      recipientName: customer.fullName || profileName.trim() || 'Boutique Client',
      phone: customer.phone || profilePhone.trim(),
      country: country.trim(),
      city: city.trim(),
      area: area.trim(),
      deliveryAddress: deliveryAddress.trim(),
      deliveryInstructions: deliveryInstructions.trim() || undefined,
      isDefault: addresses.length === 0,
    });
    setLabel('');
    setCountry('');
    setCity('');
    setArea('');
    setDeliveryAddress('');
    setDeliveryInstructions('');
    setShowNewAddressForm(false);
  };

  const hasContactDetails = Boolean(customer.email || customer.phone);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-6 md:pt-10 md:pb-14">
      {/* Customer Profile Header */}
      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#D8C3A5] bg-[#EFE7DA] text-[#302923]">
            <User className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.16em] text-[#8C6D46] uppercase">
              Client Account
            </p>
            <h1 className="mt-0.5 truncate font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
              {customer.fullName || 'Guest Account'}
            </h1>
            {hasContactDetails ? (
              <p className="mt-0.5 truncate text-xs text-[#665B51]">
                {[customer.email, customer.phone].filter(Boolean).join(' · ')}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[#665B51]">
                Manage your order requests, delivery addresses, and preferences.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => navigate('notifications')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-5 py-2.5 text-xs font-medium text-[#302923] transition-colors hover:bg-[#EFE7DA]"
          >
            <Bell className="h-4 w-4 text-[#8C6D46]" strokeWidth={1.6} />
            <span>Notifications</span>
            {unreadNotificationCount > 0 && (
              <span className="rounded-full bg-[#302923] px-2 py-0.5 text-[10px] font-semibold text-[#F6F1E8] tabular-nums">
                {unreadNotificationCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Organized Account Sections */}
      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        role="tablist"
        aria-label="Account Sections"
      >
        {(
          [
            { id: 'orders', label: 'Orders & Tracking', icon: Package },
            { id: 'profile', label: 'Personal Info', icon: User },
            { id: 'addresses', label: 'Addresses', icon: MapPin },
            { id: 'preferences', label: 'Preferences', icon: Settings },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#302923] text-[#F6F1E8]'
                  : 'border border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:border-[#B59972] hover:text-[#302923]'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. ORDERS & TRACKING */}
      {activeTab === 'orders' && (
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-medium text-[#302923]">Your Orders</h2>
            <button
              type="button"
              onClick={() => void refreshOrders()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#E4D8C5] bg-[#FCF9F4] px-4 py-2 text-xs font-medium text-[#665B51] hover:border-[#B59972] hover:text-[#302923]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`}
                strokeWidth={1.6}
              />
              <span>Refresh</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE7DA] text-[#8C6D46]">
                <Package className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
                No orders placed yet
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#665B51]">
                Once you submit an order request through checkout, its live review status,
                owner-confirmed delivery fee, final total, and printable receipt will appear here.
              </p>
              <button
                type="button"
                onClick={() => navigate('explore')}
                className="mt-6 min-h-[46px] rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.12em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const confirmed = isOrderConfirmedOrLater(order.status);
                const timelineIdx = getOrderTimelineIndex(order.status);

                return (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 sm:p-7"
                  >
                    {/* Top Header */}
                    <div className="flex flex-col justify-between gap-4 border-b border-[#E4D8C5] pb-4 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-xs text-[#665B51] tabular-nums">
                          {order.orderReference} · {formatOrderDate(order.createdAt)}
                        </p>
                        <h3 className="mt-1 font-serif text-2xl font-medium text-[#302923]">
                          {ORDER_STATUS_LABELS[order.status]}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#665B51]">
                          Payment Status:{' '}
                          <span className="font-medium text-[#302923]">
                            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <button
                          type="button"
                          onClick={() => setReceiptOrder(order)}
                          className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] transition-colors hover:bg-[#EFE7DA]"
                        >
                          <Printer className="h-3.5 w-3.5 text-[#8C6D46]" strokeWidth={1.6} />
                          <span>
                            {confirmed ? 'Print Receipt' : 'Print Order Request Summary'}
                          </span>
                        </button>
                        {order.estimatedDeliveryTime && (
                          <p className="text-xs text-[#665B51]">
                            Est. Delivery:{' '}
                            <strong className="text-[#302923]">
                              {order.estimatedDeliveryTime}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 7-State Status Timeline */}
                    {order.status === 'CANCELLED' ? (
                      <div className="mt-4 rounded-xl border border-[#D8C3A5] bg-[#EFE7DA]/70 px-4 py-3 text-xs text-[#302923]">
                        This order has been marked as <strong>Cancelled</strong>.
                        {order.ownerMessage ? ` Note from boutique: "${order.ownerMessage}"` : ''}
                      </div>
                    ) : (
                      <div className="mt-5">
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {ORDER_TIMELINE_STEPS.map((step, idx) => {
                            const completed = timelineIdx >= idx;
                            return (
                              <div key={step.status} className="space-y-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    completed ? 'bg-[#302923]' : 'bg-[#E4D8C5]'
                                  }`}
                                />
                                <p
                                  className={`text-[11px] leading-tight ${
                                    completed ? 'font-medium text-[#302923]' : 'text-[#665B51]'
                                  }`}
                                >
                                  {step.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Boutique Note (when owner includes message) */}
                    {order.ownerMessage && order.status !== 'CANCELLED' && (
                      <div className="mt-4 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-4 py-3 text-xs leading-relaxed text-[#302923]">
                        <strong className="font-semibold">Message from VEY RASHA: </strong>
                        {order.ownerMessage}
                      </div>
                    )}

                    {/* Ordered Pieces */}
                    <ul className="mt-5 divide-y divide-[#E4D8C5] border-t border-[#E4D8C5] pt-2">
                      {order.items.map((item, idx) => (
                        <li key={`${order.id}-${idx}`} className="flex items-center gap-4 py-3">
                          <div className="aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg bg-[#EFE7DA]">
                            <LuxuryImage
                              src={item.image}
                              alt={item.productName}
                              className="h-full w-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-serif text-base font-medium text-[#302923]">
                              {item.productName}
                            </p>
                            <p className="text-xs text-[#665B51]">
                              Size {item.size} · {item.colorName} · Qty {item.quantity}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium text-[#302923] tabular-nums">
                            {formatPrice(item.lineTotalUsd, order.currencyAtOrder)}
                          </p>
                        </li>
                      ))}
                    </ul>

                    {/* Delivery Address & Financial Summary */}
                    <div className="mt-4 grid grid-cols-1 gap-5 border-t border-[#E4D8C5] pt-4 md:grid-cols-2">
                      <div className="text-xs leading-relaxed text-[#665B51]">
                        <p className="font-semibold tracking-wider text-[#8C6D46] uppercase">
                          Delivery Destination
                        </p>
                        <p className="mt-1 font-medium text-[#302923]">
                          {order.customer.fullName} · {order.customer.phone}
                        </p>
                        <p className="text-[#302923]">{order.customer.deliveryAddress}</p>
                        <p>
                          {order.customer.area}, {order.customer.city}, {order.customer.country}
                        </p>
                        {order.customer.deliveryInstructions && (
                          <p className="mt-1">Note: {order.customer.deliveryInstructions}</p>
                        )}
                      </div>

                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4 text-[#665B51]">
                          <dt>Product Subtotal</dt>
                          <dd className="font-medium text-[#302923] tabular-nums">
                            {formatPrice(order.subtotalUsd, order.currencyAtOrder)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 text-[#665B51]">
                          <dt>Delivery Fee</dt>
                          <dd className="text-right font-medium text-[#302923] tabular-nums">
                            {order.deliveryFeeUsd !== null
                              ? formatPrice(order.deliveryFeeUsd, order.currencyAtOrder)
                              : 'Pending boutique review'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-[#E4D8C5] pt-2.5 text-base font-semibold text-[#302923]">
                          <dt>{confirmed ? 'Confirmed Final Total' : 'Final Total'}</dt>
                          <dd className="text-right tabular-nums">
                            {order.finalTotalUsd !== null
                              ? formatPrice(order.finalTotalUsd, order.currencyAtOrder)
                              : 'Confirmed after review'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. PERSONAL INFORMATION */}
      {activeTab === 'profile' && (
        <div className="mt-6 max-w-2xl">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:p-8"
          >
            <h2 className="font-serif text-2xl font-medium text-[#302923]">
              Personal Information
            </h2>
            <p className="mt-1 text-xs text-[#665B51]">
              Maintain your contact information for this session.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="profile-name"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Full Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-email"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Email Address
                </label>
                <input
                  id="profile-email"
                  type="email"
                  placeholder="name@example.com"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-phone"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Phone Number (with country code)
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  placeholder="Include country dial code"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                className="min-h-[46px] rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.12em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
              >
                Save Personal Info
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. SAVED ADDRESSES (Manual entry only, zero geolocation) */}
      {activeTab === 'addresses' && (
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl font-medium text-[#302923]">Saved Addresses</h2>
            <button
              type="button"
              onClick={() => setShowNewAddressForm((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#302923] px-5 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Address</span>
            </button>
          </div>

          {showNewAddressForm && (
            <form
              onSubmit={handleSaveAddress}
              className="grid grid-cols-1 gap-3.5 rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:grid-cols-2"
            >
              <input
                type="text"
                required
                placeholder="Address Label (e.g., Home, Office)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-12 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] sm:col-span-2"
              />
              <input
                type="text"
                required
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-12 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923]"
              />
              <input
                type="text"
                required
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923]"
              />
              <input
                type="text"
                required
                placeholder="Area or Neighborhood"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-12 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] sm:col-span-2"
              />
              <textarea
                rows={2}
                required
                placeholder="Complete Delivery Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923] sm:col-span-2"
              />
              <input
                type="text"
                placeholder="Optional Delivery Instructions"
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                className="h-12 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] sm:col-span-2"
              />
              <div className="flex gap-3 pt-2 sm:col-span-2">
                <button
                  type="submit"
                  className="min-h-[44px] rounded-full bg-[#302923] px-6 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase"
                >
                  Save Address
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewAddressForm(false)}
                  className="min-h-[44px] rounded-full border border-[#E4D8C5] px-5 py-2 text-xs font-medium text-[#665B51]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-10 text-center">
              <MapPin className="mx-auto h-7 w-7 text-[#B59972]" strokeWidth={1.5} />
              <p className="mt-3 font-serif text-xl font-medium text-[#302923]">
                No saved addresses yet
              </p>
              <p className="mt-1 text-sm text-[#665B51]">
                Save a manually entered delivery address here or during checkout.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-serif text-xl font-medium text-[#302923]">{addr.label}</p>
                      {addr.isDefault && (
                        <span className="text-xs font-medium text-[#8C6D46]">Default</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[#665B51]">{addr.recipientName}</p>
                    <p className="text-sm text-[#302923]">{addr.deliveryAddress}</p>
                    <p className="text-sm text-[#665B51]">
                      {addr.area}, {addr.city}, {addr.country}
                    </p>
                    {addr.deliveryInstructions && (
                      <p className="mt-1 text-xs text-[#665B51]">
                        Note: {addr.deliveryInstructions}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[#E4D8C5] pt-3">
                    {!addr.isDefault ? (
                      <button
                        type="button"
                        onClick={() => setDefaultAddress(addr.id)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-[#302923] hover:text-[#8C6D46]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Set as Default</span>
                      </button>
                    ) : (
                      <span className="text-xs text-[#665B51]">Primary address</span>
                    )}

                    <button
                      type="button"
                      onClick={() => removeAddress(addr.id)}
                      aria-label={`Delete ${addr.label}`}
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-[#665B51] hover:bg-[#EFE7DA] hover:text-[#302923]"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. PREFERENCES */}
      {activeTab === 'preferences' && (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6">
            <h2 className="font-serif text-2xl font-medium text-[#302923]">
              Currency &amp; Sizing
            </h2>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#302923] uppercase">
                  Display Currency
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {storeSettings.supportedCurrencies.map((code: CurrencyCode) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      className={`min-h-[44px] rounded-full px-5 text-xs font-medium transition-colors ${
                        currency === code
                          ? 'bg-[#302923] text-[#F6F1E8]'
                          : 'border border-[#E4D8C5] bg-[#F6F1E8] text-[#302923] hover:border-[#B59972]'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold tracking-wider text-[#302923] uppercase">
                  Preferred Garment Size
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {['XS', 'S', 'M', 'L', 'XL'].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateCustomer({ preferredSize: size })}
                      className={`min-h-[44px] min-w-[48px] rounded-lg border text-xs font-medium transition-colors ${
                        customer.preferredSize === size
                          ? 'border-[#302923] bg-[#302923] text-[#F6F1E8]'
                          : 'border-[#E4D8C5] bg-[#F6F1E8] text-[#302923]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6">
            <h2 className="font-serif text-2xl font-medium text-[#302923]">
              Client Communications
            </h2>
            <div className="mt-5 space-y-4">
              <div className="border-b border-[#E4D8C5] pb-4">
                <p className="text-sm font-medium text-[#302923]">Real-Time Order Alerts</p>
                <p className="mt-0.5 text-xs text-[#665B51]">
                  Receive live browser notifications when VEY RASHA confirms your delivery fee and
                  accepts your order.
                </p>
                <div className="mt-3">
                  {browserNotificationPermission === 'granted' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#302923]">
                      <Check className="h-3.5 w-3.5 text-[#8C6D46]" />
                      <span>Browser alerts enabled</span>
                    </span>
                  ) : browserNotificationPermission === 'unsupported' ? (
                    <span className="text-xs text-[#665B51]">
                      In-app real-time notifications are active in this browser.
                    </span>
                  ) : browserNotificationPermission === 'denied' ? (
                    <span className="text-xs text-[#665B51]">
                      Browser alerts are blocked in device settings; in-app updates remain active.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void requestBrowserNotifications()}
                      className="min-h-[40px] rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                    >
                      Enable Browser Alerts
                    </button>
                  )}
                </div>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-[#E4D8C5] pb-4">
                <div>
                  <p className="text-sm font-medium text-[#302923]">Collection Announcements</p>
                  <p className="text-xs text-[#665B51]">
                    Receive updates on new arrivals and seasonal boutique releases.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={customer.newsletterOptIn}
                  onChange={(e) => updateCustomer({ newsletterOptIn: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-[#302923]"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#302923]">Order &amp; Delivery Updates</p>
                  <p className="text-xs text-[#665B51]">
                    Receive direct updates when order or shipment statuses change.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={customer.smsUpdatesOptIn}
                  onChange={(e) => updateCustomer({ smsUpdatesOptIn: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-[#302923]"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {receiptOrder && (
        <PrintableReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
};
