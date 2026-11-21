import type { CurrencyCode } from '../types/boutique';

const CURRENCY_CONFIG: Record<CurrencyCode, { rateFromUsd: number; locale: string }> = {
  USD: { rateFromUsd: 1, locale: 'en-US' },
  EUR: { rateFromUsd: 0.92, locale: 'en-IE' },
  GBP: { rateFromUsd: 0.79, locale: 'en-GB' },
  CAD: { rateFromUsd: 1.38, locale: 'en-CA' },
  AED: { rateFromUsd: 3.67, locale: 'en-AE' },
  NGN: { rateFromUsd: 1550, locale: 'en-NG' },
};

export function formatPrice(amountUsd: number, currency: CurrencyCode): string {
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD;
  const rawConverted = amountUsd * cfg.rateFromUsd;
  const value = currency === 'USD' ? Number(rawConverted.toFixed(2)) : Math.round(rawConverted);
  const hasDecimals = value % 1 !== 0;

  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(value);
}
