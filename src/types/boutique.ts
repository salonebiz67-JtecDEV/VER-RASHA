export type AppRoute =
  | 'home'
  | 'explore'
  | 'product'
  | 'wishlist'
  | 'cart'
  | 'checkout'
  | 'account'
  | 'notifications';

export type WelcomeAuthMode = 'landing' | 'signin' | 'signup' | 'forgot';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AED' | 'NGN';

export type CategorySlug =
  | 'all'
  | 'dresses'
  | 'tailoring'
  | 'outerwear'
  | 'separates'
  | 'handbags'
  | 'jewellery';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface ColorOption {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: Exclude<CategorySlug, 'all'>;
  categoryLabel: string;
  collectionId: string;
  priceUsd: number;
  images: string[];
  description: string;
  material: string;
  care: string;
  sizes: string[];
  colors: ColorOption[];
  stockStatus: StockStatus;
  stockCount: number;
  isNewArrival: boolean;
  isBestSeller: boolean;
}

export interface Collection {
  id: string;
  title: string;
  season: string;
  summary: string;
  image: string;
  filterCategory: CategorySlug;
}

export interface EditorialCampaign {
  id: string;
  kicker: string;
  title: string;
  description: string;
  ctaLabel: string;
  image: string;
  targetCategory: CategorySlug;
}

export interface CartItem {
  id: string;
  productId: string;
  selectedSize: string;
  selectedColor: ColorOption;
  quantity: number;
}

export interface SavedAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  area: string;
  deliveryAddress: string;
  deliveryInstructions?: string;
  isDefault: boolean;
}

export type OrderStatus =
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_FOR_DISPATCH'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PAYMENT_PENDING' | 'PAID' | 'REFUNDED';

export interface OrderCustomerInfo {
  fullName: string;
  phone: string;
  country: string;
  city: string;
  area: string;
  deliveryAddress: string;
  deliveryInstructions?: string;
}

export interface OrderLineItem {
  productId: string;
  productName: string;
  subtitle?: string;
  size: string;
  colorName: string;
  colorHex?: string;
  quantity: number;
  unitPriceUsd: number;
  lineTotalUsd: number;
  image: string;
}

export interface OrderRecord {
  id: string;
  orderReference: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customer: OrderCustomerInfo;
  items: OrderLineItem[];
  currencyAtOrder: CurrencyCode;
  giftPresentation: boolean;
  subtotalUsd: number;
  deliveryFeeUsd: number | null;
  finalTotalUsd: number | null;
  estimatedDeliveryTime: string | null;
  ownerMessage: string | null;
}

export interface OrderRequestPayload {
  customer: OrderCustomerInfo;
  items: {
    productId: string;
    size: string;
    colorName: string;
    quantity: number;
  }[];
  giftPresentation: boolean;
  currency: CurrencyCode;
}

export interface OrderSubmissionResult {
  status: 'pending_review' | 'error';
  message: string;
  order?: OrderRecord;
}

export type NotificationType =
  | 'order_update'
  | 'delivery_update'
  | 'boutique_announcement';

export interface NotificationItem {
  id: string;
  orderId?: string;
  orderReference?: string;
  type: NotificationType;
  typeLabel: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRoute?: AppRoute;
  confirmedDeliveryFeeUsd?: number;
  confirmedFinalTotalUsd?: number;
  estimatedDeliveryTime?: string;
  currency?: CurrencyCode;
}

export interface CustomerProfile {
  fullName: string;
  email: string;
  phone: string;
  tierLabel: string;
  preferredSize: string;
  newsletterOptIn: boolean;
  smsUpdatesOptIn: boolean;
}

export type DeliveryMethodId = 'standard' | 'express' | 'pickup';
export type PaymentMethodId = 'card' | 'wallet' | 'bank_transfer' | 'cod';

export interface DeliveryRegionConfig {
  id: string;
  countryName: string;
  regionLabel: string;
  estimatedWindow: string;
  baseFeeUsd: number;
  enabled: boolean;
}

export interface DeliveryMethodConfig {
  id: DeliveryMethodId;
  title: string;
  description: string;
  surchargeUsd: number;
  requiresAddress: boolean;
  enabled: boolean;
}

export interface PaymentMethodConfig {
  id: PaymentMethodId;
  title: string;
  description: string;
  availabilityNote: string;
  enabled: boolean;
}

export interface StoreSettings {
  boutiqueName: string;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  freeDeliveryThresholdUsd: number | null;
  deliveryRegions: DeliveryRegionConfig[];
  deliveryMethods: DeliveryMethodConfig[];
  paymentMethods: PaymentMethodConfig[];
  giftPresentationAvailable: boolean;
  giftPresentationLabel: string;
  pickupLocationNote: string;
  backendCheckoutEnabled: boolean;
}
