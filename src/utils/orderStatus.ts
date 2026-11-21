import type { OrderStatus, PaymentStatus } from '../types/boutique';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_REVIEW: 'Pending Review',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Awaiting Payment',
  PAYMENT_PENDING: 'Payment Pending',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
};

export const ORDER_TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING_REVIEW', label: 'Pending Review' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'READY_FOR_DISPATCH', label: 'Ready' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
];

export function getOrderTimelineIndex(status: OrderStatus): number {
  const idx = ORDER_TIMELINE_STEPS.findIndex((s) => s.status === status);
  return idx;
}

export function isOrderConfirmedOrLater(status: OrderStatus): boolean {
  return (
    status === 'CONFIRMED' ||
    status === 'PROCESSING' ||
    status === 'READY_FOR_DISPATCH' ||
    status === 'SHIPPED' ||
    status === 'DELIVERED'
  );
}

export function formatOrderDate(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
