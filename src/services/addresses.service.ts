import { supabase, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import type { SavedAddress } from '../types/boutique';

interface DbAddressRow {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  country: string;
  city: string;
  area: string;
  delivery_address: string;
  delivery_instructions: string | null;
  is_default: boolean;
}

function mapAddressRow(row: DbAddressRow): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    country: row.country,
    city: row.city,
    area: row.area,
    deliveryAddress: row.delivery_address,
    deliveryInstructions: row.delivery_instructions ?? undefined,
    isDefault: Boolean(row.is_default),
  };
}

export async function fetchUserAddresses(userId: string): Promise<SavedAddress[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('addresses')
    .select(
      'id, label, recipient_name, phone, country, city, area, delivery_address, delivery_instructions, is_default'
    )
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Unable to load saved delivery addresses.');
  }

  return ((data ?? []) as DbAddressRow[]).map(mapAddressRow);
}

export async function createUserAddress(
  userId: string,
  address: Omit<SavedAddress, 'id'>
): Promise<SavedAddress> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  if (address.isDefault) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      label: address.label.trim(),
      recipient_name: address.recipientName.trim(),
      phone: address.phone.trim(),
      country: address.country.trim(),
      city: address.city.trim(),
      area: address.area.trim(),
      delivery_address: address.deliveryAddress.trim(),
      delivery_instructions: address.deliveryInstructions?.trim() || null,
      is_default: address.isDefault,
    })
    .select(
      'id, label, recipient_name, phone, country, city, area, delivery_address, delivery_instructions, is_default'
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Unable to save delivery address.');
  }

  return mapAddressRow(data as DbAddressRow);
}

export async function updateUserAddress(
  userId: string,
  addressId: string,
  patch: Omit<SavedAddress, 'id'>
): Promise<SavedAddress> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  if (patch.isDefault) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
  }

  const { data, error } = await supabase
    .from('addresses')
    .update({
      label: patch.label.trim(),
      recipient_name: patch.recipientName.trim(),
      phone: patch.phone.trim(),
      country: patch.country.trim(),
      city: patch.city.trim(),
      area: patch.area.trim(),
      delivery_address: patch.deliveryAddress.trim(),
      delivery_instructions: patch.deliveryInstructions?.trim() || null,
      is_default: patch.isDefault,
    })
    .eq('id', addressId)
    .eq('user_id', userId)
    .select(
      'id, label, recipient_name, phone, country, city, area, delivery_address, delivery_instructions, is_default'
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Unable to update delivery address.');
  }

  return mapAddressRow(data as DbAddressRow);
}

export async function deleteUserAddress(userId: string, addressId: string): Promise<void> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Unable to delete delivery address.');
  }
}

export async function setDefaultUserAddress(userId: string, addressId: string): Promise<void> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_WARNING);

  await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);

  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Unable to update default delivery address.');
  }
}
