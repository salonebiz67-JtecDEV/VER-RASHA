import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Package,
  RefreshCw,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import type { NotificationType } from '../../types/boutique';
import { formatPrice } from '../../utils/formatCurrency';
import { formatOrderDate } from '../../utils/orderStatus';

type NotificationFilter = 'all' | NotificationType;

const FILTER_TABS: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'order_update', label: 'Order Updates' },
  { id: 'delivery_update', label: 'Delivery Updates' },
  { id: 'boutique_announcement', label: 'Boutique Announcements' },
];

export const NotificationsView: React.FC = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    unreadNotificationCount,
    isLoadingNotifications,
    notificationsError,
    refreshNotifications,
    browserNotificationPermission,
    requestBrowserNotifications,
    navigate,
    backendStatus,
    backendErrorMessage,
    checkBackendHealth,
  } = useBoutique();

  const [filter, setFilter] = useState<NotificationFilter>('all');

  const filtered =
    filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'order_update':
        return Package;
      case 'delivery_update':
        return Truck;
      case 'boutique_announcement':
      default:
        return Sparkles;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-20 sm:px-6 md:pt-10 md:pb-14">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E4D8C5] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
            Updates &amp; Alerts
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-serif text-3xl font-medium text-[#302923] sm:text-4xl">
              Notifications
            </h1>
            {unreadNotificationCount > 0 && (
              <span className="rounded-full bg-[#302923] px-2.5 py-0.5 text-xs font-medium text-[#F6F1E8] tabular-nums">
                {unreadNotificationCount} unread
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshNotifications()}
            aria-label="Refresh notifications"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#E4D8C5] bg-[#FCF9F4] px-4 py-2 text-xs font-medium text-[#665B51] transition-colors hover:border-[#B59972] hover:text-[#302923]"
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
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
            >
              <CheckCheck className="h-4 w-4" strokeWidth={1.6} />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {backendStatus === 'unavailable' && (
        <div
          role="status"
          className="mt-5 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#D8C3A5] bg-[#EFE7DA] px-5 py-4 text-xs text-[#302923] sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
            <span>
              {backendErrorMessage ??
                'Unable to reach the boutique notification server. Reconnect to load live updates.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void checkBackendHealth().then((ok) => {
                if (ok) void refreshNotifications();
              });
            }}
            className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-[#302923]/30 bg-[#FCF9F4] px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[#302923] uppercase hover:bg-[#F6F1E8]"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Optional User-Initiated Browser Push Notification Opt-In */}
      {browserNotificationPermission === 'default' && (
        <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] px-5 py-4 sm:flex-row sm:items-center">
          <div className="text-xs leading-relaxed text-[#665B51]">
            <p className="font-semibold text-[#302923]">Enable Live Order Alerts</p>
            <p>
              Receive an immediate notification when VEY RASHA confirms your delivery fee and
              accepts your order.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void requestBrowserNotifications()}
            className="min-h-[40px] shrink-0 rounded-full bg-[#302923] px-5 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
          >
            Allow Notifications
          </button>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        role="tablist"
        aria-label="Notification Categories"
      >
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={`min-h-[44px] shrink-0 rounded-full px-5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#302923] text-[#F6F1E8]'
                  : 'border border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:border-[#B59972] hover:text-[#302923]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {isLoadingNotifications && (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-2xl border border-[#E4D8C5] bg-[#EFE7DA]/70"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoadingNotifications && notificationsError && (
        <div
          role="alert"
          className="mt-8 flex flex-col items-center rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] px-6 py-12 text-center"
        >
          <AlertCircle className="h-7 w-7 text-[#8C6D46]" strokeWidth={1.5} />
          <h2 className="mt-3 font-serif text-xl font-medium text-[#302923]">
            Unable to Load Notifications
          </h2>
          <p className="mt-1 max-w-md text-sm text-[#665B51]">{notificationsError}</p>
          <button
            type="button"
            onClick={() => void refreshNotifications()}
            className="mt-5 min-h-[44px] rounded-full bg-[#302923] px-6 py-2.5 text-xs font-medium text-[#F6F1E8]"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingNotifications && !notificationsError && filtered.length === 0 && (
        <div className="mt-8 rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE7DA] text-[#8C6D46]">
            <Bell className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-medium text-[#302923]">
            You are all caught up
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#665B51]">
            Real-time order confirmations, confirmed delivery fees, shipment updates, and boutique
            announcements will appear here automatically.
          </p>

          <div className="mx-auto mt-7 grid max-w-lg grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-3.5">
              <Package className="h-4 w-4 text-[#8C6D46]" strokeWidth={1.6} />
              <p className="mt-2 text-xs font-semibold text-[#302923]">Order Updates</p>
              <p className="mt-0.5 text-[11px] text-[#665B51]">
                Confirmed fees &amp; order acceptance
              </p>
            </div>
            <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-3.5">
              <Truck className="h-4 w-4 text-[#8C6D46]" strokeWidth={1.6} />
              <p className="mt-2 text-xs font-semibold text-[#302923]">Delivery Updates</p>
              <p className="mt-0.5 text-[11px] text-[#665B51]">
                Dispatch &amp; arrival milestones
              </p>
            </div>
            <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-3.5">
              <Sparkles className="h-4 w-4 text-[#8C6D46]" strokeWidth={1.6} />
              <p className="mt-2 text-xs font-semibold text-[#302923]">Announcements</p>
              <p className="mt-0.5 text-[11px] text-[#665B51]">
                Seasonal releases &amp; salon news
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('explore')}
              className="min-h-[44px] rounded-full bg-[#302923] px-6 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
            >
              Explore Boutique
            </button>
            <button
              type="button"
              onClick={() => navigate('account')}
              className="min-h-[44px] rounded-full border border-[#D8C3A5] px-6 py-2.5 text-xs font-medium tracking-wider text-[#302923] uppercase hover:bg-[#EFE7DA]"
            >
              View Orders
            </button>
          </div>
        </div>
      )}

      {/* Notification List */}
      {!isLoadingNotifications && !notificationsError && filtered.length > 0 && (
        <div className="mt-6 space-y-3">
          {filtered.map((item) => {
            const Icon = getNotificationIcon(item.type);
            const hasConfirmedBreakdown =
              typeof item.confirmedDeliveryFeeUsd === 'number' ||
              typeof item.confirmedFinalTotalUsd === 'number';
            const displayCurrency = item.currency ?? 'USD';

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-5 transition-colors ${
                  item.read
                    ? 'border-[#E4D8C5] bg-[#FCF9F4]/65'
                    : 'border-[#B59972] bg-[#FCF9F4]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      item.read
                        ? 'bg-[#EFE7DA]/70 text-[#665B51]'
                        : 'bg-[#302923] text-[#F6F1E8]'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium tracking-wide text-[#8C6D46] uppercase">
                        {item.typeLabel}
                      </span>
                      <div className="flex items-center gap-2 text-[#665B51]">
                        <span>{formatOrderDate(item.timestamp)}</span>
                        {!item.read && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#302923]">
                            <span
                              className="h-2 w-2 rounded-full bg-[#8C6D46]"
                              aria-hidden="true"
                            />
                            <span>Unread</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="mt-1 font-serif text-xl font-medium text-[#302923]">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#665B51]">{item.message}</p>

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
                      {item.actionRoute && (
                        <button
                          type="button"
                          onClick={() => {
                            markNotificationRead(item.id);
                            navigate(item.actionRoute!);
                          }}
                          className="min-h-[38px] rounded-full bg-[#302923] px-4 py-1.5 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
                        >
                          View Order &amp; Receipt
                        </button>
                      )}
                      {!item.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(item.id)}
                          className="min-h-[38px] rounded-full border border-[#D8C3A5] px-4 py-1.5 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
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
