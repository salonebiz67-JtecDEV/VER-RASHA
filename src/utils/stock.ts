import type { ColorOption, Product, ProductVariantOption } from '../types/boutique';

export function getVariantForSelection(
  product: Product,
  size: string,
  colorName: string
): ProductVariantOption | null {
  const variants = product.variants;
  if (!variants || variants.length === 0) return null;
  return (
    variants.find((v) => v.size === size && v.colorName === colorName) ?? null
  );
}

export function getMaxStockForSelection(
  product: Product,
  size: string,
  colorName: string
): number {
  const variants = product.variants;
  if (variants && variants.length > 0) {
    const match = getVariantForSelection(product, size, colorName);
    if (!match || !match.isAvailable) return 0;
    return Math.max(0, match.stockCount);
  }

  if (product.stockStatus === 'out_of_stock') return 0;
  return product.stockCount > 0 ? product.stockCount : 20;
}

export function isColorInStock(product: Product, colorName: string): boolean {
  const variants = product.variants;
  if (!variants || variants.length === 0) {
    return product.stockStatus !== 'out_of_stock';
  }
  return variants.some(
    (v) => v.colorName === colorName && v.isAvailable && v.stockCount > 0
  );
}

export function isSizeInStock(
  product: Product,
  size: string,
  selectedColorName?: string
): boolean {
  const variants = product.variants;
  if (!variants || variants.length === 0) {
    return product.stockStatus !== 'out_of_stock';
  }

  if (selectedColorName) {
    const exact = variants.find(
      (v) => v.size === size && v.colorName === selectedColorName
    );
    if (exact) {
      return exact.isAvailable && exact.stockCount > 0;
    }
    return false;
  }

  return variants.some((v) => v.size === size && v.isAvailable && v.stockCount > 0);
}

export function getFirstAvailableSelection(product: Product): {
  size: string;
  color: ColorOption;
} {
  const variants = product.variants;
  if (variants && variants.length > 0) {
    const firstAvailable = variants.find((v) => v.isAvailable && v.stockCount > 0);
    if (firstAvailable) {
      const matchedColor =
        product.colors.find((c) => c.name === firstAvailable.colorName) ?? {
          name: firstAvailable.colorName,
          hex: firstAvailable.colorHex,
        };
      return {
        size: firstAvailable.size,
        color: matchedColor,
      };
    }
  }

  return {
    size: product.sizes[0] ?? '',
    color: product.colors[0] ?? { name: '', hex: '#D8C3A5' },
  };
}
