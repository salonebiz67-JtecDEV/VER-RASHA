import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  FileDown,
  LogOut,
  MapPin,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBoutique } from '../../context/BoutiqueContext';
import type {
  AccountTab,
  NotificationType,
  OrderRecord,
  OrderStatus,
  SavedAddress,
} from '../../types/boutique';
import { STORE_CURRENCY } from '../../data/storeConfig';
import { formatPrice } from '../../utils/formatCurrency';
import {
  formatOrderDate,
  getOrderTimelineIndex,
  isOrderConfirmedOrLater,
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE_STEPS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/orderStatus';
import { CustomerAuthPanel } from '../auth/CustomerAuthPanel';
import { PrintableReceiptModal } from '../orders/PrintableReceiptModal';
import { LuxuryImage } from '../ui/LuxuryImage';

type NotificationFilter = 'all' | NotificationType;

function getOrderStatusIcon(status: OrderStatus) {
  switch (status) {
    case 'PENDING_REVIEW':
      return Clock;
    case 'CONFIRMED':
    case 'PROCESSING':
      return CheckCircle2;
    case 'READY_FOR_DISPATCH':
    case 'SHIPPED':
      return Truck;
    case 'DELIVERED':
      return Package;
    case 'CANCELLED':
      return XCircle;
  }
}

export const AccountView: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const {
    accountTab: activeTab,
    setAccountTab: setActiveTab,
    selectedOrderId,
    setSelectedOrderId,
    customer,
    updateCustomer,
    addresses,
    addAddress,
    updateAddress,
    removeAddress,
    setDefaultAddress,
    orders,
    isLoadingOrders,
    refreshOrders,
    notifications,
    unreadNotificationCount,
    isLoadingNotifications,
    notificationsError,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    browserNotificationPermission,
    requestBrowserNotifications,
    navigate,
    backendStatus,
    backendErrorMessage,
    checkBackendHealth,
  } = useBoutique();

  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);

  // Personal Info Form State
  const [profileName, setProfileName] = useState(customer.fullName);
  const [profileEmail, setProfileEmail] = useState(customer.email);
  const [profilePhone, setProfilePhone] = useState(customer.phone);

  useEffect(() => {
    setProfileName(customer.fullName);
    setProfileEmail(customer.email);
    setProfilePhone(customer.phone);
  }, [customer.fullName, customer.email, customer.phone]);

  // Manual Address Add / Edit State (never auto-retrieved)
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrCountry, setAddrCountry] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrInstructions, setAddrInstructions] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);

  // Account Notifications Filter
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('all');

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) ?? null : null),
    [orders, selectedOrderId]
  );

  const filteredNotifications = useMemo(
    () =>
      notifFilter === 'all'
        ? notifications
        : notifications.filter((n) => n.type === notifFilter),
    [notifications, notifFilter]
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomer({
      fullName: profileName.trim(),
      email: profileEmail.trim(),
      phone: profilePhone.trim(),
    });
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddrLabel('');
    setAddrRecipient(customer.fullName || '');
    setAddrPhone(customer.phone || '');
    setAddrCountry('');
    setAddrCity('');
    setAddrArea('');
    setAddrStreet('');
    setAddrInstructions('');
    setAddrIsDefault(addresses.length === 0);
  };

  const openNewAddressForm = () => {
    resetAddressForm();
    setShowAddressForm(true);
  };

  const openEditAddressForm = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label);
    setAddrRecipient(addr.recipientName);
    setAddrPhone(addr.phone);
    setAddrCountry(addr.country);
    setAddrCity(addr.city);
    setAddrArea(addr.area);
    setAddrStreet(addr.deliveryAddress);
    setAddrInstructions(addr.deliveryInstructions ?? '');
    setAddrIsDefault(addr.isDefault);
    setShowAddressForm(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !addrLabel.trim() ||
      !addrCountry.trim() ||
      !addrCity.trim() ||
      !addrArea.trim() ||
      !addrStreet.trim()
    ) {
      return;
    }

    const payload: Omit<SavedAddress, 'id'> = {
      label: addrLabel.trim(),
      recipientName: addrRecipient.trim() || customer.fullName || 'Guest Client',
      phone: addrPhone.trim() || customer.phone,
      country: addrCountry.trim(),
      city: addrCity.trim(),
      area: addrArea.trim(),
      deliveryAddress: addrStreet.trim(),
      deliveryInstructions: addrInstructions.trim() || undefined,
      isDefault: addrIsDefault || addresses.length === 0,
    };

    if (editingAddressId) {
      void updateAddress(editingAddressId, payload);
    } else {
      void addAddress(payload);
    }
    setShowAddressForm(false);
    setEditingAddressId(null);
  };

  const handleOpenPrintable = (order: OrderRecord) => {
    setReceiptOrder(order);
  };

  const hasContactDetails = Boolean(customer.email || customer.phone);

  const accountTabs: {
    id: AccountTab;
    label: string;
    icon: React.FC<{ className?: string; strokeWidth?: number }>;
    badge?: number;
    fullWidthOnTiny?: boolean;
  }[] = [
    {
      id: 'orders',
      label: 'Orders & Tracking',
      icon: Package,
      badge: orders.length > 0 ? orders.length : undefined,
    },
    { id: 'profile', label: 'Personal Info', icon: User },
    { id: 'addresses', label: 'Delivery Addresses', icon: MapPin },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
    },
    { id: 'preferences', label: 'Preferences', icon: Settings, fullWidthOnTiny: true },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 md:pt-10 md:pb-16">
      {/* Client Account Header */}
      <section className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4 sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#D8C3A5] bg-[#EFE7DA] text-[#302923]">
              <User className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.18em] text-[#7A5D39] uppercase">
                {isAuthenticated ? 'Verified Client Account' : 'Client Account'}
              </p>
              <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-[#302923] sm:text-4xl">
                {customer.fullName || (isAuthenticated ? 'VEY RASHA Client' : 'Client Access')}
              </h1>
              {hasContactDetails ? (
                <p className="mt-1.5 truncate text-xs leading-relaxed text-[#665B51]">
                  {[customer.email, customer.phone].filter(Boolean).join(' · ')}
                </p>
              ) : (
                <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-[#665B51]">
                  Sign in with Google or your email and password to manage saved delivery addresses,
                  place orders, and view live status updates.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-5 py-2.5 text-xs font-semibold tracking-wider text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA]"
              >
                <LogOut className="h-3.5 w-3.5 text-[#7A5D39]" strokeWidth={1.6} />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderId(null);
                  setActiveTab('orders');
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#302923] px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
              >
                <span>Sign In / Register</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-5 py-2.5 text-xs font-medium text-[#302923] transition-colors hover:bg-[#EFE7DA]"
            >
              <Bell className="h-4 w-4 text-[#7A5D39]" strokeWidth={1.6} />
              <span>Notifications</span>
              {unreadNotificationCount > 0 && (
                <span className="rounded-full bg-[#302923] px-2 py-0.5 text-[10px] font-semibold text-[#F6F1E8] tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {backendStatus === 'unavailable' && (
        <div
          role="status"
          className="mt-5 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#D8C3A5] bg-[#EFE7DA] px-5 py-4 text-xs text-[#302923] sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7A5D39]" />
            <span>
              {backendErrorMessage ??
                'Unable to reach the boutique server. Order verification and live updates require an active connection.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void checkBackendHealth()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-[#302923]/30 bg-[#FCF9F4] px-4 py-2 text-[11px] font-semibold tracking-wider text-[#302923] uppercase hover:bg-[#F6F1E8]"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Non-Scrolling Wrapped Account Navigation Tabs (Zero Cut-Off on Mobile) */}
      <nav
        aria-label="Account Sections"
        className="mt-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap"
      >
        {accountTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'orders') {
                  setSelectedOrderId(null);
                }
              }}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors sm:justify-start sm:rounded-full sm:px-5 ${
                tab.fullWidthOnTiny ? 'col-span-2 sm:col-span-1' : ''
              } ${
                active
                  ? 'bg-[#302923] text-[#F6F1E8]'
                  : 'border border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:border-[#B59972] hover:text-[#302923]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
              <span className="truncate">{tab.label}</span>
              {typeof tab.badge === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    active ? 'bg-[#F6F1E8] text-[#302923]' : 'bg-[#EFE7DA] text-[#302923]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* =====================================================================
          1. ORDERS & TRACKING (Cards List + Dedicated Order Details Screen)
         ===================================================================== */}
      {activeTab === 'orders' && (
        <div className="mt-6 space-y-6">
          {selectedOrder ? (
            /* ORDER DETAILS SCREEN */
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium tracking-wider text-[#665B51] uppercase hover:text-[#302923]"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
                  <span>Back to All Orders</span>
                </button>

                <button
                  type="button"
                  onClick={() => void refreshOrders()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#E4D8C5] bg-[#FCF9F4] px-4 py-2 text-xs font-medium text-[#665B51] hover:border-[#B59972] hover:text-[#302923]"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`}
                    strokeWidth={1.6}
                  />
                  <span>Refresh Status</span>
                </button>
              </div>

              <article className="rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] p-5 sm:p-8">
                {/* Order Reference & Status Header */}
                <div className="flex flex-col justify-between gap-4 border-b border-[#E4D8C5] pb-5 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs text-[#665B51] tabular-nums">
                      Order {selectedOrder.orderReference} ·{' '}
                      {formatOrderDate(selectedOrder.createdAt)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      {(() => {
                        const StatusIcon = getOrderStatusIcon(selectedOrder.status);
                        return (
                          <StatusIcon className="h-5 w-5 text-[#7A5D39]" strokeWidth={1.6} />
                        );
                      })()}
                      <h2 className="font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                        {ORDER_STATUS_LABELS[selectedOrder.status]}
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-[#665B51]">
                      Payment Status:{' '}
                      <strong className="text-[#302923]">
                        {PAYMENT_STATUS_LABELS[selectedOrder.paymentStatus]}
                      </strong>
                    </p>
                    {selectedOrder.estimatedDeliveryTime && (
                      <p className="mt-1 text-xs text-[#665B51]">
                        Estimated Delivery:{' '}
                        <strong className="text-[#302923]">
                          {selectedOrder.estimatedDeliveryTime}
                        </strong>
                      </p>
                    )}
                  </div>

                  {/* Print Receipt & Save as PDF Actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {isOrderConfirmedOrLater(selectedOrder.status) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenPrintable(selectedOrder)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#302923] px-5 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
                        >
                          <Printer className="h-4 w-4" strokeWidth={1.6} />
                          <span>Print Receipt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPrintable(selectedOrder)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-5 py-2 text-xs font-semibold tracking-wider text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA]"
                        >
                          <FileDown className="h-4 w-4" strokeWidth={1.6} />
                          <span>Save as PDF</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenPrintable(selectedOrder)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-5 py-2 text-xs font-medium text-[#302923] transition-colors hover:bg-[#EFE7DA]"
                      >
                        <Printer className="h-4 w-4 text-[#7A5D39]" strokeWidth={1.6} />
                        <span>Order Request Summary</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 7-State Status Timeline */}
                {selectedOrder.status === 'CANCELLED' ? (
                  <div className="mt-5 rounded-xl border border-[#D8C3A5] bg-[#EFE7DA]/70 px-4 py-3.5 text-xs leading-relaxed text-[#302923]">
                    This order has been marked as <strong>Cancelled</strong>.
                    {selectedOrder.ownerMessage
                      ? ` Note from VEY RASHA: "${selectedOrder.ownerMessage}"`
                      : ''}
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {ORDER_TIMELINE_STEPS.map((step, idx) => {
                        const timelineIdx = getOrderTimelineIndex(selectedOrder.status);
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

                {selectedOrder.ownerMessage && selectedOrder.status !== 'CANCELLED' && (
                  <div className="mt-5 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-4 py-3.5 text-xs leading-relaxed text-[#302923]">
                    <strong className="font-semibold">Message from VEY RASHA: </strong>
                    {selectedOrder.ownerMessage}
                  </div>
                )}

                {/* Itemized Products */}
                <div className="mt-6 border-t border-[#E4D8C5] pt-5">
                  <h3 className="text-xs font-semibold tracking-wider text-[#7A5D39] uppercase">
                    Ordered Pieces
                  </h3>
                  <ul className="mt-3 divide-y divide-[#E4D8C5]">
                    {selectedOrder.items.map((item, idx) => (
                      <li
                        key={`${selectedOrder.id}-detail-${idx}`}
                        className="flex items-center gap-4 py-3.5"
                      >
                        <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg border border-[#E4D8C5]/70 bg-[#EFE7DA]">
                          <LuxuryImage
                            src={item.image}
                            alt={item.productName}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-lg font-medium text-[#302923]">
                            {item.productName}
                          </p>
                          <p className="mt-0.5 text-xs text-[#665B51]">
                            Size {item.size} · {item.colorName}
                          </p>
                          <p className="mt-0.5 text-xs text-[#665B51] tabular-nums">
                            Qty {item.quantity} ×{' '}
                            {formatPrice(item.unitPriceUsd, selectedOrder.currencyAtOrder)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-[#302923] tabular-nums">
                          {formatPrice(item.lineTotalUsd, selectedOrder.currencyAtOrder)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Delivery Information & Confirmed Totals */}
                <div className="mt-5 grid grid-cols-1 gap-5 border-t border-[#E4D8C5] pt-5 md:grid-cols-2">
                  <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-4 text-xs leading-relaxed text-[#665B51]">
                    <p className="font-semibold tracking-wider text-[#7A5D39] uppercase">
                      Delivery Information
                    </p>
                    <p className="mt-2 text-sm font-medium text-[#302923]">
                      {selectedOrder.customer.fullName}
                    </p>
                    <p className="text-[#302923]">{selectedOrder.customer.phone}</p>
                    <p className="mt-1.5 text-[#302923]">
                      {selectedOrder.customer.deliveryAddress}
                    </p>
                    <p>
                      {selectedOrder.customer.area}, {selectedOrder.customer.city},{' '}
                      {selectedOrder.customer.country}
                    </p>
                    {selectedOrder.customer.deliveryInstructions && (
                      <p className="mt-1.5 text-[#302923]">
                        Instructions: {selectedOrder.customer.deliveryInstructions}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-4">
                    <p className="text-xs font-semibold tracking-wider text-[#7A5D39] uppercase">
                      Order Totals
                    </p>
                    <dl className="mt-3 space-y-2.5 text-sm">
                      <div className="flex justify-between gap-4 text-[#665B51]">
                        <dt>Product Subtotal</dt>
                        <dd className="font-medium text-[#302923] tabular-nums">
                          {formatPrice(selectedOrder.subtotalUsd, selectedOrder.currencyAtOrder)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 text-[#665B51]">
                        <dt>
                          {isOrderConfirmedOrLater(selectedOrder.status)
                            ? 'Confirmed Delivery Fee'
                            : 'Delivery Fee'}
                        </dt>
                        <dd className="text-right font-medium text-[#302923] tabular-nums">
                          {selectedOrder.deliveryFeeUsd !== null
                            ? formatPrice(
                                selectedOrder.deliveryFeeUsd,
                                selectedOrder.currencyAtOrder
                              )
                            : 'Pending boutique review'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-[#E4D8C5] pt-2.5 text-base font-semibold text-[#302923]">
                        <dt>
                          {isOrderConfirmedOrLater(selectedOrder.status)
                            ? 'Confirmed Final Total'
                            : 'Final Total'}
                        </dt>
                        <dd className="text-right tabular-nums">
                          {selectedOrder.finalTotalUsd !== null
                            ? formatPrice(
                                selectedOrder.finalTotalUsd,
                                selectedOrder.currencyAtOrder
                              )
                            : 'Confirmed after review'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            /* ORDERS CARDS LIST */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl font-medium text-[#302923]">
                    Orders &amp; Tracking
                  </h2>
                  <p className="mt-0.5 text-xs text-[#665B51]">
                    Follow review status, confirmed delivery fees, and receipts.
                  </p>
                </div>

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => void refreshOrders()}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#E4D8C5] bg-[#FCF9F4] px-4 py-2 text-xs font-medium text-[#665B51] hover:border-[#B59972] hover:text-[#302923]"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`}
                      strokeWidth={1.6}
                    />
                    <span>Refresh</span>
                  </button>
                )}
              </div>

              {!isAuthenticated ? (
                <div className="flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE7DA] text-[#7A5D39]">
                    <Package className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
                    Sign in to track your orders
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[#665B51]">
                    Sign in with Google or your email and password to view submitted order requests,
                    confirmed delivery fees, printable receipts, and live dispatch updates.
                  </p>
                  <div className="mt-6 w-full max-w-sm">
                    <CustomerAuthPanel compact />
                  </div>
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE7DA] text-[#7A5D39]">
                    <Package className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
                    No orders placed yet
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[#665B51]">
                    When you submit an order request at checkout, it will appear here with real-time
                    boutique status updates and printable receipts.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('explore')}
                    className="mt-6 min-h-[46px] rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.12em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
                  >
                    Shop now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {orders.map((order) => {
                    const StatusIcon = getOrderStatusIcon(order.status);
                    const confirmed = isOrderConfirmedOrLater(order.status);
                    const firstItem = order.items[0];
                    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);

                    return (
                      <article
                        key={order.id}
                        className="flex flex-col justify-between rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 transition-colors hover:border-[#B59972] sm:p-6"
                      >
                        <div>
                          {/* Card Top Meta & Status */}
                          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E4D8C5] pb-4">
                            <div>
                              <p className="text-xs text-[#665B51] tabular-nums">
                                {order.orderReference} · {formatOrderDate(order.createdAt)}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <StatusIcon
                                  className="h-4 w-4 text-[#7A5D39]"
                                  strokeWidth={1.7}
                                />
                                <h3 className="font-serif text-xl font-medium text-[#302923]">
                                  {ORDER_STATUS_LABELS[order.status]}
                                </h3>
                              </div>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-xs text-[#665B51]">
                                {confirmed && order.finalTotalUsd !== null
                                  ? 'Confirmed Total'
                                  : 'Product Subtotal'}
                              </p>
                              <p className="text-base font-semibold text-[#302923] tabular-nums">
                                {confirmed && order.finalTotalUsd !== null
                                  ? formatPrice(order.finalTotalUsd, order.currencyAtOrder)
                                  : formatPrice(order.subtotalUsd, order.currencyAtOrder)}
                              </p>
                              {confirmed && order.deliveryFeeUsd !== null && (
                                <p className="mt-0.5 text-[11px] text-[#665B51] tabular-nums">
                                  Delivery Fee:{' '}
                                  {formatPrice(order.deliveryFeeUsd, order.currencyAtOrder)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Product Thumbnail Preview */}
                          {firstItem && (
                            <div className="mt-4 flex items-center gap-4">
                              <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl border border-[#E4D8C5]/70 bg-[#EFE7DA]">
                                <LuxuryImage
                                  src={firstItem.image}
                                  alt={firstItem.productName}
                                  className="h-full w-full"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-serif text-lg font-medium text-[#302923]">
                                  {firstItem.productName}
                                </p>
                                <p className="text-xs text-[#665B51]">
                                  {order.items.length > 1
                                    ? `+ ${order.items.length - 1} additional ${
                                        order.items.length - 1 === 1 ? 'piece' : 'pieces'
                                      } · ${totalQty} total`
                                    : `Size ${firstItem.size} · ${firstItem.colorName} · Qty ${firstItem.quantity}`}
                                </p>
                                <p className="mt-1 text-xs text-[#665B51]">
                                  {order.customer.city}, {order.customer.country}
                                </p>
                              </div>
                            </div>
                          )}

                          {order.estimatedDeliveryTime && (
                            <p className="mt-3 text-xs text-[#665B51]">
                              Est. Delivery:{' '}
                              <strong className="text-[#302923]">
                                {order.estimatedDeliveryTime}
                              </strong>
                            </p>
                          )}

                          {order.ownerMessage && (
                            <p className="mt-2 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3 py-2 text-xs leading-relaxed text-[#302923]">
                              <strong className="font-semibold">VEY RASHA:</strong>{' '}
                              {order.ownerMessage}
                            </p>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E4D8C5] pt-4">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#302923] px-5 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
                          >
                            <span>View Order Details</span>
                            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>

                          {confirmed ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenPrintable(order)}
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-3.5 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                              >
                                <Printer className="h-3.5 w-3.5" strokeWidth={1.6} />
                                <span>Print Receipt</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPrintable(order)}
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#E4D8C5] px-3.5 py-2 text-xs font-medium text-[#665B51] hover:border-[#B59972] hover:text-[#302923]"
                              >
                                <FileDown className="h-3.5 w-3.5" strokeWidth={1.6} />
                                <span>Save as PDF</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenPrintable(order)}
                              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-3.5 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                            >
                              <Printer className="h-3.5 w-3.5" strokeWidth={1.6} />
                              <span>Order Summary</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          2. PERSONAL INFORMATION
         ===================================================================== */}
      {activeTab === 'profile' && (
        <div className="mt-6 max-w-2xl">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:p-8"
          >
            <h2 className="font-serif text-2xl font-medium text-[#302923]">
              Personal Information
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#665B51]">
              Save your contact information for this session so checkout fills faster. Creating an
              account is never required to place an order.
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

      {/* =====================================================================
          3. DELIVERY ADDRESSES (Save, Edit & Delete Manually — Zero GPS)
         ===================================================================== */}
      {activeTab === 'addresses' && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#302923]">
                Delivery Addresses
              </h2>
              <p className="mt-0.5 text-xs text-[#665B51]">
                Manually enter, edit, or remove your preferred delivery destinations.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewAddressForm}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#302923] px-5 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Address</span>
            </button>
          </div>

          {showAddressForm && (
            <form
              onSubmit={handleSaveAddress}
              className="rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] p-5 sm:p-7"
            >
              <h3 className="font-serif text-xl font-medium text-[#302923]">
                {editingAddressId ? 'Edit Delivery Address' : 'Add Delivery Address'}
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="addr-label"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Address Label
                  </label>
                  <input
                    id="addr-label"
                    type="text"
                    required
                    placeholder="e.g., Home, Residence, Office"
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="addr-recipient"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Recipient Name
                  </label>
                  <input
                    id="addr-recipient"
                    type="text"
                    placeholder="Full name"
                    value={addrRecipient}
                    onChange={(e) => setAddrRecipient(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="addr-phone"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Phone Number
                  </label>
                  <input
                    id="addr-phone"
                    type="tel"
                    placeholder="Phone with country code"
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="addr-country"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Country
                  </label>
                  <input
                    id="addr-country"
                    type="text"
                    required
                    placeholder="Enter country"
                    value={addrCountry}
                    onChange={(e) => setAddrCountry(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="addr-city"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    City
                  </label>
                  <input
                    id="addr-city"
                    type="text"
                    required
                    placeholder="Enter city"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="addr-area"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Area or Neighborhood
                  </label>
                  <input
                    id="addr-area"
                    type="text"
                    required
                    placeholder="District, area, or neighborhood"
                    value={addrArea}
                    onChange={(e) => setAddrArea(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="addr-street"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Complete Delivery Address
                  </label>
                  <textarea
                    id="addr-street"
                    rows={2}
                    required
                    placeholder="House/building number, street name, apartment, and nearby landmark"
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    className="w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="addr-instructions"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Delivery Instructions (Optional)
                  </label>
                  <input
                    id="addr-instructions"
                    type="text"
                    placeholder="Gate code, call timing, or courier instructions"
                    value={addrInstructions}
                    onChange={(e) => setAddrInstructions(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 pt-1 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={addrIsDefault}
                    onChange={(e) => setAddrIsDefault(e.target.checked)}
                    className="h-4 w-4 accent-[#302923]"
                  />
                  <span className="text-xs text-[#665B51]">Set as default delivery address</span>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="min-h-[44px] rounded-full bg-[#302923] px-6 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
                >
                  {editingAddressId ? 'Update Address' : 'Save Address'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddressForm(false);
                    setEditingAddressId(null);
                  }}
                  className="min-h-[44px] rounded-full border border-[#E4D8C5] px-5 py-2 text-xs font-medium text-[#665B51] hover:text-[#302923]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {addresses.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE7DA] text-[#7A5D39]">
                <MapPin className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
                No saved delivery addresses yet
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#665B51]">
                Save your delivery destination manually so it can be selected quickly during
                checkout. Your device location is never requested.
              </p>
              {!showAddressForm && (
                <button
                  type="button"
                  onClick={openNewAddressForm}
                  className="mt-6 inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.12em] text-[#F6F1E8] uppercase hover:bg-[#463D35]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Delivery Address</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {addresses.map((addr) => (
                <article
                  key={addr.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 sm:p-6"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-serif text-xl font-medium text-[#302923]">
                        {addr.label}
                      </h3>
                      {addr.isDefault && (
                        <span className="text-xs font-medium text-[#7A5D39]">Default</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#302923]">{addr.recipientName}</p>
                    {addr.phone && <p className="text-xs text-[#665B51]">{addr.phone}</p>}
                    <p className="mt-1.5 text-sm text-[#302923]">{addr.deliveryAddress}</p>
                    <p className="text-xs text-[#665B51]">
                      {addr.area}, {addr.city}, {addr.country}
                    </p>
                    {addr.deliveryInstructions && (
                      <p className="mt-1.5 text-xs text-[#665B51]">
                        Note: {addr.deliveryInstructions}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4D8C5] pt-3">
                    {!addr.isDefault ? (
                      <button
                        type="button"
                        onClick={() => void setDefaultAddress(addr.id)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[#302923] hover:text-[#7A5D39]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Set as Default</span>
                      </button>
                    ) : (
                      <span className="text-xs text-[#665B51]">Primary destination</span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditAddressForm(addr)}
                        aria-label={`Edit ${addr.label}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                      >
                        <Edit3 className="h-3.5 w-3.5" strokeWidth={1.6} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeAddress(addr.id)}
                        aria-label={`Delete ${addr.label}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#665B51] hover:bg-[#EFE7DA] hover:text-[#302923]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. NOTIFICATIONS (Order Confirmations & Boutique Updates)
         ===================================================================== */}
      {activeTab === 'notifications' && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#302923]">Notifications</h2>
              <p className="mt-0.5 text-xs text-[#665B51]">
                Order confirmations, confirmed delivery fees, shipment updates, and boutique news.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshNotifications()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#E4D8C5] bg-[#FCF9F4] px-4 py-2 text-xs font-medium text-[#665B51] hover:border-[#B59972] hover:text-[#302923]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoadingNotifications ? 'animate-spin' : ''}`}
                  strokeWidth={1.6}
                />
                <span>Refresh</span>
              </button>
              {unreadNotificationCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                >
                  <CheckCheck className="h-4 w-4" strokeWidth={1.6} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {browserNotificationPermission === 'default' && (
            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] px-5 py-4 sm:flex-row sm:items-center">
              <div className="text-xs leading-relaxed text-[#665B51]">
                <p className="font-semibold text-[#302923]">Enable Live Order Alerts</p>
                <p>
                  Receive an immediate alert when VEY RASHA confirms your delivery fee and accepts
                  your order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void requestBrowserNotifications()}
                className="min-h-[44px] shrink-0 rounded-full bg-[#302923] px-5 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
              >
                Allow Alerts
              </button>
            </div>
          )}

          {/* Wrapped Filter Controls (Never clipped on mobile) */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'order_update', label: 'Order Confirmations' },
                { id: 'delivery_update', label: 'Delivery Updates' },
                { id: 'boutique_announcement', label: 'Boutique Updates' },
              ] as const
            ).map((f) => {
              const active = notifFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setNotifFilter(f.id)}
                  className={`min-h-[44px] rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#302923] text-[#F6F1E8]'
                      : 'border border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:text-[#302923]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {notificationsError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs text-[#302923]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7A5D39]" />
              <span>{notificationsError}</span>
            </div>
          )}

          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE7DA] text-[#7A5D39]">
                <Bell className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
                No notifications yet
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#665B51]">
                When VEY RASHA reviews your delivery address, confirms your delivery fee, or shares
                boutique announcements, updates will appear here in real time.
              </p>
              <button
                type="button"
                onClick={() => navigate('explore')}
                className="mt-6 min-h-[44px] rounded-full bg-[#302923] px-6 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
              >
                Shop now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((item) => {
                const Icon =
                  item.type === 'order_update'
                    ? Package
                    : item.type === 'delivery_update'
                    ? Truck
                    : Sparkles;
                const displayCurrency = item.currency ?? STORE_CURRENCY;
                const hasConfirmedBreakdown =
                  typeof item.confirmedDeliveryFeeUsd === 'number' ||
                  typeof item.confirmedFinalTotalUsd === 'number';

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-5 transition-colors ${
                      item.read
                        ? 'border-[#E4D8C5] bg-[#FCF9F4]/70'
                        : 'border-[#B59972] bg-[#FCF9F4]'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          item.read
                            ? 'bg-[#EFE7DA] text-[#665B51]'
                            : 'bg-[#302923] text-[#F6F1E8]'
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.6} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium tracking-wider text-[#7A5D39] uppercase">
                            {item.typeLabel}
                          </span>
                          <div className="flex items-center gap-2 text-[#665B51]">
                            <span>{formatOrderDate(item.timestamp)}</span>
                            {!item.read && (
                              <span className="font-semibold text-[#302923]">Unread</span>
                            )}
                          </div>
                        </div>

                        <h3 className="mt-1 font-serif text-xl font-medium text-[#302923]">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-[#665B51]">
                          {item.message}
                        </p>

                        {hasConfirmedBreakdown && (
                          <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/80 p-3.5 text-xs sm:grid-cols-3">
                            {typeof item.confirmedDeliveryFeeUsd === 'number' && (
                              <div>
                                <dt className="text-[#665B51]">Confirmed Delivery Fee</dt>
                                <dd className="mt-0.5 font-semibold text-[#302923] tabular-nums">
                                  {formatPrice(item.confirmedDeliveryFeeUsd, displayCurrency)}
                                </dd>
                              </div>
                            )}
                            {typeof item.confirmedFinalTotalUsd === 'number' && (
                              <div>
                                <dt className="text-[#665B51]">Confirmed Final Total</dt>
                                <dd className="mt-0.5 font-semibold text-[#302923] tabular-nums">
                                  {formatPrice(item.confirmedFinalTotalUsd, displayCurrency)}
                                </dd>
                              </div>
                            )}
                            {item.estimatedDeliveryTime && (
                              <div>
                                <dt className="text-[#665B51]">Estimated Delivery</dt>
                                <dd className="mt-0.5 font-semibold text-[#302923]">
                                  {item.estimatedDeliveryTime}
                                </dd>
                              </div>
                            )}
                          </dl>
                        )}

                        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                          {item.orderId && (
                            <button
                              type="button"
                              onClick={() => {
                                markNotificationRead(item.id);
                                setSelectedOrderId(item.orderId!);
                                setActiveTab('orders');
                              }}
                              className="min-h-[44px] rounded-full bg-[#302923] px-4 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
                            >
                              View Order Details
                            </button>
                          )}
                          {!item.read && (
                            <button
                              type="button"
                              onClick={() => markNotificationRead(item.id)}
                              className="min-h-[44px] rounded-full border border-[#D8C3A5] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                            >
                              Mark as Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          5. PREFERENCES
         ===================================================================== */}
      {activeTab === 'preferences' && (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6">
            <h2 className="font-serif text-2xl font-medium text-[#302923]">Sizing Preferences</h2>

            <div className="mt-5">
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
                      <Check className="h-3.5 w-3.5 text-[#7A5D39]" />
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
                      className="min-h-[44px] rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
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
