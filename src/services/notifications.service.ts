import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  AppRoute,
  CurrencyCode,
  NotificationItem,
  NotificationType,
  OrderRecord,
} from '../types/boutique';
import { fetchCustomerOrderById } from './orders.service';

export interface DbNotificationRow {
  id: string;
  user_id: string | null;
  target_role: 'customer' | 'owner';
  order_id: string | null;
  order_reference: string | null;
  type: NotificationType;
  type_label: string;
  title: string;
  message: string;
  is_read: boolean;
  action_route: string | null;
  confirmed_delivery_fee_usd: number | string | null;
  confirmed_final_total_usd: number | string | null;
  estimated_delivery_time: string | null;
  currency_code: string | null;
  created_at: string;
}

export function mapDbNotificationRow(row: DbNotificationRow): NotificationItem {
  return {
    id: row.id,
    orderId: row.order_id ?? undefined,
    orderReference: row.order_reference ?? undefined,
    type: row.type,
    typeLabel: row.type_label,
    title: row.title,
    message: row.message,
    timestamp: row.created_at,
    read: Boolean(row.is_read),
    actionRoute: (row.action_route as AppRoute | null) ?? undefined,
    confirmedDeliveryFeeUsd:
      row.confirmed_delivery_fee_usd !== null ? Number(row.confirmed_delivery_fee_usd) : undefined,
    confirmedFinalTotalUsd:
      row.confirmed_final_total_usd !== null ? Number(row.confirmed_final_total_usd) : undefined,
    estimatedDeliveryTime: row.estimated_delivery_time ?? undefined,
    currency: (row.currency_code as CurrencyCode | null) ?? 'USD',
  };
}

export async function fetchCustomerNotifications(
  userId: string
): Promise<NotificationItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('target_role', 'customer')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message || 'Unable to load notifications.');
  }

  return ((data ?? []) as DbNotificationRow[]).map(mapDbNotificationRow);
}

export async function markCustomerNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .eq('target_role', 'customer');

  if (error) {
    throw new Error(error.message || 'Unable to update notification status.');
  }
}

export async function markAllCustomerNotificationsAsRead(userId: string): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('target_role', 'customer')
    .eq('is_read', false);

  if (error) {
    throw new Error(error.message || 'Unable to mark notifications as read.');
  }
}

export interface CustomerRealtimeCallbacks {
  onNotification: (notification: NotificationItem) => void;
  onOrderUpdated: (order: OrderRecord) => void;
}

export function subscribeCustomerRealtime(
  userId: string,
  callbacks: CustomerRealtimeCallbacks
): () => void {
  const client = supabase;
  if (!client) return () => undefined;

  const channel: RealtimeChannel = client
    .channel(`customer-feed:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const raw = payload.new as DbNotificationRow | undefined;
        if (!raw || raw.target_role !== 'customer') return;
        callbacks.onNotification(mapDbNotificationRow(raw));
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const raw = payload.new as { id?: string } | undefined;
        if (!raw?.id) return;
        void fetchCustomerOrderById(userId, raw.id).then((fullOrder) => {
          if (fullOrder) {
            callbacks.onOrderUpdated(fullOrder);
          }
        });
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
