import { supabase, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import type { CartItem, ColorOption } from '../types/boutique';

interface DbCartItemRow {
  id: string;
  product_id: string;
  selected_size: string;
  selected_color_name: string;
  selected_color_hex: string | null;
  quantity: number;
}

const cartInFlightByUser = new Map<
  string,
  Promise<{ id: string; giftPresentation: boolean }>
>();

async function resolveOrCreateCart(
  userId: string
): Promise<{ id: string; giftPresentation: boolean }> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  const { data: existing, error: selectError } = await supabase
    .from('carts')
    .select('id, gift_presentation')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message || 'Unable to load shopping bag.');
  }

  if (existing?.id) {
    return {
      id: existing.id,
      giftPresentation: Boolean(existing.gift_presentation),
    };
  }

  const { data: created, error: insertError } = await supabase
    .from('carts')
    .insert({ user_id: userId, gift_presentation: false })
    .select('id, gift_presentation')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: conflictExisting, error: conflictSelectError } = await supabase
        .from('carts')
        .select('id, gift_presentation')
        .eq('user_id', userId)
        .maybeSingle();

      if (conflictSelectError || !conflictExisting?.id) {
        throw new Error(conflictSelectError?.message || 'Unable to load shopping bag.');
      }

      return {
        id: conflictExisting.id,
        giftPresentation: Boolean(conflictExisting.gift_presentation),
      };
    }

    throw new Error(insertError.message || 'Unable to create shopping bag.');
  }

  if (!created?.id) {
    throw new Error('Unable to create shopping bag.');
  }

  return {
    id: created.id,
    giftPresentation: Boolean(created.gift_presentation),
  };
}

async function getOrCreateCart(
  userId: string
): Promise<{ id: string; giftPresentation: boolean }> {
  const existingRequest = cartInFlightByUser.get(userId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = resolveOrCreateCart(userId).finally(() => {
    if (cartInFlightByUser.get(userId) === request) {
      cartInFlightByUser.delete(userId);
    }
  });

  cartInFlightByUser.set(userId, request);
  return request;
}

export async function fetchCartState(
  userId: string
): Promise<{ items: CartItem[]; giftPresentation: boolean }> {
  if (!supabase) return { items: [], giftPresentation: false };

  const cart = await getOrCreateCart(userId);
  const { data, error } = await supabase
    .from('cart_items')
    .select(
      'id, product_id, selected_size, selected_color_name, selected_color_hex, quantity'
    )
    .eq('cart_id', cart.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Unable to load items in your shopping bag.');
  }

  const items: CartItem[] = ((data ?? []) as DbCartItemRow[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    selectedSize: row.selected_size,
    selectedColor: {
      name: row.selected_color_name,
      hex: row.selected_color_hex || '#D8C3A5',
    },
    quantity: row.quantity,
  }));

  return {
    items,
    giftPresentation: cart.giftPresentation,
  };
}

export async function upsertCartItem(
  userId: string,
  productId: string,
  size: string,
  color: ColorOption,
  quantityDelta: number,
  maxStock = 20
): Promise<CartItem[]> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  const effectiveMax = Math.max(1, Math.min(20, maxStock));
  const cart = await getOrCreateCart(userId);

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', productId)
    .eq('selected_size', size)
    .eq('selected_color_name', color.name)
    .maybeSingle();

  const nextQty = Math.min(effectiveMax, Math.max(1, (existing?.quantity ?? 0) + quantityDelta));

  const { error } = await supabase.from('cart_items').upsert(
    {
      cart_id: cart.id,
      user_id: userId,
      product_id: productId,
      selected_size: size,
      selected_color_name: color.name,
      selected_color_hex: color.hex,
      quantity: nextQty,
    },
    { onConflict: 'cart_id,product_id,selected_size,selected_color_name' }
  );

  if (error) {
    throw new Error(error.message || 'Unable to add piece to bag.');
  }

  const state = await fetchCartState(userId);
  return state.items;
}

export async function updateCartItemQuantity(
  userId: string,
  cartItemId: string,
  nextQuantity: number,
  maxStock = 20
): Promise<CartItem[]> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  if (nextQuantity <= 0) {
    return removeCartItem(userId, cartItemId);
  }

  const effectiveMax = Math.max(1, Math.min(20, maxStock));
  const clamped = Math.min(effectiveMax, Math.max(1, nextQuantity));
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity: clamped })
    .eq('id', cartItemId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Unable to update bag quantity.');
  }

  const state = await fetchCartState(userId);
  return state.items;
}

export async function removeCartItem(
  userId: string,
  cartItemId: string
): Promise<CartItem[]> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Unable to remove piece from bag.');
  }

  const state = await fetchCartState(userId);
  return state.items;
}

export async function clearUserCart(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('cart_items').delete().eq('user_id', userId);
  if (error) {
    throw new Error(error.message || 'Unable to clear bag.');
  }
}

export async function setCartGiftPresentation(
  userId: string,
  giftPresentation: boolean
): Promise<void> {
  if (!supabase) return;
  const cart = await getOrCreateCart(userId);
  const { error } = await supabase
    .from('carts')
    .update({ gift_presentation: giftPresentation })
    .eq('id', cart.id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Unable to update gift presentation preference.');
  }
}
