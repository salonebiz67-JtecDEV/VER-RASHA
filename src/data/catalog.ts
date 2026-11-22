import type {
  CategorySlug,
  Collection,
  CustomerProfile,
  EditorialCampaign,
  NotificationItem,
  OrderRecord,
  Product,
  SavedAddress,
} from '../types/boutique';

// Neutral empty asset map preserved for module compatibility; live media loads from Supabase Storage.
export const ASSETS = {
  heroGown: '',
  eveningSilk: '',
  linenBlazer: '',
  cashmereCoat: '',
  silkBlouse: '',
  pleatedSkirt: '',
  leatherTote: '',
  pearlEarrings: '',
  resortCampaign: '',
} as const;

export const CATEGORIES: { slug: CategorySlug; label: string; image?: string }[] = [
  { slug: 'all', label: 'All' },
  { slug: 'dresses', label: 'Dresses' },
  { slug: 'tailoring', label: 'Tailoring' },
  { slug: 'outerwear', label: 'Outerwear' },
  { slug: 'separates', label: 'Separates' },
  { slug: 'handbags', label: 'Handbags' },
  { slug: 'jewellery', label: 'Jewellery' },
];

// Live products, collections, and campaigns are fetched from Supabase — zero demo records.
export const PRODUCTS: Product[] = [];
export const FEATURED_COLLECTIONS: Collection[] = [];
export const EDITORIAL_CAMPAIGNS: EditorialCampaign[] = [];

export const INITIAL_CUSTOMER: CustomerProfile = {
  fullName: '',
  email: '',
  phone: '',
  tierLabel: 'Client',
  preferredSize: 'M',
  newsletterOptIn: false,
  smsUpdatesOptIn: false,
};

export const INITIAL_ADDRESSES: SavedAddress[] = [];
export const INITIAL_ORDERS: OrderRecord[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
