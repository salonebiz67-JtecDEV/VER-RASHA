import { supabase, SUPABASE_CONFIG_WARNING } from '../lib/supabase';

const wishlistInFlightByUser = new Map<string, Promise<string>>();

async function resolveOrCreateWishlistId(userId: string): Promise<string> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  const { data: existing, error: selectError } = await supabase
    .from('wishlists')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message || 'Unable to read wishlist.');
  }

  if (existing?.id) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('wishlists')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: conflictExisting, error: conflictSelectError } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (conflictSelectError || !conflictExisting?.id) {
        throw new Error(conflictSelectError?.message || 'Unable to read wishlist.');
      }

      return conflictExisting.id;
    }

    throw new Error(insertError.message || 'Unable to initialize wishlist.');
  }

  if (!created?.id) {
    throw new Error('Unable to initialize wishlist.');
  }

  return created.id;
}

async function getOrCreateWishlistId(userId: string): Promise<string> {
  const existingRequest = wishlistInFlightByUser.get(userId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = resolveOrCreateWishlistId(userId).finally(() => {
    if (wishlistInFlightByUser.get(userId) === request) {
      wishlistInFlightByUser.delete(userId);
    }
  });

  wishlistInFlightByUser.set(userId, request);
  return request;
}

export async function fetchWishlistProductIds(userId: string): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('product_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Unable to load saved wishlist items.');
  }

  return (data ?? []).map((row: { product_id: string }) => row.product_id);
}

export async function toggleWishlistProduct(
  userId: string,
  productId: string,
  currentlySaved: boolean
): Promise<boolean> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  if (currentlySaved) {
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      throw new Error(error.message || 'Unable to remove wishlist piece.');
    }
    return false;
  }

  const wishlistId = await getOrCreateWishlistId(userId);
  const { error } = await supabase
    .from('wishlist_items')
    .upsert(
      {
        wishlist_id: wishlistId,
        user_id: userId,
        product_id: productId,
      },
      { onConflict: 'wishlist_id,product_id' }
    );

  if (error) {
    throw new Error(error.message || 'Unable to save piece to wishlist.');
  }
  return true;
}
