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

// Images already live in src/assets/images. The build copies them to dist/src/assets/images.
const IMG = '/src/assets/images/';

export const ASSETS = {
  heroGown: `${IMG}hero_atelier_gown_1795252985735.jpg`,
  eveningSilk: `${IMG}collection_evening_silk_1795252987216.jpg`,
  linenBlazer: `${IMG}product_linen_blazer_1795252985938.jpg`,
  cashmereCoat: `${IMG}product_cashmere_coat_1795252986203.jpg`,
  silkBlouse: `${IMG}product_silk_blouse_1795252986697.jpg`,
  pleatedSkirt: `${IMG}product_pleated_skirt_1795252987680.jpg`,
  leatherTote: `${IMG}product_leather_tote_1795252987024.jpg`,
  pearlEarrings: `${IMG}product_pearl_earrings_1795252988219.jpg`,
  resortCampaign: `${IMG}editorial_campaign_resort_1795252987970.jpg`,
};

export const CATEGORIES: { slug: CategorySlug; label: string; image?: string }[] = [
  { slug: 'all', label: 'All' },
  { slug: 'dresses', label: 'Dresses', image: ASSETS.eveningSilk },
  { slug: 'tailoring', label: 'Tailoring', image: ASSETS.linenBlazer },
  { slug: 'outerwear', label: 'Outerwear', image: ASSETS.cashmereCoat },
  { slug: 'separates', label: 'Separates', image: ASSETS.silkBlouse },
  { slug: 'handbags', label: 'Handbags', image: ASSETS.leatherTote },
  { slug: 'jewellery', label: 'Jewellery', image: ASSETS.pearlEarrings },
];

// The app expects these three product ids to exist (default cart and wishlist).
// Replace or delete them later from the Owner Workspace.
export const PRODUCTS: Product[] = [
  {
    id: 'vr-aurelia-gown',
    name: 'Aurelia Gown',
    subtitle: 'Starter item',
    category: 'dresses',
    categoryLabel: 'Dresses',
    collectionId: 'lumiere-soir',
    priceUsd: 100,
    images: [ASSETS.heroGown],
    description: 'Starter item. Edit or remove it from the Owner Workspace.',
    material: 'Silk',
    care: 'Dry clean only',
    sizes: ['S', 'M', 'L'],
    colors: [{ name: 'Champagne', hex: '#D8C3A5' }],
    stockStatus: 'in_stock',
    stockCount: 10,
    isNewArrival: true,
    isBestSeller: true,
  },
  {
    id: 'vr-celeste-midi',
    name: 'Celeste Midi',
    subtitle: 'Starter item',
    category: 'dresses',
    categoryLabel: 'Dresses',
    collectionId: 'lumiere-soir',
    priceUsd: 80,
    images: [ASSETS.eveningSilk],
    description: 'Starter item. Edit or remove it from the Owner Workspace.',
    material: 'Silk',
    care: 'Dry clean only',
    sizes: ['S', 'M', 'L'],
    colors: [{ name: 'Champagne', hex: '#D8C3A5' }],
    stockStatus: 'in_stock',
    stockCount: 10,
    isNewArrival: true,
    isBestSeller: false,
  },
  {
    id: 'vr-margaux-bag',
    name: 'Margaux Bag',
    subtitle: 'Starter item',
    category: 'handbags',
    categoryLabel: 'Handbags',
    collectionId: 'lumiere-soir',
    priceUsd: 60,
    images: [ASSETS.leatherTote],
    description: 'Starter item. Edit or remove it from the Owner Workspace.',
    material: 'Leather',
    care: 'Wipe with a soft cloth',
    sizes: ['One Size'],
    colors: [{ name: 'Tan', hex: '#A87B4F' }],
    stockStatus: 'in_stock',
    stockCount: 10,
    isNewArrival: false,
    isBestSeller: true,
  },
];

export const FEATURED_COLLECTIONS: Collection[] = [
  {
    id: 'lumiere-soir',
    title: 'Lumière Soir',
    season: 'Featured',
    summary: 'Starter collection. Edit it from the Owner Workspace.',
    image: ASSETS.eveningSilk,
    filterCategory: 'all',
  },
];

export const EDITORIAL_CAMPAIGNS: EditorialCampaign[] = [
  {
    id: 'campaign-main',
    kicker: 'New',
    title: 'Welcome to VEY RASHA',
    description: 'Discover the latest from the boutique.',
    ctaLabel: 'Shop now',
    image: ASSETS.resortCampaign,
    targetCategory: 'all',
  },
];

export const INITIAL_CUSTOMER: CustomerProfile = {
  fullName: '',
  email: '',
  phone: '',
  tierLabel: 'Guest',
  preferredSize: 'M',
  newsletterOptIn: false,
  smsUpdatesOptIn: false,
};

export const INITIAL_ADDRESSES: SavedAddress[] = [];
export const INITIAL_ORDERS: OrderRecord[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
    
