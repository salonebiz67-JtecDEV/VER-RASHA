import { DEFAULT_STORE_SETTINGS } from '../data/storeConfig';
import { isSupabaseConfigured, supabase, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import type {
  CategorySlug,
  Collection,
  ColorOption,
  CurrencyCode,
  EditorialCampaign,
  Product,
  StockStatus,
  StoreSettings,
} from '../types/boutique';

export const BOUTIQUE_MEDIA_BUCKET = 'boutique-media';

export interface BoutiqueCategoryItem {
  slug: CategorySlug;
  label: string;
  image?: string;
}

export interface CatalogSnapshot {
  products: Product[];
  categories: BoutiqueCategoryItem[];
  collections: Collection[];
  campaigns: EditorialCampaign[];
  storeSettings: StoreSettings;
  heroImageUrl: string;
}

export function getBoutiqueMediaUrl(storagePath: string | null | undefined): string {
  const trimmed = (storagePath ?? '').trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Allow repo static asset paths if explicitly referenced
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('src/assets/')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  if (!supabase) return trimmed;
  const cleanPath = trimmed.replace(/^\/+/, '');
  const { data } = supabase.storage.from(BOUTIQUE_MEDIA_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}

interface DbProductImageRow {
  storage_path: string;
  sort_order: number | null;
  is_primary: boolean | null;
}

interface DbProductVariantRow {
  id: string;
  size: string;
  color_name: string;
  color_hex: string | null;
  stock_count: number | null;
  is_available: boolean | null;
}

interface DbProductRow {
  id: string;
  name: string;
  subtitle: string | null;
  category_slug: string;
  category_label: string;
  collection_id: string | null;
  price_usd: number | string;
  description: string | null;
  material: string | null;
  care: string | null;
  is_new_arrival: boolean | null;
  is_best_seller: boolean | null;
  product_images?: DbProductImageRow[];
  product_variants?: DbProductVariantRow[];
}

interface DbCategoryRow {
  slug: string;
  label: string;
  image_path: string | null;
  sort_order: number | null;
}

interface DbStoreSettingsRow {
  boutique_name: string | null;
  default_currency: string | null;
  supported_currencies: string[] | null;
  gift_presentation_available: boolean | null;
  gift_presentation_label: string | null;
  pickup_location_note: string | null;
  hero_image_path: string | null;
  collections: unknown;
  campaigns: unknown;
}

const KNOWN_CATEGORIES = new Set<Exclude<CategorySlug, 'all'>>([
  'dresses',
  'tailoring',
  'outerwear',
  'separates',
  'handbags',
  'jewellery',
]);

function normalizeCategorySlug(raw: string): Exclude<CategorySlug, 'all'> {
  const lower = raw.trim().toLowerCase() as Exclude<CategorySlug, 'all'>;
  return KNOWN_CATEGORIES.has(lower) ? lower : 'dresses';
}

function mapProductRow(row: DbProductRow): Product {
  const images = [...(row.product_images ?? [])]
    .sort(
      (a, b) =>
        Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )
    .map((img) => getBoutiqueMediaUrl(img.storage_path))
    .filter(Boolean);

  const variants = row.product_variants ?? [];
  const availableVariants = variants.filter(
    (v) => v.is_available !== false && (v.stock_count ?? 0) > 0
  );

  const sizeSet = new Set<string>();
  const colorMap = new Map<string, ColorOption>();
  let totalStock = 0;

  for (const v of variants) {
    if (v.size) sizeSet.add(v.size);
    if (v.color_name && !colorMap.has(v.color_name)) {
      colorMap.set(v.color_name, {
        name: v.color_name,
        hex: v.color_hex || '#D8C3A5',
      });
    }
    if (v.is_available !== false) {
      totalStock += Math.max(0, v.stock_count ?? 0);
    }
  }

  let stockStatus: StockStatus = 'in_stock';
  if (variants.length > 0) {
    if (availableVariants.length === 0 || totalStock <= 0) {
      stockStatus = 'out_of_stock';
    } else if (totalStock <= 3) {
      stockStatus = 'low_stock';
    }
  }

  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? '',
    category: normalizeCategorySlug(row.category_slug),
    categoryLabel: row.category_label || 'Collection',
    collectionId: row.collection_id ?? '',
    priceUsd: Number(row.price_usd) || 0,
    images,
    description: row.description ?? '',
    material: row.material ?? '',
    care: row.care ?? '',
    sizes: sizeSet.size > 0 ? Array.from(sizeSet) : ['One Size'],
    colors:
      colorMap.size > 0
        ? Array.from(colorMap.values())
        : [{ name: 'Signature', hex: '#D8C3A5' }],
    stockStatus,
    stockCount: totalStock,
    isNewArrival: Boolean(row.is_new_arrival),
    isBestSeller: Boolean(row.is_best_seller),
  };
}

export async function fetchBoutiqueCatalog(): Promise<CatalogSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(SUPABASE_CONFIG_WARNING);
  }

  const [productsRes, categoriesRes, settingsRes] = await Promise.all([
    supabase
      .from('products')
      .select(
        `
        id,
        name,
        subtitle,
        category_slug,
        category_label,
        collection_id,
        price_usd,
        description,
        material,
        care,
        is_new_arrival,
        is_best_seller,
        sort_order,
        product_images (
          storage_path,
          sort_order,
          is_primary
        ),
        product_variants (
          id,
          size,
          color_name,
          color_hex,
          stock_count,
          is_available
        )
      `
      )
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('slug, label, image_path, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (productsRes.error) {
    throw new Error(productsRes.error.message || 'Unable to load boutique catalogue.');
  }

  const products = ((productsRes.data ?? []) as DbProductRow[]).map(mapProductRow);

  const dbCategories = ((categoriesRes.data ?? []) as DbCategoryRow[]).map((cat) => ({
    slug: cat.slug as CategorySlug,
    label: cat.label,
    image: cat.image_path ? getBoutiqueMediaUrl(cat.image_path) : undefined,
  }));

  const categories: BoutiqueCategoryItem[] = [
    { slug: 'all', label: 'All' },
    ...dbCategories.filter((c) => c.slug !== 'all'),
  ];

  const settingsRow = settingsRes.data as DbStoreSettingsRow | null;
  const supportedCurrencies = (
    settingsRow?.supported_currencies?.length
      ? settingsRow.supported_currencies
      : DEFAULT_STORE_SETTINGS.supportedCurrencies
  ) as CurrencyCode[];

  const storeSettings: StoreSettings = {
    ...DEFAULT_STORE_SETTINGS,
    boutiqueName: settingsRow?.boutique_name?.trim() || DEFAULT_STORE_SETTINGS.boutiqueName,
    defaultCurrency:
      (settingsRow?.default_currency as CurrencyCode | undefined) ??
      DEFAULT_STORE_SETTINGS.defaultCurrency,
    supportedCurrencies,
    giftPresentationAvailable:
      settingsRow?.gift_presentation_available ?? DEFAULT_STORE_SETTINGS.giftPresentationAvailable,
    giftPresentationLabel:
      settingsRow?.gift_presentation_label?.trim() || DEFAULT_STORE_SETTINGS.giftPresentationLabel,
    pickupLocationNote:
      settingsRow?.pickup_location_note?.trim() || DEFAULT_STORE_SETTINGS.pickupLocationNote,
    backendCheckoutEnabled: true,
  };

  const rawCollections = Array.isArray(settingsRow?.collections)
    ? (settingsRow.collections as Collection[])
    : [];
  const collections = rawCollections.map((col) => ({
    ...col,
    image: getBoutiqueMediaUrl(col.image),
  }));

  const rawCampaigns = Array.isArray(settingsRow?.campaigns)
    ? (settingsRow.campaigns as EditorialCampaign[])
    : [];
  const campaigns = rawCampaigns.map((camp) => ({
    ...camp,
    image: getBoutiqueMediaUrl(camp.image),
  }));

  const heroImageUrl = settingsRow?.hero_image_path
    ? getBoutiqueMediaUrl(settingsRow.hero_image_path)
    : '';

  return {
    products,
    categories,
    collections,
    campaigns,
    storeSettings,
    heroImageUrl,
  };
}
