import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';

type OwnerAction = 'accept' | 'update_status' | 'update_payment_status';

interface OwnerProcessBody {
  action?: OwnerAction;
  orderId?: string;
  deliveryFeeUsd?: number;
  estimatedDeliveryTime?: string;
  ownerMessage?: string;
  orderStatus?:
    | 'PENDING_REVIEW'
    | 'CONFIRMED'
    | 'PROCESSING'
    | 'READY_FOR_DISPATCH'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED';
  paymentStatus?: 'UNPAID' | 'PAYMENT_PENDING' | 'PAID' | 'REFUNDED';
}

const VALID_STATUSES = new Set([
  'PENDING_REVIEW',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

const VALID_PAYMENT_STATUSES = new Set([
  'UNPAID',
  'PAYMENT_PENDING',
  'PAID',
  'REFUNDED',
]);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const userClient = createUserClient(req);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const admin = createAdminClient();
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (!roleRow) {
      return jsonResponse({ error: 'Forbidden: boutique owner role required.' }, 403);
    }

    const body = (await req.json()) as OwnerProcessBody;
    const orderId = String(body.orderId ?? '').trim();
    if (!orderId) {
      return jsonResponse({ error: 'orderId is required.' }, 400);
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return jsonResponse({ error: 'Order not found.' }, 404);
    }

    if (body.action === 'accept') {
      const fee = Number(body.deliveryFeeUsd);
      if (!Number.isFinite(fee) || fee < 0) {
        return jsonResponse({ error: 'A non-negative deliveryFeeUsd is required.' }, 400);
      }

      const normalizedFee = Number(fee.toFixed(2));
      const finalTotal = Number((Number(order.subtotal_usd) + normalizedFee).toFixed(2));
      const estimatedDeliveryTime = body.estimatedDeliveryTime?.trim() || order.estimated_delivery_time;
      const ownerMessage = body.ownerMessage?.trim() || order.owner_message;

      const { data: updated, error: updateError } = await admin
        .from('orders')
        .update({
          order_status: 'CONFIRMED',
          delivery_fee_usd: normalizedFee,
          final_total_usd: finalTotal,
          estimated_delivery_time: estimatedDeliveryTime,
          owner_message: ownerMessage,
          confirmed_at: order.confirmed_at ?? new Date().toISOString(),
        })
        .eq('id', order.id)
        .select('*')
        .single();

      if (updateError || !updated) {
        return jsonResponse({ error: 'Unable to confirm order.' }, 500);
      }

      await admin.from('notifications').insert({
        user_id: order.user_id,
        target_role: 'customer',
        order_id: order.id,
        order_reference: order.order_reference,
        type: 'order_update',
        type_label: 'Order Update',
        title: `Order Confirmed — ${order.order_reference}`,
        message:
          ownerMessage ||
          'VEY RASHA has accepted your order and confirmed your delivery fee and final order total.',
        is_read: false,
        action_route: 'account',
        confirmed_delivery_fee_usd: normalizedFee,
        confirmed_final_total_usd: finalTotal,
        estimated_delivery_time: estimatedDeliveryTime,
        currency_code: order.currency_at_order,
      });

      return jsonResponse({ order: updated });
    }

    if (body.action === 'update_status') {
      if (!body.orderStatus || !VALID_STATUSES.has(body.orderStatus)) {
        return jsonResponse({ error: 'Invalid orderStatus.' }, 400);
      }

      const ownerMessage = body.ownerMessage?.trim() ?? order.owner_message;
      const estimatedDeliveryTime =
        body.estimatedDeliveryTime?.trim() ?? order.estimated_delivery_time;

      const { data: updated, error: updateError } = await admin
        .from('orders')
        .update({
          order_status: body.orderStatus,
          owner_message: ownerMessage,
          estimated_delivery_time: estimatedDeliveryTime,
          confirmed_at:
            body.orderStatus !== 'PENDING_REVIEW' &&
            body.orderStatus !== 'CANCELLED' &&
            !order.confirmed_at
              ? new Date().toISOString()
              : order.confirmed_at,
        })
        .eq('id', order.id)
        .select('*')
        .single();

      if (updateError || !updated) {
        return jsonResponse({ error: 'Unable to update order status.' }, 500);
      }

      const isDeliveryMilestone =
        body.orderStatus === 'READY_FOR_DISPATCH' ||
        body.orderStatus === 'SHIPPED' ||
        body.orderStatus === 'DELIVERED';

      await admin.from('notifications').insert({
        user_id: order.user_id,
        target_role: 'customer',
        order_id: order.id,
        order_reference: order.order_reference,
        type: isDeliveryMilestone ? 'delivery_update' : 'order_update',
        type_label: isDeliveryMilestone ? 'Delivery Update' : 'Order Update',
        title: `Order ${body.orderStatus.replace(/_/g, ' ')} — ${order.order_reference}`,
        message:
          ownerMessage ||
          `Your order status has been updated to ${body.orderStatus.replace(/_/g, ' ').toLowerCase()}.`,
        is_read: false,
        action_route: 'account',
        confirmed_delivery_fee_usd: updated.delivery_fee_usd,
        confirmed_final_total_usd: updated.final_total_usd,
        estimated_delivery_time: updated.estimated_delivery_time,
        currency_code: order.currency_at_order,
      });

      return jsonResponse({ order: updated });
    }

    if (body.action === 'update_payment_status') {
      if (!body.paymentStatus || !VALID_PAYMENT_STATUSES.has(body.paymentStatus)) {
        return jsonResponse({ error: 'Invalid paymentStatus.' }, 400);
      }

      const { data: updated, error: updateError } = await admin
        .from('orders')
        .update({ payment_status: body.paymentStatus })
        .eq('id', order.id)
        .select('*')
        .single();

      if (updateError || !updated) {
        return jsonResponse({ error: 'Unable to update payment status.' }, 500);
      }

      return jsonResponse({ order: updated });
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400);
  } catch (err) {
    console.error('owner-process-order error:', err);
    return jsonResponse({ error: 'Unexpected error while processing order.' }, 500);
  }
});
