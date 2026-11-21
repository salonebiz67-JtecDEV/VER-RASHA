import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  KeyRound,
  LogOut,
  PackagePlus,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Smartphone,
  Store,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { ASSETS, CATEGORIES } from '../../data/catalog';
import { useBoutique } from '../../context/BoutiqueContext';
import type {
  CategorySlug,
  Collection,
  ColorOption,
  CurrencyCode,
  OrderRecord,
  OrderStatus,
  OwnerDeviceSlot,
  OwnerSectionId,
  PaymentStatus,
  Product,
} from '../../types/boutique';
import { formatPrice } from '../../utils/formatCurrency';
import {
  formatOrderDate,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/orderStatus';
import { PrintableReceiptModal } from '../orders/PrintableReceiptModal';
import { LuxuryImage } from '../ui/LuxuryImage';

const OWNER_NAV_ITEMS: {
  id: OwnerSectionId;
  label: string;
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
}[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'orders', label: 'Orders', icon: Sliders },
  { id: 'products', label: 'Products', icon: ShoppingBag },
  { id: 'add_product', label: 'Add Product', icon: PackagePlus },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'promotions', label: 'Promotions', icon: Percent },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'store_settings', label: 'Store Settings', icon: Settings },
  { id: 'security', label: 'Devices & Security', icon: ShieldCheck },
];

