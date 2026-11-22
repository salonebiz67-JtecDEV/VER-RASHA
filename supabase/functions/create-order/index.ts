import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';

interface OrderItemInput {
  productId: string;
  size: string;
  colorName: string;
  quantity: number;
}

interface OrderCustomerInput {
  fullName: string;
  phone: string;
  country: string;
  city: string;
  area: string;
  deliveryAddress: string;
  deliveryInstructions?: string;
}

interface CreateOrderBody {
  customer?: OrderCustomerInput;
  items?: OrderItemInput[];
  giftPresentation?: boolean;
  currency?: string;
}

const VALID_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AED', 'NGN']);

function generateOrderReference(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `VR-${y}${m}${d}-${hex}`;
}

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
      return jsonResponse({ error: 'Please sign in with Google before placing an order.' }, 401);
    }

    const body = (await req.json()) as CreateOrderBody;
    const customer = body.customer;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customer) {
      return jsonResponse({ error: 'Customer delivery details are required.' }, 400);
    }

    const fullName = String(customer.fullName ?? '').trim();
    const phone = String(customer.phone ?? '').trim();
    const country = String(customer.country ?? '').trim();
    const city = String(customer.city ?? '').trim();
    const area = String(customer.area ?? '').trim();
    const deliveryAddress = String(customer.deliveryAddress ?? '').trim();
    const deliveryInstructions = customer.deliveryInstructions
      ? String(customer.deliveryInstructions).trim()
      : null;

    if (!fullName || phone.replace(/\D/g, '').length < 6) {
      return jsonResponse({ error: 'Valid full name and phone number are required.' }, 400);
    }
    if (!country || !city || !area || !deliveryAddress) {
      return jsonResponse(
        { error: 'Country, city, area/neighborhood, and complete delivery address are required.' },
        400
      );
    }
    if (items.length === 0 || items.length > 50) {
      return jsonResponse({ error: 'Your order must include between 1 and 50 line items.' }, 400);
    }

    const requestedCurrency = String(body.currency ?? 'USD').toUpperCase();
    const currencyAtOrder = VALID_CURRENCIES.has(requestedCurrency) ? requestedCurrency : 'USD';

    const admin = createAdminClient();
    const productIds = Array.from(new Set(items.map((item) => String(item.productId))));

    const { data: dbProducts, error: productsError } = await admin
      .from('products')
      .select(
        `
        id,
        name,
        subtitle,
        price_usd,
        is_published,
        product_images (
          storage_path,
          is_primary,
          sort_order
        ),
        product_variants (
          id,
          size,
          color_name,
          color_hex,
          price_override_usd,
          stock_count,
          is_available
        )
      `
      )
      .in('id', productIds)
      .eq('is_published', true);

    if (productsError) {
      return jsonResponse({ error: 'Unable to validate boutique inventory.' }, 500);
    }

    const productMap = new Map((dbProducts ?? []).map((p) => [p.id, p]));
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');

    let subtotalUsd = 0;
    const preparedOrderItems: {
      product_id: string;
      variant_id: string | null;
      product_name_snapshot: string;
      subtitle_snapshot: string | null;
      size_snapshot: string;
      color_name_snapshot: string;
      color_hex_snapshot: string | null;
      image_url_snapshot: string;
      quantity: number;
      unit_price_usd: number;
      line_total_usd: number;
      currency_code: string;
    }[] = [];

    for (const rawItem of items) {
      const qty = Math.floor(Number(rawItem.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
        return jsonResponse({ error: 'Each item quantity must be between 1 and 20.' }, 400);
      }

      const product = productMap.get(String(rawItem.productId));
      if (!product) {
        return jsonResponse(
          { error: 'One or more selected pieces are no longer available.' },
          400
        );
      }

      const variants = Array.isArray(product.product_variants) ? product.product_variants : [];
      const matchingVariant = variants.find(
        (v: { size: string; color_name: string }) =>
          v.size === rawItem.size && v.color_name === rawItem.colorName
      );

      if (variants.length > 0) {
        if (!matchingVariant || !matchingVariant.is_available || matchingVariant.stock_count < qty) {
          return jsonResponse(
            {
              error: `${product.name} (${rawItem.size} · ${rawItem.colorName}) is unavailable in the requested quantity.`,
            },
            400
          );
        }
      }

      const unitPriceUsd = Number(
        matchingVariant?.price_override_usd ?? product.price_usd
      );
      const lineTotalUsd = Number((unitPriceUsd * qty).toFixed(2));
      subtotalUsd = Number((subtotalUsd + lineTotalUsd).toFixed(2));

      const images = Array.isArray(product.product_images) ? [...product.product_images] : [];
      images.sort(
        (
          a: { is_primary: boolean; sort_order: number },
          b: { is_primary: boolean; sort_order: number }
        ) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
      );
      const primaryPath = images[0]?.storage_path ?? '';
      const imageUrl =
        primaryPath.startsWith('http://') || primaryPath.startsWith('https://')
          ? primaryPath
          : primaryPath && supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/boutique-media/${primaryPath.replace(/^\/+/, '')}`
          : '';

      preparedOrderItems.push({
        product_id: product.id,
        variant_id: matchingVariant?.id ?? null,
        product_name_snapshot: product.name,
        subtitle_snapshot: product.subtitle || null,
        size_snapshot: String(rawItem.size || 'One Size'),
        color_name_snapshot: String(rawItem.colorName || 'Signature'),
        color_hex_snapshot: matchingVariant?.color_hex ?? null,
        image_url_snapshot: imageUrl,
        quantity: qty,
        unit_price_usd: unitPriceUsd,
        line_total_usd: lineTotalUsd,
        currency_code: currencyAtOrder,
      });
    }

    const orderReference = generateOrderReference();

    const { data: createdOrder, error: orderInsertError } = await admin
      .from('orders')
      .insert({
        order_reference: orderReference,
        user_id: user.id,
        order_status: 'PENDING_REVIEW',
        payment_status: 'UNPAID',
        customer_full_name: fullName,
        customer_phone: phone,
        customer_country: country,
        customer_city: city,
        customer_area: area,
        customer_delivery_address: deliveryAddress,
        customer_delivery_instructions: deliveryInstructions,
        currency_at_order: currencyAtOrder,
        gift_presentation: Boolean(body.giftPresentation),
        subtotal_usd: subtotalUsd,
        delivery_fee_usd: null,
        final_total_usd: null,
      })
      .select('*')
      .single();

    if (orderInsertError || !createdOrder) {
      return jsonResponse({ error: 'Unable to create your order request right now.' }, 500);
    }

    const itemsToInsert = preparedOrderItems.map((item) => ({
      ...item,
      order_id: createdOrder.id,
      user_id: user.id,
    }));

    const { data: createdItems, error: itemsInsertError } = await admin
      .from('order_items')
      .insert(itemsToInsert)
      .select('*');

    if (itemsInsertError) {
      await admin.from('orders').delete().eq('id', createdOrder.id);
      return jsonResponse({ error: 'Unable to record order line items.' }, 500);
    }

    // Clear authenticated user's persisted bag after successful order creation
    const { data: userCart } = await admin
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userCart?.id) {
      await admin.from('cart_items').delete().eq('cart_id', userCart.id);
    }

    // Customer notification
    await admin.from('notifications').insert({
      user_id: user.id,
      target_role: 'customer',
      order_id: createdOrder.id,
      order_reference: createdOrder.order_reference,
      type: 'order_update',
      type_label: 'Order Update',
      title: `Order Request Received — ${createdOrder.order_reference}`,
      message:
        'Thank you for your order request. VEY RASHA is reviewing your delivery destination and will confirm your delivery fee and final total shortly.',
      is_read: false,
      action_route: 'account',
      currency_code: currencyAtOrder,
    });

    // Notify boutique owner(s) inside notifications table
    const { data: owners } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'owner');

    if (Array.isArray(owners) && owners.length > 0) {
      await admin.from('notifications').insert(
        owners.map((ownerRow: { user_id: string }) => ({
          user_id: ownerRow.user_id,
          target_role: 'owner',
          order_id: createdOrder.id,
          order_reference: createdOrder.order_reference,
          type: 'order_update',
          type_label: 'New Order Request',
          title: `New Order Request ${createdOrder.order_reference}`,
          message: `${fullName} (${city}, ${country}) submitted an order request awaiting delivery fee review.`,
          is_read: false,
          currency_code: currencyAtOrder,
        }))
      );
    }

    return jsonResponse(
      {
        status: 'pending_review',
        message:
          'Your order request has been received. Our boutique will review your delivery details and confirm your delivery fee and final total.',
        order: {
          ...createdOrder,
          order_items: createdItems ?? [],
        },
      },
      201
    );
  } catch (err) {
    console.error('create-order error:', err);
    return jsonResponse({ error: 'Unexpected error while submitting order request.' }, 500);
  }
});
