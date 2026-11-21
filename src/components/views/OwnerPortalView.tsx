import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  PackagePlus,
  Percent,
  Printer,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sliders,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PRODUCTS } from '../../data/catalog';
import { useBoutique } from '../../context/BoutiqueContext';
import type {
  OrderRecord,
  OrderStatus,
  OwnerSectionId,
  PaymentStatus,
} from '../../types/boutique';
import { formatPrice } from '../../utils/formatCurrency';
import {
  formatOrderDate,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/orderStatus';
import { PrintableReceiptModal } from '../orders/PrintableReceiptModal';
import { LuxuryImage } from '../ui/LuxuryImage';

const OWNER_NAV_ITEMS: {
  id: OwnerSectionId;
  label: string;
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
}[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'orders', label: 'Orders', icon: Sliders },
  { id: 'products', label: 'Products', icon: ShoppingBag },
  { id: 'add_product', label: 'Add Product', icon: PackagePlus },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'promotions', label: 'Promotions', icon: Percent },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'store_settings', label: 'Store Settings', icon: Settings },
];

const ALL_STATUS_FILTERS: { value: 'ALL' | OrderStatus; label: string }[] = [
  { value: 'ALL', label: 'All Orders' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const FULFILLMENT_STATUS_OPTIONS: OrderStatus[] = [
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  'UNPAID',
  'PAYMENT_PENDING',
  'PAID',
  'REFUNDED',
];

export const OwnerPortalView: React.FC = () => {
  const {
    isOwnerAuthenticated,
    ownerEmail,
    ownerAuthStatus,
    refreshOwnerAuthStatus,
    setupOwnerAccount,
    authenticateOwner,
    signOutOwner,
    navigate,
    storeSettings,
    ownerOrders,
    isLoadingOwnerOrders,
    refreshOwnerOrders,
    acceptOwnerOrder,
    updateOwnerOrderStatus,
    updateOwnerPaymentStatus,
  } = useBoutique();

  // Auth / First-run setup form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard state
  const [activeSection, setActiveSection] = useState<OwnerSectionId>('orders');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Owner Review fields for selected order
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');
  const [estimatedDeliveryInput, setEstimatedDeliveryInput] = useState('');
  const [ownerMessageInput, setOwnerMessageInput] = useState('');
  const [orderActionError, setOrderActionError] = useState<string | null>(null);
  const [isProcessingOrderAction, setIsProcessingOrderAction] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (!isOwnerAuthenticated) {
      void refreshOwnerAuthStatus();
    }
  }, [isOwnerAuthenticated, refreshOwnerAuthStatus]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return ownerOrders;
    return ownerOrders.filter((o) => o.status === statusFilter);
  }, [ownerOrders, statusFilter]);

  const selectedOrder = useMemo(() => {
    if (filteredOrders.length === 0) return null;
    return filteredOrders.find((o) => o.id === selectedOrderId) ?? filteredOrders[0];
  }, [filteredOrders, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrder) return;
    setOrderActionError(null);
    setDeliveryFeeInput(
      selectedOrder.deliveryFeeUsd !== null ? String(selectedOrder.deliveryFeeUsd) : ''
    );
    setEstimatedDeliveryInput(selectedOrder.estimatedDeliveryTime ?? '');
    setOwnerMessageInput(selectedOrder.ownerMessage ?? '');
  }, [selectedOrder?.id]);

  const pendingReviewCount = useMemo(
    () => ownerOrders.filter((o) => o.status === 'PENDING_REVIEW').length,
    [ownerOrders]
  );

  const parsedFeeUsd = Number(deliveryFeeInput);
  const hasValidFee =
    deliveryFeeInput.trim() !== '' && Number.isFinite(parsedFeeUsd) && parsedFeeUsd >= 0;
  const computedFinalTotalUsd =
    selectedOrder && hasValidFee
      ? Number((selectedOrder.subtotalUsd + parsedFeeUsd).toFixed(2))
      : null;

  const handleFirstRunSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (password.length < 8) {
      setAuthError('Please choose a password of at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    setIsSubmittingAuth(true);
    try {
      const result = await setupOwnerAccount(email, password);
      if (!result.authenticated) {
        setAuthError(result.error ?? 'Setup failed.');
      } else {
        setPassword('');
        setConfirmPassword('');
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      const result = await authenticateOwner(email, password);
      if (!result.authenticated) {
        setAuthError(result.error ?? 'Authentication failed.');
      } else {
        setPassword('');
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleAcceptOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setOrderActionError(null);

    if (!hasValidFee) {
      setOrderActionError('Enter a valid non-negative delivery fee.');
      return;
    }
    if (!estimatedDeliveryInput.trim()) {
      setOrderActionError('Enter an estimated delivery time for the customer.');
      return;
    }

    setIsProcessingOrderAction(true);
    try {
      const res = await acceptOwnerOrder(selectedOrder.id, {
        deliveryFeeUsd: Number(parsedFeeUsd.toFixed(2)),
        estimatedDeliveryTime: estimatedDeliveryInput.trim(),
        ownerMessage: ownerMessageInput.trim() || undefined,
      });
      if (!res.ok) {
        setOrderActionError(res.error ?? 'Unable to accept order.');
      }
    } finally {
      setIsProcessingOrderAction(false);
    }
  };

  const handleUpdateStatus = async (status: OrderStatus) => {
    if (!selectedOrder) return;
    setOrderActionError(null);
    setIsProcessingOrderAction(true);
    try {
      const res = await updateOwnerOrderStatus(selectedOrder.id, {
        status,
        estimatedDeliveryTime: estimatedDeliveryInput.trim() || undefined,
        ownerMessage: ownerMessageInput.trim() || undefined,
      });
      if (!res.ok) {
        setOrderActionError(res.error ?? 'Unable to update order status.');
      }
    } finally {
      setIsProcessingOrderAction(false);
    }
  };

  const handleUpdatePayment = async (paymentStatus: PaymentStatus) => {
    if (!selectedOrder) return;
    setOrderActionError(null);
    setIsProcessingOrderAction(true);
    try {
      const res = await updateOwnerPaymentStatus(selectedOrder.id, paymentStatus);
      if (!res.ok) {
        setOrderActionError(res.error ?? 'Unable to update payment status.');
      }
    } finally {
      setIsProcessingOrderAction(false);
    }
  };

  // Protected Sign-In / First-Run Setup Gate
  if (!isOwnerAuthenticated) {
    const needsSetup = Boolean(ownerAuthStatus?.needsFirstRunSetup);

    return (
      <div className="flex min-h-screen flex-col justify-between bg-[#F6F1E8] px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium tracking-wider text-[#665B51] uppercase hover:text-[#302923]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
            <span>Return to Storefront</span>
          </button>
        </div>

        <main className="mx-auto my-8 w-full max-w-md">
          <div className="rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] p-7 sm:p-9">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#302923] text-[#F6F1E8]">
                <Lock className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <p className="mt-4 text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                VEY RASHA Management
              </p>
              <h1 className="mt-1 font-serif text-3xl font-medium text-[#302923]">
                {needsSetup ? 'Claim Owner Workspace' : 'Owner Sign In'}
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-[#665B51]">
                {needsSetup
                  ? 'Set your private single-boutique owner credentials for this environment. Once claimed, this setup locks automatically.'
                  : 'Private single-boutique administration access. Sign in to review order requests and confirm delivery fees.'}
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs leading-relaxed text-[#302923]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                <span>{authError}</span>
              </div>
            )}

            <form
              onSubmit={needsSetup ? handleFirstRunSetup : handleOwnerLogin}
              className="mt-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="owner-email"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  Owner Email
                </label>
                <input
                  id="owner-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="owner@veyrasha.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="owner-password"
                  className="mb-1.5 block text-xs font-medium text-[#302923]"
                >
                  {needsSetup ? 'Create Owner Password (min 8 chars)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="owner-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={needsSetup ? 'new-password' : 'current-password'}
                    placeholder={needsSetup ? 'Choose a strong password' : 'Enter owner password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] pr-12 pl-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#665B51] hover:text-[#302923]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.6} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.6} />
                    )}
                  </button>
                </div>
              </div>

              {needsSetup && (
                <div>
                  <label
                    htmlFor="owner-confirm-password"
                    className="mb-1.5 block text-xs font-medium text-[#302923]"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="owner-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#302923] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] disabled:opacity-60"
              >
                {isSubmittingAuth
                  ? 'Verifying...'
                  : needsSetup
                  ? 'Save Owner Credentials & Enter'
                  : 'Sign In to Owner Dashboard'}
              </button>
            </form>
          </div>
        </main>

        <footer className="mx-auto w-full max-w-md text-center text-xs text-[#665B51]">
          <p>VEY RASHA · Single-Boutique Administration</p>
        </footer>
      </div>
    );
  }

  // Protected Single-Boutique Owner Dashboard Workspace
  return (
    <div className="min-h-screen bg-[#F6F1E8] text-[#302923]">
      {/* Owner Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E4D8C5] bg-[#FCF9F4]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl font-medium tracking-[0.12em] text-[#302923]">
              VEY RASHA
            </span>
            <span className="hidden text-xs text-[#8C6D46] sm:inline">
              Boutique Owner Workspace
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {ownerEmail && (
              <span className="hidden text-xs text-[#665B51] md:inline">{ownerEmail}</span>
            )}
            <button
              type="button"
              onClick={() => navigate('home')}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
            >
              <Store className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span>Return to Storefront</span>
            </button>
            <button
              type="button"
              onClick={signOutOwner}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#302923] px-4 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        {/* Single-Boutique Owner Navigation */}
        <aside className="lg:col-span-3">
          <nav
            aria-label="Owner Dashboard Sections"
            className="flex gap-2 overflow-x-auto pb-2 no-scrollbar lg:flex-col lg:overflow-visible"
          >
            {OWNER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`inline-flex min-h-[44px] shrink-0 items-center justify-between gap-2.5 rounded-xl px-4 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#302923] text-[#F6F1E8]'
                      : 'border border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:border-[#B59972] hover:text-[#302923] lg:border-transparent lg:bg-transparent'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'orders' && pendingReviewCount > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                        active ? 'bg-[#F6F1E8] text-[#302923]' : 'bg-[#302923] text-[#F6F1E8]'
                      }`}
                    >
                      {pendingReviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Owner Section */}
        <main className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 sm:p-8 lg:col-span-9">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                  Boutique Overview
                </p>
                <h2 className="mt-1 font-serif text-3xl font-medium text-[#302923]">
                  {storeSettings.boutiqueName}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-5">
                  <p className="text-xs text-[#665B51]">Pending Review Requests</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {pendingReviewCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-5">
                  <p className="text-xs text-[#665B51]">Total Orders</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {ownerOrders.length}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-5">
                  <p className="text-xs text-[#665B51]">Catalog Pieces</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {PRODUCTS.length}
                  </p>
                </div>
              </div>

              {pendingReviewCount > 0 && (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#D8C3A5] bg-[#EFE7DA]/70 p-4 sm:flex-row sm:items-center">
                  <p className="text-sm text-[#302923]">
                    You have <strong>{pendingReviewCount}</strong> order{' '}
                    {pendingReviewCount === 1 ? 'request' : 'requests'} awaiting delivery fee
                    confirmation.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('PENDING_REVIEW');
                      setActiveSection('orders');
                    }}
                    className="min-h-[40px] rounded-full bg-[#302923] px-5 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
                  >
                    Review Pending Orders
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-3 border-b border-[#E4D8C5] pb-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                    Order Management
                  </p>
                  <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    Customer Order Requests
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshOwnerOrders()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoadingOwnerOrders ? 'animate-spin' : ''}`}
                    strokeWidth={1.6}
                  />
                  <span>Refresh Orders</span>
                </button>
              </div>

              {/* Status Filters */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {ALL_STATUS_FILTERS.map((item) => {
                  const active = statusFilter === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStatusFilter(item.value)}
                      className={`min-h-[38px] shrink-0 rounded-full px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#302923] text-[#F6F1E8]'
                          : 'border border-[#E4D8C5] bg-[#F6F1E8] text-[#665B51] hover:text-[#302923]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/60 p-10 text-center">
                  <p className="font-serif text-xl font-medium text-[#302923]">
                    No orders in this view
                  </p>
                  <p className="mt-1 text-xs text-[#665B51]">
                    New customer order requests submitted at checkout will appear here immediately.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  {/* Order List */}
                  <div className="space-y-3 xl:col-span-5">
                    {filteredOrders.map((order) => {
                      const active = selectedOrder?.id === order.id;
                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className={`w-full rounded-xl border p-4 text-left transition-colors ${
                            active
                              ? 'border-[#302923] bg-[#EFE7DA]'
                              : 'border-[#E4D8C5] bg-[#F6F1E8]/70 hover:border-[#B59972]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#302923] tabular-nums">
                              {order.orderReference}
                            </span>
                            <span className="font-medium text-[#8C6D46]">
                              {ORDER_STATUS_LABELS[order.status]}
                            </span>
                          </div>
                          <p className="mt-1 font-serif text-lg font-medium text-[#302923]">
                            {order.customer.fullName}
                          </p>
                          <p className="text-xs text-[#665B51]">
                            {order.customer.city}, {order.customer.country}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-xs text-[#665B51]">
                            <span>
                              {order.items.reduce((sum, i) => sum + i.quantity, 0)} piece(s)
                            </span>
                            <span className="font-semibold text-[#302923] tabular-nums">
                              Subtotal {formatPrice(order.subtotalUsd, 'USD')}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Order Detail & Review Panel */}
                  {selectedOrder && (
                    <div className="space-y-5 rounded-2xl border border-[#D8C3A5] bg-[#F6F1E8]/60 p-5 sm:p-6 xl:col-span-7">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4D8C5] pb-4">
                        <div>
                          <p className="text-xs text-[#665B51] tabular-nums">
                            {selectedOrder.orderReference} ·{' '}
                            {formatOrderDate(selectedOrder.createdAt)}
                          </p>
                          <h3 className="mt-1 font-serif text-2xl font-medium text-[#302923]">
                            {ORDER_STATUS_LABELS[selectedOrder.status]}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#665B51]">
                            Payment:{' '}
                            <strong className="text-[#302923]">
                              {PAYMENT_STATUS_LABELS[selectedOrder.paymentStatus]}
                            </strong>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setReceiptOrder(selectedOrder)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-1.5 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                        >
                          <Printer className="h-3.5 w-3.5" strokeWidth={1.6} />
                          <span>
                            {selectedOrder.status === 'PENDING_REVIEW'
                              ? 'Order Request Summary'
                              : 'Confirmed Receipt'}
                          </span>
                        </button>
                      </div>

                      {/* Customer & Delivery Details */}
                      <div className="rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] p-4 text-xs leading-relaxed">
                        <p className="font-semibold tracking-wider text-[#8C6D46] uppercase">
                          Customer &amp; Address Details
                        </p>
                        <div className="mt-2 space-y-1 text-[#302923]">
                          <p>
                            <span className="text-[#665B51]">Customer: </span>
                            <strong>{selectedOrder.customer.fullName}</strong>
                          </p>
                          <p>
                            <span className="text-[#665B51]">Phone: </span>
                            {selectedOrder.customer.phone}
                          </p>
                          <p>
                            <span className="text-[#665B51]">Country &amp; City: </span>
                            {selectedOrder.customer.city}, {selectedOrder.customer.country}
                          </p>
                          <p>
                            <span className="text-[#665B51]">Area / Neighborhood: </span>
                            {selectedOrder.customer.area}
                          </p>
                          <p>
                            <span className="text-[#665B51]">Complete Address: </span>
                            {selectedOrder.customer.deliveryAddress}
                          </p>
                          {selectedOrder.customer.deliveryInstructions && (
                            <p>
                              <span className="text-[#665B51]">Instructions: </span>
                              {selectedOrder.customer.deliveryInstructions}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Ordered Products */}
                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                          Ordered Pieces
                        </p>
                        <ul className="divide-y divide-[#E4D8C5] rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-4">
                          {selectedOrder.items.map((item, idx) => (
                            <li
                              key={`${selectedOrder.id}-item-${idx}`}
                              className="flex items-center gap-3 py-3"
                            >
                              <div className="aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg bg-[#EFE7DA]">
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
                                  Size {item.size} · {item.colorName} · Qty {item.quantity} ×{' '}
                                  {formatPrice(item.unitPriceUsd, 'USD')}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-[#302923] tabular-nums">
                                {formatPrice(item.lineTotalUsd, 'USD')}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {orderActionError && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs text-[#302923]"
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                          <span>{orderActionError}</span>
                        </div>
                      )}

                      {/* Owner Review Form for Pending Orders */}
                      {selectedOrder.status === 'PENDING_REVIEW' ? (
                        <form
                          onSubmit={handleAcceptOrder}
                          className="space-y-4 rounded-xl border border-[#D8C3A5] bg-[#FCF9F4] p-4 sm:p-5"
                        >
                          <p className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                            Confirm Delivery Fee &amp; Accept Order
                          </p>

                          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="owner-delivery-fee"
                                className="mb-1.5 block text-xs font-medium text-[#302923]"
                              >
                                Delivery Fee (USD) <span className="text-[#8C6D46]">*</span>
                              </label>
                              <input
                                id="owner-delivery-fee"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                placeholder="e.g. 25"
                                value={deliveryFeeInput}
                                onChange={(e) => setDeliveryFeeInput(e.target.value)}
                                className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] tabular-nums focus:border-[#B59972] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="owner-est-delivery"
                                className="mb-1.5 block text-xs font-medium text-[#302923]"
                              >
                                Estimated Delivery Time <span className="text-[#8C6D46]">*</span>
                              </label>
                              <input
                                id="owner-est-delivery"
                                type="text"
                                required
                                placeholder="e.g. 2–4 business days"
                                value={estimatedDeliveryInput}
                                onChange={(e) => setEstimatedDeliveryInput(e.target.value)}
                                className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label
                                htmlFor="owner-message"
                                className="mb-1.5 block text-xs font-medium text-[#302923]"
                              >
                                Message to Customer (Optional)
                              </label>
                              <textarea
                                id="owner-message"
                                rows={2}
                                placeholder="Add delivery notes, courier instructions, or payment guidance"
                                value={ownerMessageInput}
                                onChange={(e) => setOwnerMessageInput(e.target.value)}
                                className="w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Automatic Final Total Calculation */}
                          <dl className="space-y-1.5 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-sm">
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Product Subtotal</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {formatPrice(selectedOrder.subtotalUsd, 'USD')}
                              </dd>
                            </div>
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Delivery Fee</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {hasValidFee ? formatPrice(parsedFeeUsd, 'USD') : '—'}
                              </dd>
                            </div>
                            <div className="flex justify-between border-t border-[#E4D8C5] pt-2 text-base font-semibold text-[#302923]">
                              <dt>Final Total</dt>
                              <dd className="tabular-nums">
                                {computedFinalTotalUsd !== null
                                  ? formatPrice(computedFinalTotalUsd, 'USD')
                                  : 'Enter delivery fee'}
                              </dd>
                            </div>
                          </dl>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="submit"
                              disabled={isProcessingOrderAction || !hasValidFee}
                              className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-[#302923] px-6 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35] disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-4 w-4" strokeWidth={1.6} />
                              <span>
                                {isProcessingOrderAction ? 'Confirming...' : 'Accept Order'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingOrderAction}
                              onClick={() => void handleUpdateStatus('CANCELLED')}
                              className="min-h-[46px] rounded-full border border-[#D8C3A5] px-5 py-2.5 text-xs font-medium text-[#665B51] hover:bg-[#EFE7DA] hover:text-[#302923]"
                            >
                              Decline / Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        /* Confirmed & Post-Confirmation Order Management */
                        <div className="space-y-4 rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] p-4 sm:p-5">
                          <dl className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Product Subtotal</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {formatPrice(selectedOrder.subtotalUsd, 'USD')}
                              </dd>
                            </div>
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Confirmed Delivery Fee</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {selectedOrder.deliveryFeeUsd !== null
                                  ? formatPrice(selectedOrder.deliveryFeeUsd, 'USD')
                                  : '—'}
                              </dd>
                            </div>
                            <div className="flex justify-between border-t border-[#E4D8C5] pt-2 text-base font-semibold text-[#302923]">
                              <dt>Confirmed Final Total</dt>
                              <dd className="tabular-nums">
                                {selectedOrder.finalTotalUsd !== null
                                  ? formatPrice(selectedOrder.finalTotalUsd, 'USD')
                                  : '—'}
                              </dd>
                            </div>
                          </dl>

                          <div className="border-t border-[#E4D8C5] pt-4">
                            <p className="mb-2 text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                              Update Fulfillment Status
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {FULFILLMENT_STATUS_OPTIONS.map((statusOption) => {
                                const isCurrent = selectedOrder.status === statusOption;
                                return (
                                  <button
                                    key={statusOption}
                                    type="button"
                                    disabled={isProcessingOrderAction || isCurrent}
                                    onClick={() => void handleUpdateStatus(statusOption)}
                                    className={`min-h-[38px] rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                      isCurrent
                                        ? 'bg-[#302923] text-[#F6F1E8]'
                                        : 'border border-[#D8C3A5] bg-[#F6F1E8] text-[#302923] hover:bg-[#EFE7DA]'
                                    }`}
                                  >
                                    {ORDER_STATUS_LABELS[statusOption]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-t border-[#E4D8C5] pt-4">
                            <p className="mb-2 text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                              Payment Status (Separate from Order Status)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {PAYMENT_STATUS_OPTIONS.map((payOption) => {
                                const isCurrent = selectedOrder.paymentStatus === payOption;
                                return (
                                  <button
                                    key={payOption}
                                    type="button"
                                    disabled={isProcessingOrderAction || isCurrent}
                                    onClick={() => void handleUpdatePayment(payOption)}
                                    className={`min-h-[38px] rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                      isCurrent
                                        ? 'bg-[#8C6D46] text-[#F6F1E8]'
                                        : 'border border-[#D8C3A5] bg-[#F6F1E8] text-[#302923] hover:bg-[#EFE7DA]'
                                    }`}
                                  >
                                    {PAYMENT_STATUS_LABELS[payOption]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSection === 'store_settings' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-2xl font-medium text-[#302923]">Store Settings</h2>
                <p className="mt-1 text-xs text-[#665B51]">
                  Single-boutique configuration. Delivery fees are confirmed individually per order
                  request.
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <p>
                  <strong>Boutique Name:</strong> {storeSettings.boutiqueName}
                </p>
                <p>
                  <strong>Default Currency:</strong> {storeSettings.defaultCurrency}
                </p>
                <p>
                  <strong>Supported Display Currencies:</strong>{' '}
                  {storeSettings.supportedCurrencies.join(', ')}
                </p>
              </div>
            </div>
          )}

          {activeSection !== 'overview' &&
            activeSection !== 'orders' &&
            activeSection !== 'store_settings' && (
              <div>
                <h2 className="font-serif text-2xl font-medium text-[#302923]">
                  {OWNER_NAV_ITEMS.find((i) => i.id === activeSection)?.label}
                </h2>
                <p className="mt-2 text-sm text-[#665B51]">
                  This management section is ready to connect to your extended boutique database
                  tables.
                </p>
              </div>
            )}
        </main>
      </div>

      {receiptOrder && (
        <PrintableReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
};
