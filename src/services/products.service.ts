import { DEFAULT_STORE_SETTINGS } from '../data/storeConfig';
import { isSupabaseConfigured, supabase, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import type {
  CampaignStatus,
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

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return '';
  }

  // Ignore legacy bundled demo photo paths if any stale database record still points to them
  if (lower.includes('/src/assets/images/') || lower.startsWith('src/assets/images/')) {
    return '';
  }

  if (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('blob:')
  ) {
    return trimmed;
  }

  if (!supabase) return '';
  const cleanPath = trimmed.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.includes('..')) return '';
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

interface DbCollectionRow {
  id: string;
  slug: string;
  title: string;
  season: string | null;
  summary: string | null;
  image_path: string | null;
  filter_category: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

interface DbCampaignRow {
  id: string;
  kicker: string | null;
  title: string;
  description: string | null;
  cta_label: string | null;
  image_path: string | null;
  target_category: string | null;
  status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
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

const KNOWN_CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  'draft',
  'active',
  'scheduled',
  'archived',
]);

function normalizeCategorySlug(raw: string | null | undefined): Exclude<CategorySlug, 'all'> {
  const lower = (raw ?? '').trim().toLowerCase() as Exclude<CategorySlug, 'all'>;
  return KNOWN_CATEGORIES.has(lower) ? lower : 'dresses';
}

function normalizeFilterCategory(raw: string | null | undefined): CategorySlug {
  const lower = (raw ?? '').trim().toLowerCase();
  if (lower === 'all') return 'all';
  return KNOWN_CATEGORIES.has(lower as Exclude<CategorySlug, 'all'>)
    ? (lower as CategorySlug)
    : 'all';
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
    sizes: Array.from(sizeSet),
    colors: Array.from(colorMap.values()),
    stockStatus,
    stockCount: totalStock,
    isNewArrival: Boolean(row.is_new_arrival),
    isBestSeller: Boolean(row.is_best_seller),
  };
}

function mapCollectionRow(row: DbCollectionRow): Collection {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    season: row.season ?? '',
    summary: row.summary ?? '',
    image: getBoutiqueMediaUrl(row.image_path),
    filterCategory: normalizeFilterCategory(row.filter_category),
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCampaignRow(row: DbCampaignRow): EditorialCampaign {
  const status: CampaignStatus =
    row.status && KNOWN_CAMPAIGN_STATUSES.has(row.status as CampaignStatus)
      ? (row.status as CampaignStatus)
      : 'active';
  return {
    id: row.id,
    kicker: row.kicker ?? '',
    title: row.title,
    description: row.description ?? '',
    ctaLabel: row.cta_label || 'Shop Collection',
    image: getBoutiqueMediaUrl(row.image_path),
    targetCategory: normalizeFilterCategory(row.target_category),
    status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchBoutiqueCatalog(): Promise<CatalogSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(SUPABASE_CONFIG_WARNING);
  }

  const nowIso = new Date().toISOString();

  const [productsRes, categoriesRes, collectionsRes, campaignsRes, settingsRes] = await Promise.all([
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
    supabase
      .from('collections')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (productsRes.error) {
    throw new Error('Unable to load the boutique catalogue right now.');
  }

  const products = ((productsRes.data ?? []) as DbProductRow[]).map(mapProductRow);

  const dbCategories = ((categoriesRes.data ?? []) as DbCategoryRow[]).map((cat) => {
    const resolvedImage = getBoutiqueMediaUrl(cat.image_path);
    return {
      slug: cat.slug as CategorySlug,
      label: cat.label,
      image: resolvedImage || undefined,
    };
  });

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

  // Prefer normalized public.collections & public.campaigns tables; fall back to
  // legacy store_settings jsonb only if the normalized tables have not been migrated yet.
  let collections: Collection[] = [];
  if (!collectionsRes.error) {
    collections = ((collectionsRes.data ?? []) as DbCollectionRow[]).map(mapCollectionRow);
  } else if (Array.isArray(settingsRow?.collections)) {
    collections = (settingsRow.collections as Collection[])
      .filter((col) => col && typeof col.title === 'string' && col.id !== 'lumiere-soir')
      .map((col) => ({
        ...col,
        image: getBoutiqueMediaUrl(col.image),
      }));
  }

  let campaigns: EditorialCampaign[] = [];
  if (!campaignsRes.error) {
    campaigns = ((campaignsRes.data ?? []) as DbCampaignRow[])
      .filter(
        (c) => (!c.starts_at || c.starts_at <= nowIso) && (!c.ends_at || c.ends_at >= nowIso)
      )
      .map(mapCampaignRow);
  } else if (Array.isArray(settingsRow?.campaigns)) {
    campaigns = (settingsRow.campaigns as EditorialCampaign[])
      .filter((camp) => camp && typeof camp.title === 'string' && camp.id !== 'campaign-main')
      .map((camp) => ({
        ...camp,
        image: getBoutiqueMediaUrl(camp.image),
      }));
  }

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
