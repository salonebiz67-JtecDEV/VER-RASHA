import type { CurrencyCode, StoreSettings } from '../types/boutique';

export const STORE_CURRENCY: CurrencyCode = 'USD';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  boutiqueName: 'VEY RASHA',
  boutiqueDescription: 'Curated women’s fashion, tailoring, and signature accessories.',
  defaultCurrency: STORE_CURRENCY,
  supportedCurrencies: [STORE_CURRENCY],
  freeDeliveryThresholdUsd: null,
  deliveryRegions: [
    {
      id: 'default-region',
      countryName: 'Local',
      regionLabel: 'Standard delivery area',
      estimatedWindow: '2-5 business days',
      baseFeeUsd: 0,
      enabled: true,
    },
  ],
  deliveryMethods: [
    {
      id: 'standard',
      title: 'Standard Delivery',
      description: 'Delivered to your address. The boutique confirms the final fee.',
      surchargeUsd: 0,
      requiresAddress: true,
      enabled: true,
    },
    {
      id: 'pickup',
      title: 'Boutique Pickup',
      description: 'Collect your order from the boutique.',
      surchargeUsd: 0,
      requiresAddress: false,
      enabled: true,
    },
  ],
  paymentMethods: [
    {
      id: 'cod',
      title: 'Pay on Delivery',
      description: 'Pay when your order arrives.',
      availabilityNote: 'Confirmed by the boutique after your order is reviewed.',
      enabled: true,
    },
    {
      id: 'bank_transfer',
      title: 'Bank Transfer',
      description: 'Pay by bank transfer after the boutique confirms your order.',
      availabilityNote: 'Payment details are sent after review.',
      enabled: true,
    },
  ],
  giftPresentationAvailable: true,
  giftPresentationLabel: 'Gift presentation',
  pickupLocationNote: 'Pickup details are shared once your order is confirmed.',
  backendCheckoutEnabled: true,
};
