import { supabase, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import type {
  CurrencyCode,
  OrderLineItem,
  OrderRecord,
  OrderRequestPayload,
  OrderStatus,
  OrderSubmissionResult,
  PaymentStatus,
} from '../types/boutique';

interface DbOrderItemRow {
  product_id: string | null;
  product_name_snapshot: string;
  subtitle_snapshot: string | null;
  size_snapshot: string;
  color_name_snapshot: string;
  color_hex_snapshot: string | null;
  image_url_snapshot: string | null;
  quantity: number;
  unit_price_usd: number | string;
  line_total_usd: number | string;
}

export interface DbOrderRow {
  id: string;
  order_reference: string;
  user_id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  customer_full_name: string;
  customer_phone: string;
  customer_country: string;
  customer_city: string;
  customer_area: string;
  customer_delivery_address: string;
  customer_delivery_instructions: string | null;
  currency_at_order: string;
  gift_presentation: boolean;
  subtotal_usd: number | string;
  delivery_fee_usd: number | string | null;
  final_total_usd: number | string | null;
  estimated_delivery_time: string | null;
  owner_message: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: DbOrderItemRow[];
}

export function mapDbOrderRow(row: DbOrderRow): OrderRecord {
  const items: OrderLineItem[] = (row.order_items ?? []).map((item) => ({
    productId: item.product_id ?? '',
    productName: item.product_name_snapshot,
    subtitle: item.subtitle_snapshot ?? undefined,
    size: item.size_snapshot,
    colorName: item.color_name_snapshot,
    colorHex: item.color_hex_snapshot ?? undefined,
    quantity: item.quantity,
    unitPriceUsd: Number(item.unit_price_usd) || 0,
    lineTotalUsd: Number(item.line_total_usd) || 0,
    image: item.image_url_snapshot ?? '',
  }));

  return {
    id: row.id,
    orderReference: row.order_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    status: row.order_status,
    paymentStatus: row.payment_status,
    customer: {
      fullName: row.customer_full_name,
      phone: row.customer_phone,
      country: row.customer_country,
      city: row.customer_city,
      area: row.customer_area,
      deliveryAddress: row.customer_delivery_address,
      deliveryInstructions: row.customer_delivery_instructions ?? undefined,
    },
    items,
    currencyAtOrder: (row.currency_at_order as CurrencyCode) || 'USD',
    giftPresentation: Boolean(row.gift_presentation),
    subtotalUsd: Number(row.subtotal_usd) || 0,
    deliveryFeeUsd: row.delivery_fee_usd !== null ? Number(row.delivery_fee_usd) : null,
    finalTotalUsd: row.final_total_usd !== null ? Number(row.final_total_usd) : null,
    estimatedDeliveryTime: row.estimated_delivery_time,
    ownerMessage: row.owner_message,
  };
}

export async function fetchCustomerOrders(userId: string): Promise<OrderRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      order_items (
        product_id,
        product_name_snapshot,
        subtitle_snapshot,
        size_snapshot,
        color_name_snapshot,
        color_hex_snapshot,
        image_url_snapshot,
        quantity,
        unit_price_usd,
        line_total_usd
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Unable to load your order history.');
  }

  return ((data ?? []) as DbOrderRow[]).map(mapDbOrderRow);
}

export async function fetchCustomerOrderById(
  userId: string,
  orderId: string
): Promise<OrderRecord | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      order_items (
        product_id,
        product_name_snapshot,
        subtitle_snapshot,
        size_snapshot,
        color_name_snapshot,
        color_hex_snapshot,
        image_url_snapshot,
        quantity,
        unit_price_usd,
        line_total_usd
      )
    `
    )
    .eq('user_id', userId)
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) return null;
  return mapDbOrderRow(data as DbOrderRow);
}

async function extractEdgeFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback =
    'Unable to reach the boutique order service. Please verify your connection and sign-in session.';

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const errObj = error as { message?: unknown; context?: unknown };
  const ctx = errObj.context;

  if (ctx && typeof Response !== 'undefined' && ctx instanceof Response) {
    try {
      const cloned = ctx.clone();
      const rawText = await cloned.text();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText) as { error?: unknown; message?: unknown };
          if (typeof parsed.error === 'string' && parsed.error.trim()) {
            return parsed.error.trim();
          }
          if (typeof parsed.message === 'string' && parsed.message.trim()) {
            return parsed.message.trim();
          }
        } catch {
          return rawText.trim();
        }
      }
    } catch (readErr) {
      console.error('Unable to read create-order error response:', readErr);
    }
  } else if (ctx && typeof ctx === 'object' && 'error' in ctx) {
    const ctxError = (ctx as { error?: unknown }).error;
    if (typeof ctxError === 'string' && ctxError.trim()) {
      return ctxError.trim();
    }
  }

  if (typeof errObj.message === 'string' && errObj.message.trim()) {
    return errObj.message.trim();
  }

  return fallback;
}

export async function submitBoutiqueOrder(
  payload: OrderRequestPayload
): Promise<OrderSubmissionResult> {
  if (!supabase) {
    return {
      status: 'error',
      message: SUPABASE_CONFIG_WARNING,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      status?: string;
      message?: string;
      order?: DbOrderRow;
      error?: string;
    }>('create-order', {
      body: {
        customer: {
          fullName: payload.customer.fullName,
          phone: payload.customer.phone,
          country: payload.customer.country,
          city: payload.customer.city,
          area: payload.customer.area,
          deliveryAddress: payload.customer.deliveryAddress,
          ...(payload.customer.deliveryInstructions
            ? { deliveryInstructions: payload.customer.deliveryInstructions }
            : {}),
        },
        items: payload.items.map((item) => ({
          productId: item.productId,
          size: item.size,
          colorName: item.colorName,
          quantity: item.quantity,
        })),
        giftPresentation: Boolean(payload.giftPresentation),
        currency: payload.currency,
      },
    });

    if (error) {
      const realMessage = await extractEdgeFunctionErrorMessage(error);
      console.error('create-order invocation error:', { error, message: realMessage });
      return {
        status: 'error',
        message: realMessage,
      };
    }

    if (!data?.order || data.error) {
      const msg = data?.error || 'Unable to submit your order request.';
      console.error('create-order returned invalid response:', data);
      return {
        status: 'error',
        message: msg,
      };
    }

    return {
      status: 'pending_review',
      message:
        data.message ||
        'Your order request has been received. Our boutique will review your delivery details and confirm your delivery fee and final total.',
      order: mapDbOrderRow(data.order),
    };
  } catch (err) {
    console.error('create-order unexpected failure:', err);
    return {
      status: 'error',
      message:
        err instanceof Error && err.message
          ? err.message
          : 'Unable to reach the boutique order service. Please verify your connection and sign-in session.',
    };
  }
}