const ALL_STATUS_FILTERS: { value: 'ALL' | OrderStatus; label: string }[] = [
  { value: 'ALL', label: 'All Orders' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const FULFILLMENT_STATUS_OPTIONS: OrderStatus[] = [
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  'UNPAID',
  'PAYMENT_PENDING',
  'PAID',
  'REFUNDED',
];

const PRODUCT_CATEGORIES = CATEGORIES.filter(
  (c): c is { slug: Exclude<CategorySlug, 'all'>; label: string; image?: string } =>
    c.slug !== 'all'
);

const PRESET_GALLERY: { label: string; url: string }[] = [
  { label: 'Hero Gown', url: ASSETS.heroGown },
  { label: 'Evening Silk', url: ASSETS.eveningSilk },
  { label: 'Linen Blazer', url: ASSETS.linenBlazer },
  { label: 'Cashmere Coat', url: ASSETS.cashmereCoat },
  { label: 'Silk Blouse', url: ASSETS.silkBlouse },
  { label: 'Pleated Skirt', url: ASSETS.pleatedSkirt },
  { label: 'Leather Tote', url: ASSETS.leatherTote },
  { label: 'Pearl Earrings', url: ASSETS.pearlEarrings },
  { label: 'Resort Lookbook', url: ASSETS.resortCampaign },
];

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'One Size'];

export const OwnerPortalView: React.FC = () => {
  const {
    isOwnerAuthorized,
    currentOwnerDevice,
    ownerSecurity,
    closeOwnerDashboard,
    refreshOwnerSecurity,
    rotateCurrentOwnerToken,
    revokeAuthorizedDevice,
    generateReplacementDeviceCode,
    signOutOwnerSession,
    products,
    collections,
    campaigns,
    storeSettings,
    ownerOrders,
    isLoadingOwnerOrders,
    refreshOwnerOrders,
    acceptOwnerOrder,
    updateOwnerOrderStatus,
    updateOwnerPaymentStatus,
    createOwnerProduct,
    updateOwnerProduct,
    deleteOwnerProduct,
    updateOwnerInventory,
    updateOwnerCampaign,
    updateOwnerCollection,
    publishOwnerAnnouncement,
    updateOwnerStoreSettings,
  } = useBoutique();

  // Never render any management workspace unless backend device session is authorized
  if (!isOwnerAuthorized) {
    return null;
  }

  const [activeSection, setActiveSection] = useState<OwnerSectionId>('overview');

  // ---------------------------------------------------------------------------
  // Orders Management State
  // ---------------------------------------------------------------------------
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');
  const [estimatedDeliveryInput, setEstimatedDeliveryInput] = useState('');
  const [ownerMessageInput, setOwnerMessageInput] = useState('');
  const [orderActionError, setOrderActionError] = useState<string | null>(null);
  const [isProcessingOrderAction, setIsProcessingOrderAction] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return ownerOrders;
    return ownerOrders.filter((o) => o.status === statusFilter);
  }, [ownerOrders, statusFilter]);

  const selectedOrder = useMemo(() => {
    if (filteredOrders.length === 0) return null;
    return filteredOrders.find((o) => o.id === selectedOrderId) ?? filteredOrders[0];
  }, [filteredOrders, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrder) return;
    setOrderActionError(null);
    setDeliveryFeeInput(
      selectedOrder.deliveryFeeUsd !== null ? String(selectedOrder.deliveryFeeUsd) : ''
    );
    setEstimatedDeliveryInput(selectedOrder.estimatedDeliveryTime ?? '');
    setOwnerMessageInput(selectedOrder.ownerMessage ?? '');
  }, [selectedOrder?.id]);

  const pendingReviewCount = useMemo(
    () => ownerOrders.filter((o) => o.status === 'PENDING_REVIEW').length,
    [ownerOrders]
  );

  const confirmedRevenueUsd = useMemo(
    () =>
      ownerOrders
        .filter((o) => o.status !== 'PENDING_REVIEW' && o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + (o.finalTotalUsd ?? o.subtotalUsd), 0),
    [ownerOrders]
  );

  const lowOrOutCount = useMemo(
    () => products.filter((p) => p.stockStatus !== 'in_stock').length,
    [products]
  );

  const parsedFeeUsd = Number(deliveryFeeInput);
  const hasValidFee =
    deliveryFeeInput.trim() !== '' && Number.isFinite(parsedFeeUsd) && parsedFeeUsd >= 0;
  const computedFinalTotalUsd =
    selectedOrder && hasValidFee
      ? Number((selectedOrder.subtotalUsd + parsedFeeUsd).toFixed(2))
      : null;

  // ---------------------------------------------------------------------------
  // Product Add / Edit State
  // ---------------------------------------------------------------------------
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSubtitle, setProdSubtitle] = useState('');
  const [prodCategory, setProdCategory] = useState<Exclude<CategorySlug, 'all'>>('dresses');
  const [prodCollectionId, setProdCollectionId] = useState(
    collections[0]?.id ?? 'lumiere-soir'
  );
  const [prodPrice, setProdPrice] = useState('');
  const [prodStockCount, setProdStockCount] = useState('5');
  const [prodMaterial, setProdMaterial] = useState('');
  const [prodCare, setProdCare] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodImages, setProdImages] = useState<string[]>([ASSETS.eveningSilk]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [prodSizes, setProdSizes] = useState<string[]>(['XS', 'S', 'M', 'L']);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [prodColors, setProdColors] = useState<ColorOption[]>([
    { name: 'Champagne Gold', hex: '#D8C3A5' },
  ]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#302923');
  const [prodIsNew, setProdIsNew] = useState(true);
  const [prodIsBest, setProdIsBest] = useState(false);
  const [prodFormError, setProdFormError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdSubtitle('');
    setProdCategory('dresses');
    setProdCollectionId(collections[0]?.id ?? 'lumiere-soir');
    setProdPrice('');
    setProdStockCount('5');
    setProdMaterial('');
    setProdCare('');
    setProdDescription('');
    setProdImages([ASSETS.eveningSilk]);
    setCustomImageUrl('');
    setProdSizes(['XS', 'S', 'M', 'L']);
    setCustomSizeInput('');
    setProdColors([{ name: 'Champagne Gold', hex: '#D8C3A5' }]);
    setNewColorName('');
    setNewColorHex('#302923');
    setProdIsNew(true);
    setProdIsBest(false);
    setProdFormError(null);
  };

  const openProductEditor = (product: Product) => {
    setEditingProductId(product.id);
    setProdName(product.name);
    setProdSubtitle(product.subtitle);
    setProdCategory(product.category);
    setProdCollectionId(product.collectionId);
    setProdPrice(String(product.priceUsd));
    setProdStockCount(String(product.stockCount));
    setProdMaterial(product.material);
    setProdCare(product.care);
    setProdDescription(product.description);
    setProdImages(product.images.length > 0 ? product.images : [ASSETS.eveningSilk]);
    setProdSizes(product.sizes.length > 0 ? product.sizes : ['One Size']);
    setProdColors(
      product.colors.length > 0
        ? product.colors
        : [{ name: 'Champagne Gold', hex: '#D8C3A5' }]
    );
    setProdIsNew(product.isNewArrival);
    setProdIsBest(product.isBestSeller);
    setProdFormError(null);
    setActiveSection('add_product');
  };

  const toggleProductSize = (size: string) => {
    setProdSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleAddCustomSize = () => {
    const clean = customSizeInput.trim();
    if (!clean) return;
    if (!prodSizes.includes(clean)) {
      setProdSizes((prev) => [...prev, clean]);
    }
    setCustomSizeInput('');
  };

  const handleAddColor = () => {
    const clean = newColorName.trim();
    if (!clean) return;
    setProdColors((prev) => [
      ...prev.filter((c) => c.name.toLowerCase() !== clean.toLowerCase()),
      { name: clean, hex: /^#[0-9a-fA-F]{6}$/.test(newColorHex) ? newColorHex : '#D8C3A5' },
    ]);
    setNewColorName('');
  };

  const handleAddCustomImage = () => {
    const clean = customImageUrl.trim();
    if (!clean) return;
    if (!clean.startsWith('https://') && !clean.startsWith('/')) {
      setProdFormError('Image URL must begin with https:// or a boutique asset path.');
      return;
    }
    setProdFormError(null);
    if (!prodImages.includes(clean)) {
      setProdImages((prev) => [...prev, clean]);
    }
    setCustomImageUrl('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdFormError(null);

    const priceNum = Number(prodPrice);
    const stockNum = Number(prodStockCount);
    if (!prodName.trim() || !prodSubtitle.trim()) {
      setProdFormError('Enter both a product name and subtitle.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setProdFormError('Enter a valid product price.');
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setProdFormError('Enter a valid whole number stock count.');
      return;
    }
    if (prodImages.length === 0) {
      setProdFormError('Select or add at least one product photograph.');
      return;
    }
    if (prodSizes.length === 0) {
      setProdFormError('Select at least one available size.');
      return;
    }
    if (prodColors.length === 0) {
      setProdFormError('Include at least one colour option.');
      return;
    }
    if (!prodDescription.trim() || !prodMaterial.trim() || !prodCare.trim()) {
      setProdFormError('Provide description, composition material, and care details.');
      return;
    }

    setIsSavingProduct(true);
    try {
      const payload = {
        name: prodName.trim(),
        subtitle: prodSubtitle.trim(),
        category: prodCategory,
        collectionId: prodCollectionId,
        priceUsd: Number(priceNum.toFixed(2)),
        images: prodImages,
        description: prodDescription.trim(),
        material: prodMaterial.trim(),
        care: prodCare.trim(),
        sizes: prodSizes,
        colors: prodColors,
        stockCount: stockNum,
        isNewArrival: prodIsNew,
        isBestSeller: prodIsBest,
      };

      const res = editingProductId
        ? await updateOwnerProduct(editingProductId, payload)
        : await createOwnerProduct(payload);

      if (!res.ok) {
        setProdFormError(res.error ?? 'Unable to save product.');
        return;
      }

      resetProductForm();
      setActiveSection('products');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Inventory State
  // ---------------------------------------------------------------------------
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [savingStockId, setSavingStockId] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of products) {
      next[p.id] = String(p.stockCount);
    }
    setStockDrafts(next);
  }, [products]);

  const handleSaveStock = async (productId: string) => {
    const qty = Number(stockDrafts[productId]);
    if (!Number.isInteger(qty) || qty < 0) return;
    setSavingStockId(productId);
    try {
      await updateOwnerInventory(productId, qty);
    } finally {
      setSavingStockId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Real Customer Directory Derived from Submitted Orders
  // ---------------------------------------------------------------------------
  const customerRoster = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        fullName: string;
        phone: string;
        city: string;
        country: string;
        orderCount: number;
        totalSpendUsd: number;
        latestOrderAt: string;
      }
    >();

    for (const order of ownerOrders) {
      const digits = order.customer.phone.replace(/\D/g, '') || order.customer.phone;
      const existing = map.get(digits);
      const orderValue =
        order.status !== 'PENDING_REVIEW' && order.status !== 'CANCELLED'
          ? (order.finalTotalUsd ?? order.subtotalUsd)
          : 0;
      if (!existing) {
        map.set(digits, {
          key: digits,
          fullName: order.customer.fullName,
          phone: order.customer.phone,
          city: order.customer.city,
          country: order.customer.country,
          orderCount: 1,
          totalSpendUsd: orderValue,
          latestOrderAt: order.createdAt,
        });
      } else {
        existing.orderCount += 1;
        existing.totalSpendUsd += orderValue;
        if (order.createdAt > existing.latestOrderAt) {
          existing.latestOrderAt = order.createdAt;
          existing.fullName = order.customer.fullName;
          existing.city = order.customer.city;
          existing.country = order.customer.country;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.latestOrderAt.localeCompare(a.latestOrderAt)
    );
  }, [ownerOrders]);

  // ---------------------------------------------------------------------------
  // Promotions & Collections Editor State
  // ---------------------------------------------------------------------------
  const primaryCampaign = campaigns[0];
  const [campKicker, setCampKicker] = useState(primaryCampaign?.kicker ?? '');
  const [campTitle, setCampTitle] = useState(primaryCampaign?.title ?? '');
  const [campDesc, setCampDesc] = useState(primaryCampaign?.description ?? '');
  const [campCta, setCampCta] = useState(primaryCampaign?.ctaLabel ?? '');
  const [campCat, setCampCat] = useState<CategorySlug>(
    primaryCampaign?.targetCategory ?? 'separates'
  );
  const [campImage, setCampImage] = useState(primaryCampaign?.image ?? ASSETS.resortCampaign);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  useEffect(() => {
    if (!primaryCampaign) return;
    setCampKicker(primaryCampaign.kicker);
    setCampTitle(primaryCampaign.title);
    setCampDesc(primaryCampaign.description);
    setCampCta(primaryCampaign.ctaLabel);
    setCampCat(primaryCampaign.targetCategory);
    setCampImage(primaryCampaign.image);
  }, [primaryCampaign]);

  const [editingCol, setEditingCol] = useState<Collection | null>(null);
  const [isSavingCollection, setIsSavingCollection] = useState(false);

  // ---------------------------------------------------------------------------
  // Notifications & Boutique Announcements State
  // ---------------------------------------------------------------------------
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceMessage, setAnnounceMessage] = useState('');
  const [announceError, setAnnounceError] = useState<string | null>(null);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnounceError(null);
    if (!announceTitle.trim() || !announceMessage.trim()) {
      setAnnounceError('Enter both a headline and message for your clients.');
      return;
    }
    setIsSendingAnnouncement(true);
    try {
      const res = await publishOwnerAnnouncement(announceTitle.trim(), announceMessage.trim());
      if (!res.ok) {
        setAnnounceError(res.error ?? 'Unable to broadcast announcement.');
        return;
      }
      setAnnounceTitle('');
      setAnnounceMessage('');
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Store Settings State
  // ---------------------------------------------------------------------------
  const [settingBoutiqueName, setSettingBoutiqueName] = useState(storeSettings.boutiqueName);
  const [settingDefaultCurrency, setSettingDefaultCurrency] = useState<CurrencyCode>(
    storeSettings.defaultCurrency
  );
  const [settingGiftAvailable, setSettingGiftAvailable] = useState(
    storeSettings.giftPresentationAvailable
  );
  const [settingGiftLabel, setSettingGiftLabel] = useState(storeSettings.giftPresentationLabel);
  const [settingPickupNote, setSettingPickupNote] = useState(storeSettings.pickupLocationNote);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    setSettingBoutiqueName(storeSettings.boutiqueName);
    setSettingDefaultCurrency(storeSettings.defaultCurrency);
    setSettingGiftAvailable(storeSettings.giftPresentationAvailable);
    setSettingGiftLabel(storeSettings.giftPresentationLabel);
    setSettingPickupNote(storeSettings.pickupLocationNote);
  }, [storeSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateOwnerStoreSettings({
        boutiqueName: settingBoutiqueName.trim(),
        defaultCurrency: settingDefaultCurrency,
        giftPresentationAvailable: settingGiftAvailable,
        giftPresentationLabel: settingGiftLabel.trim(),
        pickupLocationNote: settingPickupNote.trim(),
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Two-Device Security Management State
  // ---------------------------------------------------------------------------
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [isSecurityBusy, setIsSecurityBusy] = useState(false);
  const [confirmRevokeSlot, setConfirmRevokeSlot] = useState<OwnerDeviceSlot | null>(null);
  const [generatedReplacement, setGeneratedReplacement] = useState<{
    slot: OwnerDeviceSlot;
    code: string;
    expiresAt?: string;
  } | null>(null);
  const [copiedReplacement, setCopiedReplacement] = useState(false);

  const handleRotateToken = async () => {
    setSecurityError(null);
    setIsSecurityBusy(true);
    try {
      const res = await rotateCurrentOwnerToken();
      if (!res.ok) setSecurityError(res.error ?? 'Failed to rotate device token.');
    } finally {
      setIsSecurityBusy(false);
    }
  };

  const handleRevokeSlot = async (slot: OwnerDeviceSlot) => {
    setSecurityError(null);
    setIsSecurityBusy(true);
    try {
      const res = await revokeAuthorizedDevice(slot);
      if (!res.ok) {
        setSecurityError(res.error ?? 'Failed to revoke device.');
      } else {
        setConfirmRevokeSlot(null);
      }
    } finally {
      setIsSecurityBusy(false);
    }
  };

  const handleIssueReplacementCode = async (slot: OwnerDeviceSlot) => {
    setSecurityError(null);
    setIsSecurityBusy(true);
    try {
      const res = await generateReplacementDeviceCode(slot);
      if (!res.ok || !res.code) {
        setSecurityError(res.error ?? 'Failed to generate replacement code.');
        return;
      }
      setGeneratedReplacement({ slot, code: res.code, expiresAt: res.expiresAt });
      setCopiedReplacement(false);
    } finally {
      setIsSecurityBusy(false);
    }
  };

  const handleCopyReplacementCode = async () => {
    if (!generatedReplacement?.code) return;
    try {
      await navigator.clipboard.writeText(generatedReplacement.code);
      setCopiedReplacement(true);
      window.setTimeout(() => setCopiedReplacement(false), 2000);
    } catch {
      // Clipboard unsupported in restricted context
    }
  };

  // ---------------------------------------------------------------------------
  // Order Action Handlers
  // ---------------------------------------------------------------------------
  const handleAcceptOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setOrderActionError(null);

    if (!hasValidFee) {
      setOrderActionError('Enter a valid non-negative delivery fee.');
      return;
    }
    if (!estimatedDeliveryInput.trim()) {
      setOrderActionError('Enter an estimated delivery time for the customer.');
      return;
    }

    setIsProcessingOrderAction(true);
    try {
      const res = await acceptOwnerOrder(selectedOrder.id, {
        deliveryFeeUsd: Number(parsedFeeUsd.toFixed(2)),
        estimatedDeliveryTime: estimatedDeliveryInput.trim(),
        ownerMessage: ownerMessageInput.trim() || undefined,
      });
      if (!res.ok) {
        setOrderActionError(res.error ?? 'Unable to accept order.');
      }
    } finally {
      setIsProcessingOrderAction(false);
    }
  };

  const handleUpdateStatus = async (status: OrderStatus) => {
    if (!selectedOrder) return;
    setOrderActionError(null);
    setIsProcessingOrderAction(true);
    try {
      const res = await updateOwnerOrderStatus(selectedOrder.id, {
        status,
        estimatedDeliveryTime: estimatedDeliveryInput.trim() || undefined,
        ownerMessage: ownerMessageInput.trim() || undefined,
      });
      if (!res.ok) {
        setOrderActionError(res.error ?? 'Unable to update order status.');
      }
    } finally {
      setIsProcessingOrderAction(false);
    }
  };

  const handleUpdatePayment = async (paymentStatus: PaymentStatus) => {
    if (!selectedOrder) return;
    setOrderActionError(null);
    setIsProcessingOrderAction(true);
    try {
      const res = await updateOwnerPaymentStatus(selectedOrder.id, paymentStatus);
      if (!res.ok) {
        setOrderActionError(res.error ?? 'Unable to update payment status.');
      }
    } finally {
      setIsProcessingOrderAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F1E8] text-[#302923]">
      {/* Owner Workspace Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E4D8C5] bg-[#FCF9F4]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-serif text-xl font-medium tracking-[0.12em] text-[#302923] whitespace-nowrap">
              VEY RASHA
            </span>
            <span className="hidden text-xs text-[#8C6D46] sm:inline whitespace-nowrap">
              Private Atelier Workspace
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentOwnerDevice && (
              <span className="hidden items-center gap-1.5 rounded-full border border-[#E4D8C5] bg-[#F6F1E8] px-3 py-1 text-[11px] font-medium text-[#665B51] lg:inline-flex">
                <Smartphone className="h-3 w-3 text-[#8C6D46]" strokeWidth={1.6} />
                <span>
                  Device {currentOwnerDevice.slot}/2 · {currentOwnerDevice.deviceLabel}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={closeOwnerDashboard}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-3.5 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA] whitespace-nowrap"
            >
              <Store className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span className="hidden sm:inline">Return to Storefront</span>
              <span className="sm:hidden">Storefront</span>
            </button>
            <button
              type="button"
              onClick={() => void signOutOwnerSession()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#302923] px-3.5 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35] whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        {/* Owner Sidebar Navigation */}
        <aside className="lg:col-span-3">
          <nav
            aria-label="Owner Dashboard Sections"
            className="flex gap-2 overflow-x-auto pb-2 no-scrollbar lg:flex-col lg:overflow-visible"
          >
            {OWNER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`inline-flex min-h-[44px] shrink-0 items-center justify-between gap-2.5 rounded-xl px-4 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#302923] text-[#F6F1E8]'
                      : 'border border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:border-[#B59972] hover:text-[#302923] lg:border-transparent lg:bg-transparent'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'orders' && pendingReviewCount > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                        active ? 'bg-[#F6F1E8] text-[#302923]' : 'bg-[#302923] text-[#F6F1E8]'
                      }`}
                    >
                      {pendingReviewCount}
                    </span>
                  )}
                  {item.id === 'security' && ownerSecurity && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                        active ? 'bg-[#F6F1E8] text-[#302923]' : 'bg-[#EFE7DA] text-[#302923]'
                      }`}
                    >
                      {ownerSecurity.activeDeviceCount}/2
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Workspace Section */}
        <main className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-5 sm:p-8 lg:col-span-9">
          {/* =================================================================
              1. OVERVIEW
             ================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E4D8C5] pb-5">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                    Boutique Overview
                  </p>
                  <h1 className="mt-1 font-serif text-3xl font-medium text-[#302923]">
                    {storeSettings.boutiqueName}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetProductForm();
                    setActiveSection('add_product');
                  }}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#302923] px-5 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
                >
                  <PackagePlus className="h-3.5 w-3.5" strokeWidth={1.7} />
                  <span>Add New Piece</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('PENDING_REVIEW');
                    setActiveSection('orders');
                  }}
                  className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-left transition-colors hover:border-[#B59972] sm:p-5"
                >
                  <p className="text-xs text-[#665B51]">Pending Review</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {pendingReviewCount}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('orders')}
                  className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-left transition-colors hover:border-[#B59972] sm:p-5"
                >
                  <p className="text-xs text-[#665B51]">Confirmed Volume</p>
                  <p className="mt-1 font-serif text-2xl font-medium text-[#302923] tabular-nums sm:text-3xl">
                    {formatPrice(confirmedRevenueUsd, 'USD')}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('orders')}
                  className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-left transition-colors hover:border-[#B59972] sm:p-5"
                >
                  <p className="text-xs text-[#665B51]">Total Orders</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {ownerOrders.length}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('products')}
                  className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-left transition-colors hover:border-[#B59972] sm:p-5"
                >
                  <p className="text-xs text-[#665B51]">Active Catalog Pieces</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {products.length}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('inventory')}
                  className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-left transition-colors hover:border-[#B59972] sm:p-5"
                >
                  <p className="text-xs text-[#665B51]">Low / Out of Stock</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {lowOrOutCount}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('security')}
                  className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-left transition-colors hover:border-[#B59972] sm:p-5"
                >
                  <p className="text-xs text-[#665B51]">Authorized Devices</p>
                  <p className="mt-1 font-serif text-3xl font-medium text-[#302923] tabular-nums">
                    {ownerSecurity?.activeDeviceCount ?? 1} / 2
                  </p>
                </button>
              </div>

              {pendingReviewCount > 0 && (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#D8C3A5] bg-[#EFE7DA]/70 p-4 sm:flex-row sm:items-center">
                  <p className="text-sm text-[#302923]">
                    You have <strong>{pendingReviewCount}</strong> customer order{' '}
                    {pendingReviewCount === 1 ? 'request' : 'requests'} awaiting delivery fee
                    confirmation.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('PENDING_REVIEW');
                      setActiveSection('orders');
                    }}
                    className="min-h-[40px] rounded-full bg-[#302923] px-5 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
                  >
                    Review Pending Orders
                  </button>
                </div>
              )}

              {ownerOrders.length > 0 && (
                <div>
                  <h2 className="font-serif text-xl font-medium text-[#302923]">
                    Recent Order Activity
                  </h2>
                  <div className="mt-3 divide-y divide-[#E4D8C5] rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/50 px-4">
                    {ownerOrders.slice(0, 4).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter('ALL');
                          setSelectedOrderId(o.id);
                          setActiveSection('orders');
                        }}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left text-xs hover:text-[#8C6D46]"
                      >
                        <div>
                          <p className="font-semibold text-[#302923] tabular-nums">
                            {o.orderReference} · {o.customer.fullName}
                          </p>
                          <p className="text-[#665B51]">
                            {o.customer.city}, {o.customer.country}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-[#8C6D46]">
                            {ORDER_STATUS_LABELS[o.status]}
                          </p>
                          <p className="font-semibold text-[#302923] tabular-nums">
                            {formatPrice(o.finalTotalUsd ?? o.subtotalUsd, 'USD')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              2. ORDERS
             ================================================================= */}
          {activeSection === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-3 border-b border-[#E4D8C5] pb-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                    Order Management
                  </p>
                  <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    Customer Order Requests
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshOwnerOrders()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoadingOwnerOrders ? 'animate-spin' : ''}`}
                    strokeWidth={1.6}
                  />
                  <span>Refresh Orders</span>
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {ALL_STATUS_FILTERS.map((item) => {
                  const active = statusFilter === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStatusFilter(item.value)}
                      className={`min-h-[38px] shrink-0 rounded-full px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#302923] text-[#F6F1E8]'
                          : 'border border-[#E4D8C5] bg-[#F6F1E8] text-[#665B51] hover:text-[#302923]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/60 p-10 text-center">
                  <p className="font-serif text-xl font-medium text-[#302923]">
                    No orders in this view
                  </p>
                  <p className="mt-1 text-xs text-[#665B51]">
                    New customer order requests submitted at checkout will appear here immediately.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="space-y-3 xl:col-span-5">
                    {filteredOrders.map((order) => {
                      const active = selectedOrder?.id === order.id;
                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className={`w-full rounded-xl border p-4 text-left transition-colors ${
                            active
                              ? 'border-[#302923] bg-[#EFE7DA]'
                              : 'border-[#E4D8C5] bg-[#F6F1E8]/70 hover:border-[#B59972]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#302923] tabular-nums">
                              {order.orderReference}
                            </span>
                            <span className="font-medium text-[#8C6D46]">
                              {ORDER_STATUS_LABELS[order.status]}
                            </span>
                          </div>
                          <p className="mt-1 font-serif text-lg font-medium text-[#302923]">
                            {order.customer.fullName}
                          </p>
                          <p className="text-xs text-[#665B51]">
                            {order.customer.city}, {order.customer.country}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-xs text-[#665B51]">
                            <span>
                              {order.items.reduce((sum, i) => sum + i.quantity, 0)} piece(s)
                            </span>
                            <span className="font-semibold text-[#302923] tabular-nums">
                              Subtotal {formatPrice(order.subtotalUsd, 'USD')}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedOrder && (
                    <div className="space-y-5 rounded-2xl border border-[#D8C3A5] bg-[#F6F1E8]/60 p-5 sm:p-6 xl:col-span-7">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4D8C5] pb-4">
                        <div>
                          <p className="text-xs text-[#665B51] tabular-nums">
                            {selectedOrder.orderReference} ·{' '}
                            {formatOrderDate(selectedOrder.createdAt)}
                          </p>
                          <h3 className="mt-1 font-serif text-2xl font-medium text-[#302923]">
                            {ORDER_STATUS_LABELS[selectedOrder.status]}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#665B51]">
                            Payment:{' '}
                            <strong className="text-[#302923]">
                              {PAYMENT_STATUS_LABELS[selectedOrder.paymentStatus]}
                            </strong>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setReceiptOrder(selectedOrder)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-1.5 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                        >
                          <Printer className="h-3.5 w-3.5" strokeWidth={1.6} />
                          <span>
                            {selectedOrder.status === 'PENDING_REVIEW'
                              ? 'Order Request Summary'
                              : 'Confirmed Receipt'}
                          </span>
                        </button>
                      </div>

                      <div className="rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] p-4 text-xs leading-relaxed">
                        <p className="font-semibold tracking-wider text-[#8C6D46] uppercase">
                          Customer &amp; Address Details
                        </p>
                        <div className="mt-2 space-y-1 text-[#302923]">
                          <p>
                            <span className="text-[#665B51]">Customer: </span>
                            <strong>{selectedOrder.customer.fullName}</strong>
                          </p>
                          <p>
                            <span className="text-[#665B51]">Phone: </span>
                            {selectedOrder.customer.phone}
                          </p>
                          <p>
                            <span className="text-[#665B51]">Country &amp; City: </span>
                            {selectedOrder.customer.city}, {selectedOrder.customer.country}
                          </p>
                          <p>
                            <span className="text-[#665B51]">Area / Neighborhood: </span>
                            {selectedOrder.customer.area}
                          </p>
                          <p>
                            <span className="text-[#665B51]">Complete Address: </span>
                            {selectedOrder.customer.deliveryAddress}
                          </p>
                          {selectedOrder.customer.deliveryInstructions && (
                            <p>
                              <span className="text-[#665B51]">Instructions: </span>
                              {selectedOrder.customer.deliveryInstructions}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                          Ordered Pieces
                        </p>
                        <ul className="divide-y divide-[#E4D8C5] rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-4">
                          {selectedOrder.items.map((item, idx) => (
                            <li
                              key={`${selectedOrder.id}-item-${idx}`}
                              className="flex items-center gap-3 py-3"
                            >
                              <div className="aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg bg-[#EFE7DA]">
                                <LuxuryImage
                                  src={item.image}
                                  alt={item.productName}
                                  className="h-full w-full"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-serif text-base font-medium text-[#302923]">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-[#665B51]">
                                  Size {item.size} · {item.colorName} · Qty {item.quantity} ×{' '}
                                  {formatPrice(item.unitPriceUsd, 'USD')}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-[#302923] tabular-nums">
                                {formatPrice(item.lineTotalUsd, 'USD')}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {orderActionError && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs text-[#302923]"
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                          <span>{orderActionError}</span>
                        </div>
                      )}

                      {selectedOrder.status === 'PENDING_REVIEW' ? (
                        <form
                          onSubmit={(e) => void handleAcceptOrder(e)}
                          className="space-y-4 rounded-xl border border-[#D8C3A5] bg-[#FCF9F4] p-4 sm:p-5"
                        >
                          <p className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                            Confirm Delivery Fee &amp; Accept Order
                          </p>

                          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="owner-delivery-fee"
                                className="mb-1.5 block text-xs font-medium text-[#302923]"
                              >
                                Delivery Fee (USD) <span className="text-[#8C6D46]">*</span>
                              </label>
                              <input
                                id="owner-delivery-fee"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                placeholder="e.g. 25"
                                value={deliveryFeeInput}
                                onChange={(e) => setDeliveryFeeInput(e.target.value)}
                                className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] tabular-nums focus:border-[#B59972] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="owner-est-delivery"
                                className="mb-1.5 block text-xs font-medium text-[#302923]"
                              >
                                Estimated Delivery Time <span className="text-[#8C6D46]">*</span>
                              </label>
                              <input
                                id="owner-est-delivery"
                                type="text"
                                required
                                placeholder="e.g. 2–4 business days"
                                value={estimatedDeliveryInput}
                                onChange={(e) => setEstimatedDeliveryInput(e.target.value)}
                                className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label
                                htmlFor="owner-message"
                                className="mb-1.5 block text-xs font-medium text-[#302923]"
                              >
                                Message to Customer (Optional)
                              </label>
                              <textarea
                                id="owner-message"
                                rows={2}
                                placeholder="Add delivery notes, courier instructions, or payment guidance"
                                value={ownerMessageInput}
                                onChange={(e) => setOwnerMessageInput(e.target.value)}
                                className="w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                              />
                            </div>
                          </div>

                          <dl className="space-y-1.5 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4 text-sm">
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Product Subtotal</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {formatPrice(selectedOrder.subtotalUsd, 'USD')}
                              </dd>
                            </div>
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Delivery Fee</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {hasValidFee ? formatPrice(parsedFeeUsd, 'USD') : '—'}
                              </dd>
                            </div>
                            <div className="flex justify-between border-t border-[#E4D8C5] pt-2 text-base font-semibold text-[#302923]">
                              <dt>Final Total</dt>
                              <dd className="tabular-nums">
                                {computedFinalTotalUsd !== null
                                  ? formatPrice(computedFinalTotalUsd, 'USD')
                                  : 'Enter delivery fee'}
                              </dd>
                            </div>
                          </dl>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="submit"
                              disabled={isProcessingOrderAction || !hasValidFee}
                              className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-[#302923] px-6 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35] disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-4 w-4" strokeWidth={1.6} />
                              <span>
                                {isProcessingOrderAction ? 'Confirming...' : 'Accept Order'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingOrderAction}
                              onClick={() => void handleUpdateStatus('CANCELLED')}
                              className="min-h-[46px] rounded-full border border-[#D8C3A5] px-5 py-2.5 text-xs font-medium text-[#665B51] hover:bg-[#EFE7DA] hover:text-[#302923]"
                            >
                              Decline / Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-4 rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] p-4 sm:p-5">
                          <dl className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Product Subtotal</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {formatPrice(selectedOrder.subtotalUsd, 'USD')}
                              </dd>
                            </div>
                            <div className="flex justify-between text-[#665B51]">
                              <dt>Confirmed Delivery Fee</dt>
                              <dd className="font-medium text-[#302923] tabular-nums">
                                {selectedOrder.deliveryFeeUsd !== null
                                  ? formatPrice(selectedOrder.deliveryFeeUsd, 'USD')
                                  : '—'}
                              </dd>
                            </div>
                            <div className="flex justify-between border-t border-[#E4D8C5] pt-2 text-base font-semibold text-[#302923]">
                              <dt>Confirmed Final Total</dt>
                              <dd className="tabular-nums">
                                {selectedOrder.finalTotalUsd !== null
                                  ? formatPrice(selectedOrder.finalTotalUsd, 'USD')
                                  : '—'}
                              </dd>
                            </div>
                          </dl>

                          <div className="border-t border-[#E4D8C5] pt-4">
                            <p className="mb-2 text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                              Update Fulfillment Status
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {FULFILLMENT_STATUS_OPTIONS.map((statusOption) => {
                                const isCurrent = selectedOrder.status === statusOption;
                                return (
                                  <button
                                    key={statusOption}
                                    type="button"
                                    disabled={isProcessingOrderAction || isCurrent}
                                    onClick={() => void handleUpdateStatus(statusOption)}
                                    className={`min-h-[38px] rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                      isCurrent
                                        ? 'bg-[#302923] text-[#F6F1E8]'
                                        : 'border border-[#D8C3A5] bg-[#F6F1E8] text-[#302923] hover:bg-[#EFE7DA]'
                                    }`}
                                  >
                                    {ORDER_STATUS_LABELS[statusOption]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-t border-[#E4D8C5] pt-4">
                            <p className="mb-2 text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                              Payment Status
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {PAYMENT_STATUS_OPTIONS.map((payOption) => {
                                const isCurrent = selectedOrder.paymentStatus === payOption;
                                return (
                                  <button
                                    key={payOption}
                                    type="button"
                                    disabled={isProcessingOrderAction || isCurrent}
                                    onClick={() => void handleUpdatePayment(payOption)}
                                    className={`min-h-[38px] rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                      isCurrent
                                        ? 'bg-[#8C6D46] text-[#F6F1E8]'
                                        : 'border border-[#D8C3A5] bg-[#F6F1E8] text-[#302923] hover:bg-[#EFE7DA]'
                                    }`}
                                  >
                                    {PAYMENT_STATUS_LABELS[payOption]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              3. PRODUCTS CATALOG
             ================================================================= */}
          {activeSection === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4D8C5] pb-4">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                    Catalog Management
                  </p>
                  <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    Boutique Pieces ({products.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetProductForm();
                    setActiveSection('add_product');
                  }}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#302923] px-5 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.7} />
                  <span>Add Piece</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="flex gap-4 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-4"
                  >
                    <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-lg border border-[#E4D8C5] bg-[#EFE7DA]">
                      <LuxuryImage
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <p className="text-[11px] font-medium tracking-wider text-[#8C6D46] uppercase">
                          {product.categoryLabel}
                        </p>
                        <h3 className="truncate font-serif text-lg font-medium text-[#302923]">
                          {product.name}
                        </h3>
                        <p className="text-xs text-[#665B51] tabular-nums">
                          {formatPrice(product.priceUsd, 'USD')} · Stock: {product.stockCount}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProductEditor(product)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-3.5 py-1.5 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                        >
                          <Edit3 className="h-3.5 w-3.5" strokeWidth={1.6} />
                          <span>Edit</span>
                        </button>

                        {confirmDeleteProductId === product.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                void deleteOwnerProduct(product.id);
                                setConfirmDeleteProductId(null);
                              }}
                              className="min-h-[36px] rounded-full bg-[#302923] px-3.5 py-1.5 text-xs font-medium text-[#F6F1E8]"
                            >
                              Confirm Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProductId(null)}
                              className="min-h-[36px] rounded-full border border-[#E4D8C5] px-3 py-1.5 text-xs text-[#665B51]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProductId(product.id)}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#E4D8C5] px-3 py-1.5 text-xs font-medium text-[#665B51] hover:border-[#302923] hover:text-[#302923]"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              4. ADD / EDIT PRODUCT
             ================================================================= */}
          {activeSection === 'add_product' && (
            <form onSubmit={(e) => void handleSaveProduct(e)} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4D8C5] pb-4">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                    Catalog Studio
                  </p>
                  <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    {editingProductId ? 'Edit Boutique Piece' : 'Add New Boutique Piece'}
                  </h2>
                </div>
                {editingProductId && (
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className="min-h-[38px] rounded-full border border-[#D8C3A5] px-4 py-1.5 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                  >
                    Switch to New Piece
                  </button>
                )}
              </div>

              {prodFormError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs text-[#302923]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                  <span>{prodFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Piece Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Élodie Pleated Silk Dress"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Subtitle / Fabric Finish *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Champagne Bias Satin"
                    value={prodSubtitle}
                    onChange={(e) => setProdSubtitle(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Category *
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) =>
                      setProdCategory(e.target.value as Exclude<CategorySlug, 'all'>)
                    }
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Collection Capsule
                  </label>
                  <select
                    value={prodCollectionId}
                    onChange={(e) => setProdCollectionId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  >
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Price (USD) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    placeholder="e.g. 680"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] tabular-nums focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Initial Stock Count *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={prodStockCount}
                    onChange={(e) => setProdStockCount(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] tabular-nums focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Material Composition *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100% Mulberry Silk"
                    value={prodMaterial}
                    onChange={(e) => setProdMaterial(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Atelier Care Instructions *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Specialist dry clean only"
                    value={prodCare}
                    onChange={(e) => setProdCare(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Editorial Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe silhouette, drape, tailoring, and craftsmanship..."
                    value={prodDescription}
                    onChange={(e) => setProdDescription(e.target.value)}
                    className="w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>
              </div>

              {/* Sizes */}
              <div className="space-y-2 border-t border-[#E4D8C5] pt-5">
                <p className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                  Available Sizes
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set([...STANDARD_SIZES, ...prodSizes])).map((sz) => {
                    const selected = prodSizes.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => toggleProductSize(sz)}
                        className={`min-h-[38px] rounded-lg border px-3.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-[#302923] bg-[#302923] text-[#F6F1E8]'
                            : 'border-[#E4D8C5] bg-[#F6F1E8] text-[#302923]'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom size (e.g. 38)"
                    value={customSizeInput}
                    onChange={(e) => setCustomSizeInput(e.target.value)}
                    className="h-10 max-w-xs rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3 text-xs text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSize}
                    className="min-h-[40px] rounded-full border border-[#D8C3A5] px-4 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                  >
                    Add Size
                  </button>
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-3 border-t border-[#E4D8C5] pt-5">
                <p className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                  Colours
                </p>
                <div className="flex flex-wrap gap-2">
                  {prodColors.map((col) => (
                    <span
                      key={col.name}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-3 py-1.5 text-xs text-[#302923]"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-[#302923]/20"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span>{col.name}</span>
                      {prodColors.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setProdColors((prev) => prev.filter((c) => c.name !== col.name))
                          }
                          aria-label={`Remove colour ${col.name}`}
                          className="text-[#665B51] hover:text-[#302923]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Colour name (e.g. Deep Espresso)"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    className="h-10 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3 text-xs text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                  <input
                    type="color"
                    aria-label="Colour swatch hex"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-[#E4D8C5] bg-[#F6F1E8] p-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="min-h-[40px] rounded-full border border-[#D8C3A5] px-4 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                  >
                    Add Colour
                  </button>
                </div>
              </div>

              {/* Images */}
              <div className="space-y-3 border-t border-[#E4D8C5] pt-5">
                <p className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                  Product Photography ({prodImages.length} selected)
                </p>
                <div className="flex flex-wrap gap-3">
                  {prodImages.map((imgUrl, idx) => (
                    <div key={`${imgUrl}-${idx}`} className="relative w-20">
                      <div className="aspect-[4/5] overflow-hidden rounded-lg border border-[#D8C3A5] bg-[#EFE7DA]">
                        <LuxuryImage src={imgUrl} alt={`Selected view ${idx + 1}`} className="h-full w-full" />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setProdImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label="Remove image"
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#302923] text-[#F6F1E8]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="mb-2 text-xs text-[#665B51]">Quick-add from Atelier Gallery:</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_GALLERY.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => {
                          if (!prodImages.includes(preset.url)) {
                            setProdImages((prev) => [...prev, preset.url]);
                          }
                        }}
                        className="min-h-[34px] rounded-full border border-[#E4D8C5] bg-[#F6F1E8] px-3 py-1 text-[11px] font-medium text-[#302923] hover:border-[#B59972]"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Or paste HTTPS image URL"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    className="h-10 min-w-[220px] flex-1 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3 text-xs text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomImage}
                    className="min-h-[40px] rounded-full border border-[#D8C3A5] px-4 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                  >
                    Add Photo URL
                  </button>
                </div>
              </div>

              {/* Merchandising Flags */}
              <div className="flex flex-wrap gap-6 border-t border-[#E4D8C5] pt-5 text-xs text-[#302923]">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prodIsNew}
                    onChange={(e) => setProdIsNew(e.target.checked)}
                    className="h-4 w-4 accent-[#302923]"
                  />
                  <span>Feature in New Arrivals</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prodIsBest}
                    onChange={(e) => setProdIsBest(e.target.checked)}
                    className="h-4 w-4 accent-[#302923]"
                  />
                  <span>Feature in Best Sellers</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="min-h-[46px] rounded-full bg-[#302923] px-7 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35] disabled:opacity-60"
                >
                  {isSavingProduct
                    ? 'Saving Piece...'
                    : editingProductId
                    ? 'Save Product Changes'
                    : 'Publish Piece to Boutique'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetProductForm();
                    setActiveSection('products');
                  }}
                  className="min-h-[46px] rounded-full border border-[#D8C3A5] px-5 py-2.5 text-xs font-medium text-[#665B51] hover:text-[#302923]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* =================================================================
              5. INVENTORY MANAGEMENT
             ================================================================= */}
          {activeSection === 'inventory' && (
            <div className="space-y-6">
              <div className="border-b border-[#E4D8C5] pb-4">
                <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                  Atelier Stock Control
                </p>
                <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                  Inventory Levels
                </h2>
              </div>

              <div className="divide-y divide-[#E4D8C5] rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/60">
                {products.map((product) => {
                  const statusLabel =
                    product.stockStatus === 'in_stock'
                      ? 'In Stock'
                      : product.stockStatus === 'low_stock'
                      ? 'Low Stock'
                      : 'Out of Stock';
                  return (
                    <div
                      key={product.id}
                      className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg bg-[#EFE7DA]">
                          <LuxuryImage
                            src={product.images[0]}
                            alt={product.name}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-serif text-base font-medium text-[#302923]">
                            {product.name}
                          </p>
                          <p className="text-xs text-[#665B51]">
                            {product.categoryLabel} ·{' '}
                            <span className="font-medium text-[#8C6D46]">{statusLabel}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Stock count for ${product.name}`}
                          value={stockDrafts[product.id] ?? String(product.stockCount)}
                          onChange={(e) =>
                            setStockDrafts((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="h-10 w-20 rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-center text-sm text-[#302923] tabular-nums focus:border-[#B59972] focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={savingStockId === product.id}
                          onClick={() => void handleSaveStock(product.id)}
                          className="min-h-[40px] rounded-full bg-[#302923] px-4 py-1.5 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35] disabled:opacity-60"
                        >
                          {savingStockId === product.id ? 'Saving...' : 'Update Stock'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              6. CUSTOMERS (REAL SUBMITTED ORDER CLIENTS ONLY)
             ================================================================= */}
          {activeSection === 'customers' && (
            <div className="space-y-6">
              <div className="border-b border-[#E4D8C5] pb-4">
                <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                  Client Directory
                </p>
                <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                  Active Clients ({customerRoster.length})
                </h2>
              </div>

              {customerRoster.length === 0 ? (
                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/60 p-10 text-center">
                  <p className="font-serif text-xl font-medium text-[#302923]">
                    No client records yet
                  </p>
                  <p className="mt-1 text-xs text-[#665B51]">
                    Clients appear here automatically as order requests are placed at checkout.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {customerRoster.map((client) => (
                    <div
                      key={client.key}
                      className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-serif text-lg font-medium text-[#302923]">
                            {client.fullName}
                          </h3>
                          <p className="text-xs text-[#665B51]">{client.phone}</p>
                        </div>
                        <span className="rounded-full bg-[#EFE7DA] px-2.5 py-0.5 text-[11px] font-medium text-[#302923] tabular-nums">
                          {client.orderCount} {client.orderCount === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#665B51]">
                        {client.city}, {client.country}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-[#E4D8C5] pt-2.5 text-xs">
                        <span className="text-[#665B51]">
                          Latest: {formatOrderDate(client.latestOrderAt)}
                        </span>
                        <span className="font-semibold text-[#302923] tabular-nums">
                          {formatPrice(client.totalSpendUsd, 'USD')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              7. PROMOTIONS & EDITORIAL CAMPAIGNS
             ================================================================= */}
          {activeSection === 'promotions' && (
            <div className="space-y-8">
              <div className="border-b border-[#E4D8C5] pb-4">
                <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                  Editorial Merchandising
                </p>
                <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                  Campaigns &amp; Featured Capsules
                </h2>
              </div>

              {primaryCampaign && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSavingCampaign(true);
                    try {
                      await updateOwnerCampaign(primaryCampaign.id, {
                        kicker: campKicker.trim(),
                        title: campTitle.trim(),
                        description: campDesc.trim(),
                        ctaLabel: campCta.trim(),
                        targetCategory: campCat,
                        image: campImage.trim(),
                      });
                    } finally {
                      setIsSavingCampaign(false);
                    }
                  }}
                  className="space-y-4 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-5"
                >
                  <h3 className="font-serif text-xl font-medium text-[#302923]">
                    Primary Home Lookbook Banner
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#302923]">
                        Kicker Label
                      </label>
                      <input
                        type="text"
                        value={campKicker}
                        onChange={(e) => setCampKicker(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-sm text-[#302923]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#302923]">
                        CTA Button Label
                      </label>
                      <input
                        type="text"
                        value={campCta}
                        onChange={(e) => setCampCta(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-sm text-[#302923]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-[#302923]">
                        Headline
                      </label>
                      <input
                        type="text"
                        value={campTitle}
                        onChange={(e) => setCampTitle(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-sm text-[#302923]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-[#302923]">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        value={campDesc}
                        onChange={(e) => setCampDesc(e.target.value)}
                        className="w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] p-3 text-sm text-[#302923]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#302923]">
                        Target Category
                      </label>
                      <select
                        value={campCat}
                        onChange={(e) => setCampCat(e.target.value as CategorySlug)}
                        className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-sm text-[#302923]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#302923]">
                        Campaign Image Path / URL
                      </label>
                      <input
                        type="text"
                        value={campImage}
                        onChange={(e) => setCampImage(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-sm text-[#302923]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCampaign}
                    className="min-h-[42px] rounded-full bg-[#302923] px-6 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35] disabled:opacity-60"
                  >
                    {isSavingCampaign ? 'Updating...' : 'Save Campaign Feature'}
                  </button>
                </form>
              )}

              <div>
                <h3 className="font-serif text-xl font-medium text-[#302923]">
                  Featured Collections
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {collections.map((col) => (
                    <div
                      key={col.id}
                      className="flex flex-col justify-between rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-4"
                    >
                      <div>
                        <p className="text-[11px] font-medium tracking-wider text-[#8C6D46] uppercase">
                          {col.season}
                        </p>
                        <h4 className="mt-1 font-serif text-lg font-medium text-[#302923]">
                          {col.title}
                        </h4>
                        <p className="mt-1 text-xs text-[#665B51] line-clamp-3">{col.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingCol(col)}
                        className="mt-4 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-1.5 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                      >
                        <Edit3 className="h-3.5 w-3.5" strokeWidth={1.6} />
                        <span>Edit Capsule</span>
                      </button>
                    </div>
                  ))}
                </div>

                {editingCol && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSavingCollection(true);
                      try {
                        await updateOwnerCollection(editingCol.id, {
                          title: editingCol.title,
                          season: editingCol.season,
                          summary: editingCol.summary,
                          filterCategory: editingCol.filterCategory,
                        });
                        setEditingCol(null);
                      } finally {
                        setIsSavingCollection(false);
                      }
                    }}
                    className="mt-4 space-y-3 rounded-xl border border-[#D8C3A5] bg-[#EFE7DA]/50 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-serif text-lg font-medium text-[#302923]">
                        Editing Capsule: {editingCol.title}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingCol(null)}
                        className="text-xs text-[#665B51] hover:text-[#302923]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={editingCol.title}
                        onChange={(e) =>
                          setEditingCol({ ...editingCol, title: e.target.value })
                        }
                        placeholder="Capsule title"
                        className="h-10 rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-sm"
                      />
                      <input
                        type="text"
                        value={editingCol.season}
                        onChange={(e) =>
                          setEditingCol({ ...editingCol, season: e.target.value })
                        }
                        placeholder="Season label"
                        className="h-10 rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3 text-sm"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={editingCol.summary}
                      onChange={(e) =>
                        setEditingCol({ ...editingCol, summary: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] p-3 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={isSavingCollection}
                      className="min-h-[40px] rounded-full bg-[#302923] px-5 py-2 text-xs font-medium text-[#F6F1E8]"
                    >
                      {isSavingCollection ? 'Saving...' : 'Save Capsule Changes'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              8. NOTIFICATIONS & CLIENT ANNOUNCEMENTS
             ================================================================= */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div className="border-b border-[#E4D8C5] pb-4">
                <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                  Client Communications
                </p>
                <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                  Boutique Announcements
                </h2>
                <p className="mt-1 text-xs text-[#665B51]">
                  Publish seasonal previews or service notices directly to connected client
                  notifications.
                </p>
              </div>

              {announceError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs text-[#302923]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                  <span>{announceError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => void handlePublishAnnouncement(e)}
                className="space-y-4 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/70 p-5"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Announcement Headline *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Private Autumn Silk Capsule Now Available"
                    value={announceTitle}
                    onChange={(e) => setAnnounceTitle(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3.5 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Client Message *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Share arrival notes, seasonal hours, or collection highlights..."
                    value={announceMessage}
                    onChange={(e) => setAnnounceMessage(e.target.value)}
                    className="w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] p-3 text-sm text-[#302923] focus:border-[#B59972] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSendingAnnouncement}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#302923] px-6 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35] disabled:opacity-60"
                >
                  <Bell className="h-3.5 w-3.5" strokeWidth={1.7} />
                  <span>
                    {isSendingAnnouncement ? 'Publishing...' : 'Publish Boutique Update'}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* =================================================================
              9. STORE SETTINGS
             ================================================================= */}
          {activeSection === 'store_settings' && (
            <form onSubmit={(e) => void handleSaveSettings(e)} className="space-y-5">
              <div className="border-b border-[#E4D8C5] pb-4">
                <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                  Boutique Configuration
                </p>
                <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                  Store Settings
                </h2>
                <p className="mt-1 text-xs text-[#665B51]">
                  Single-boutique settings. Delivery fees remain individually confirmed by the
                  owner after reviewing each customer&apos;s delivery address.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Boutique Name
                  </label>
                  <input
                    type="text"
                    value={settingBoutiqueName}
                    onChange={(e) => setSettingBoutiqueName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Default Display Currency
                  </label>
                  <select
                    value={settingDefaultCurrency}
                    onChange={(e) => setSettingDefaultCurrency(e.target.value as CurrencyCode)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923]"
                  >
                    {storeSettings.supportedCurrencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#302923]">
                    <input
                      type="checkbox"
                      checked={settingGiftAvailable}
                      onChange={(e) => setSettingGiftAvailable(e.target.checked)}
                      className="h-4 w-4 accent-[#302923]"
                    />
                    <span>Offer Signature Gift Presentation at Shopping Bag</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Gift Presentation Label
                  </label>
                  <input
                    type="text"
                    value={settingGiftLabel}
                    onChange={(e) => setSettingGiftLabel(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[#302923]">
                    Atelier Appointment / Concierge Note
                  </label>
                  <textarea
                    rows={2}
                    value={settingPickupNote}
                    onChange={(e) => setSettingPickupNote(e.target.value)}
                    className="w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3 text-sm text-[#302923]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="min-h-[44px] rounded-full bg-[#302923] px-7 py-2.5 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35] disabled:opacity-60"
              >
                {isSavingSettings ? 'Saving Settings...' : 'Save Boutique Settings'}
              </button>
            </form>
          )}

          {/* =================================================================
              10. AUTHORIZED DEVICES & TWO-DEVICE SECURITY
             ================================================================= */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4D8C5] pb-4">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                    Device-Bound Access Control
                  </p>
                  <h2 className="mt-0.5 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    Authorized Owner Devices
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshOwnerSecurity()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-4 py-2 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
                  <span>Refresh Status</span>
                </button>
              </div>

              {securityError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs text-[#302923]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                  <span>{securityError}</span>
                </div>
              )}

              {/* Enrollment & Device Limit Banner */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4">
                  <p className="text-xs text-[#665B51]">Registered Devices</p>
                  <p className="mt-1 font-serif text-2xl font-medium text-[#302923] tabular-nums">
                    {ownerSecurity?.activeDeviceCount ?? 1} of 2 Maximum Slots Used
                  </p>
                  <p className="mt-1 text-xs text-[#665B51]">
                    Strict 2-device limit enforced atomically on the server.
                  </p>
                </div>

                <div className="rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-4">
                  <p className="text-xs text-[#665B51]">Enrollment Gate</p>
                  <p className="mt-1 font-serif text-2xl font-medium text-[#302923]">
                    {ownerSecurity?.enrollmentOpen ? 'One Slot Available' : 'Enrollment Closed'}
                  </p>
                  <p className="mt-1 text-xs text-[#665B51]">
                    {ownerSecurity?.enrollmentOpen
                      ? 'An unused enrollment code or active replacement code can claim the open slot.'
                      : 'Both slots are active. Any 3rd device is automatically rejected.'}
                  </p>
                </div>
              </div>

              {/* One-Time Generated Replacement Code Banner */}
              {generatedReplacement && (
                <div className="rounded-2xl border border-[#8C6D46] bg-[#EFE7DA] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                        Single-Use Replacement Code · Slot {generatedReplacement.slot}
                      </p>
                      <p className="mt-1 text-xs text-[#302923]">
                        Enter this code into the storefront search bar on your replacement phone. It
                        expires in 15 minutes and can only be used once.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGeneratedReplacement(null)}
                      className="text-xs text-[#665B51] hover:text-[#302923]"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <code className="rounded-xl border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-2 font-mono text-sm font-semibold tracking-wider text-[#302923]">
                      {generatedReplacement.code}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyReplacementCode()}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#302923] px-4 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
                    >
                      {copiedReplacement ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Slot 1 & Slot 2 Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {([1, 2] as OwnerDeviceSlot[]).map((slot) => {
                  const device = ownerSecurity?.devices.find((d) => d.slot === slot);
                  const isActiveSlot = Boolean(device);
                  const isCurrent = Boolean(
                    device?.isCurrentDevice ||
                      (currentOwnerDevice && currentOwnerDevice.slot === slot)
                  );

                  return (
                    <div
                      key={slot}
                      className="flex flex-col justify-between rounded-2xl border border-[#D8C3A5] bg-[#F6F1E8]/80 p-5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
                            Device Slot {slot}
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full bg-[#302923] px-2.5 py-0.5 text-[10px] font-semibold text-[#F6F1E8]">
                              This Device
                            </span>
                          ) : isActiveSlot ? (
                            <span className="rounded-full bg-[#EFE7DA] px-2.5 py-0.5 text-[10px] font-semibold text-[#302923]">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-full border border-[#E4D8C5] px-2.5 py-0.5 text-[10px] font-medium text-[#665B51]">
                              Vacant
                            </span>
                          )}
                        </div>

                        {device ? (
                          <div className="mt-3 space-y-1.5 text-xs text-[#665B51]">
                            <p className="font-serif text-lg font-medium text-[#302923]">
                              {device.deviceLabel}
                            </p>
                            <p>
                              Platform:{' '}
                              <strong className="text-[#302923]">
                                {device.platform === 'android-capacitor'
                                  ? 'Android Native Keystore'
                                  : 'WebCrypto Bound'}
                              </strong>
                            </p>
                            <p>
                              Enrolled: {formatOrderDate(device.enrolledAt)}
                            </p>
                            <p>
                              Last Active: {formatOrderDate(device.lastSeenAt)}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 text-xs leading-relaxed text-[#665B51]">
                            <p className="font-serif text-lg font-medium text-[#302923]">
                              Available Slot
                            </p>
                            <p className="mt-1">
                              {ownerSecurity?.activeReplacementCode?.targetSlot === slot
                                ? `Replacement code active until ${formatOrderDate(
                                    ownerSecurity.activeReplacementCode.expiresAt
                                  )}.`
                                : 'No device currently bound to this slot.'}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#E4D8C5] pt-4">
                        {device ? (
                          <>
                            {isCurrent && (
                              <button
                                type="button"
                                disabled={isSecurityBusy}
                                onClick={() => void handleRotateToken()}
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-3.5 py-1.5 text-xs font-medium text-[#302923] hover:bg-[#EFE7DA]"
                              >
                                <KeyRound className="h-3.5 w-3.5" strokeWidth={1.6} />
                                <span>Rotate Token</span>
                              </button>
                            )}

                            {confirmRevokeSlot === slot ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isSecurityBusy}
                                  onClick={() => void handleRevokeSlot(slot)}
                                  className="min-h-[38px] rounded-full bg-[#302923] px-4 py-1.5 text-xs font-semibold text-[#F6F1E8]"
                                >
                                  Confirm Revoke
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRevokeSlot(null)}
                                  className="min-h-[38px] rounded-full border border-[#E4D8C5] px-3.5 py-1.5 text-xs text-[#665B51]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isSecurityBusy}
                                onClick={() => setConfirmRevokeSlot(slot)}
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#D8C3A5] px-3.5 py-1.5 text-xs font-medium text-[#665B51] hover:border-[#302923] hover:text-[#302923]"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.6} />
                                <span>{isCurrent ? 'Revoke This Device' : 'Revoke Lost Device'}</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={isSecurityBusy}
                            onClick={() => void handleIssueReplacementCode(slot)}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#302923] px-4 py-2 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
                          >
                            <KeyRound className="h-3.5 w-3.5" strokeWidth={1.6} />
                            <span>Issue 15-Min Replacement Code</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Backend-Only Emergency Recovery Information */}
              <div className="rounded-xl border border-[#E4D8C5] bg-[#EFE7DA]/50 p-4 text-xs leading-relaxed text-[#665B51]">
                <p className="font-semibold text-[#302923]">
                  Emergency Recovery (Backend CLI / Host Secret Only)
                </p>
                <p className="mt-1">
                  If both registered phones are permanently lost, revoking both slots requires
                  server-side secret verification using{' '}
                  <code className="font-mono text-[#302923]">OWNER_RECOVERY_SECRET</code> via{' '}
                  <code className="font-mono text-[#302923]">npm run owner:recover</code> on the
                  backend host. Public storefront pages expose zero recovery controls.
                </p>
              </div>

              {/* Security Audit Log */}
              {ownerSecurity && ownerSecurity.auditLogs.length > 0 && (
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#302923]">
                    Security Audit Trail
                  </h3>
                  <div className="mt-3 divide-y divide-[#E4D8C5] rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/60 px-4">
                    {ownerSecurity.auditLogs.slice(0, 15).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-col justify-between gap-1 py-2.5 text-xs sm:flex-row sm:items-center"
                      >
                        <div>
                          <span className="font-semibold text-[#302923]">{entry.eventType}</span>
                          <span className="ml-2 text-[#665B51]">{entry.detail}</span>
                        </div>
                        <span className="shrink-0 text-[11px] text-[#665B51] tabular-nums">
                          {formatOrderDate(entry.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {receiptOrder && (
        <PrintableReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
};
