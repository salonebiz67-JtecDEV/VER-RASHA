import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EDITORIAL_CAMPAIGNS,
  FEATURED_COLLECTIONS,
  INITIAL_ADDRESSES,
  INITIAL_CUSTOMER,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  PRODUCTS,
} from '../data/catalog';
import { DEFAULT_STORE_SETTINGS } from '../data/storeConfig';
import { apiUrl, APP_BASE_PATH, wsUrl } from '../config/api';
import {
  buildSignedOwnerHeaders,
  clearNativeOwnerToken,
  getNativeOwnerToken,
  getOrCreateDeviceIdentity,
  saveNativeOwnerToken,
} from '../security/ownerDeviceStorage';
import type {
  AppRoute,
  CartItem,
  CategorySlug,
  Collection,
  ColorOption,
  CurrencyCode,
  CustomerProfile,
  EditorialCampaign,
  NotificationItem,
  OrderRecord,
  OrderRequestPayload,
  OrderStatus,
  OrderSubmissionResult,
  OwnerDeviceSlot,
  OwnerDeviceSummary,
  OwnerSecuritySummary,
  OwnerSessionInfo,
  PaymentStatus,
  Product,
  SavedAddress,
  StoreSettings,
} from '../types/boutique';

export type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest';
export type PriceBand = 'all' | 'under-450' | '450-900' | 'over-900';
export type BackendStatus = 'checking' | 'connected' | 'unavailable';

type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface ProductMutationInput {
  name: string;
  subtitle: string;
  category: Exclude<CategorySlug, 'all'>;
  collectionId: string;
  priceUsd: number;
  images: string[];
  description: string;
  material: string;
  care: string;
  sizes: string[];
  colors: ColorOption[];
  stockCount: number;
  isNewArrival: boolean;
  isBestSeller: boolean;
}

interface BoutiqueContextValue {
  route: AppRoute;
  selectedProductId: string;
  navigate: (route: AppRoute, options?: { productId?: string; category?: CategorySlug }) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeCategory: CategorySlug;
  setActiveCategory: (category: CategorySlug) => void;
  priceBand: PriceBand;
  setPriceBand: (band: PriceBand) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  resetExploreFilters: () => void;
  products: Product[];
  collections: Collection[];
  campaigns: EditorialCampaign[];
  storeSettings: StoreSettings;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  cart: CartItem[];
  addToCart: (product: Product, size: string, color: ColorOption, quantity?: number) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotalUsd: number;
  giftWrap: boolean;
  setGiftWrap: (val: boolean) => void;
  submitOrderRequest: (payload: OrderRequestPayload) => Promise<OrderSubmissionResult>;
  customer: CustomerProfile;
  updateCustomer: (patch: Partial<CustomerProfile>) => void;
  addresses: SavedAddress[];
  addAddress: (address: Omit<SavedAddress, 'id'>) => SavedAddress;
  updateAddress: (id: string, patch: Omit<SavedAddress, 'id'>) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  orders: OrderRecord[];
  isLoadingOrders: boolean;
  refreshOrders: () => Promise<void>;
  retrieveGuestOrder: (
    orderReference: string,
    phone: string
  ) => Promise<{ ok: boolean; order?: OrderRecord; error?: string }>;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isLoadingNotifications: boolean;
  notificationsError: string | null;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  browserNotificationPermission: BrowserNotificationPermission;
  requestBrowserNotifications: () => Promise<void>;

  // Private Two-Device Owner Dashboard State & Actions
  isOwnerAuthorized: boolean;
  isOwnerDashboardOpen: boolean;
  currentOwnerDevice: OwnerDeviceSummary | null;
  ownerSecurity: OwnerSecuritySummary | null;
  attemptSecretOwnerAccess: (candidateCode: string) => Promise<boolean>;
  openOwnerDashboard: () => void;
  closeOwnerDashboard: () => void;
  refreshOwnerSecurity: () => Promise<void>;
  rotateCurrentOwnerToken: () => Promise<{ ok: boolean; error?: string }>;
  revokeAuthorizedDevice: (slot: OwnerDeviceSlot) => Promise<{ ok: boolean; error?: string }>;
  generateReplacementDeviceCode: (
    targetSlot: OwnerDeviceSlot
  ) => Promise<{ ok: boolean; code?: string; expiresAt?: string; error?: string }>;
  signOutOwnerSession: () => Promise<void>;

  // Owner Management Operations
  ownerOrders: OrderRecord[];
  isLoadingOwnerOrders: boolean;
  refreshOwnerOrders: () => Promise<void>;
  acceptOwnerOrder: (
    orderId: string,
    payload: { deliveryFeeUsd: number; estimatedDeliveryTime: string; ownerMessage?: string }
  ) => Promise<{ ok: boolean; error?: string; order?: OrderRecord }>;
  updateOwnerOrderStatus: (
    orderId: string,
    payload: { status: OrderStatus; estimatedDeliveryTime?: string; ownerMessage?: string }
  ) => Promise<{ ok: boolean; error?: string; order?: OrderRecord }>;
  updateOwnerPaymentStatus: (
    orderId: string,
    paymentStatus: PaymentStatus
  ) => Promise<{ ok: boolean; error?: string; order?: OrderRecord }>;
  createOwnerProduct: (
    payload: ProductMutationInput
  ) => Promise<{ ok: boolean; error?: string; product?: Product }>;
  updateOwnerProduct: (
    productId: string,
    payload: Partial<ProductMutationInput>
  ) => Promise<{ ok: boolean; error?: string; product?: Product }>;
  deleteOwnerProduct: (productId: string) => Promise<{ ok: boolean; error?: string }>;
  updateOwnerInventory: (
    productId: string,
    stockCount: number
  ) => Promise<{ ok: boolean; error?: string }>;
  updateOwnerCampaign: (
    campaignId: string,
    payload: Partial<EditorialCampaign>
  ) => Promise<{ ok: boolean; error?: string }>;
  updateOwnerCollection: (
    collectionId: string,
    payload: Partial<Collection>
  ) => Promise<{ ok: boolean; error?: string }>;
  publishOwnerAnnouncement: (
    title: string,
    message: string
  ) => Promise<{ ok: boolean; error?: string }>;
  updateOwnerStoreSettings: (
    patch: Partial<StoreSettings>
  ) => Promise<{ ok: boolean; error?: string }>;

  backendStatus: BackendStatus;
  backendErrorMessage: string | null;
  checkBackendHealth: () => Promise<boolean>;
  toastMessage: string | null;
  showToast: (message: string) => void;
  isCatalogLoading: boolean;
  catalogError: string | null;
  retryCatalogLoad: () => void;
  simulateCatalogError: () => void;
}

const BoutiqueContext = createContext<BoutiqueContextValue | undefined>(undefined);

function upsertOrder(list: OrderRecord[], incoming: OrderRecord): OrderRecord[] {
  const exists = list.some((o) => o.id === incoming.id);
  if (exists) {
    return list.map((o) => (o.id === incoming.id ? incoming : o));
  }
  return [incoming, ...list];
}

function upsertNotification(
  list: NotificationItem[],
  incoming: NotificationItem
): NotificationItem[] {
  const exists = list.some((n) => n.id === incoming.id);
  if (exists) {
    return list.map((n) => (n.id === incoming.id ? incoming : n));
  }
  return [incoming, ...list];
}

function readBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

const PUBLIC_ROUTES: ReadonlySet<AppRoute> = new Set([
  'home',
  'explore',
  'wishlist',
  'cart',
  'checkout',
  'account',
  'notifications',
]);

function stripBaseFromPathname(pathname: string): string {
  const baseNoTrailing = APP_BASE_PATH === '/' ? '' : APP_BASE_PATH.slice(0, -1);
  let relative = pathname;
  if (baseNoTrailing && relative.toLowerCase().startsWith(baseNoTrailing.toLowerCase())) {
    relative = relative.slice(baseNoTrailing.length);
  }
  return relative.replace(/^\/+|\/+$/g, '');
}

function parseRouteFromLocation(): { route: AppRoute; productId: string } {
  if (typeof window === 'undefined') {
    return { route: 'home', productId: PRODUCTS[0].id };
  }
  const relative = stripBaseFromPathname(window.location.pathname);
  const hash = window.location.hash.toLowerCase();
  if (hash === '#/owner' || hash === '#owner' || relative.toLowerCase() === 'owner') {
    return { route: 'home', productId: PRODUCTS[0].id };
  }
  if (!relative || relative === 'home') {
    return { route: 'home', productId: PRODUCTS[0].id };
  }
  const segments = relative.split('/').filter(Boolean);
  if (segments[0] === 'product' && segments[1]) {
    return { route: 'product', productId: decodeURIComponent(segments[1]) };
  }
  const candidate = segments[0] as AppRoute;
  if (PUBLIC_ROUTES.has(candidate)) {
    return { route: candidate, productId: PRODUCTS[0].id };
  }
  return { route: 'home', productId: PRODUCTS[0].id };
}

function buildUrlForRoute(route: AppRoute, productId?: string): string {
  if (route === 'home' || route === 'owner') {
    return APP_BASE_PATH;
  }
  if (route === 'product' && productId) {
    return `${APP_BASE_PATH}product/${encodeURIComponent(productId)}`;
  }
  return `${APP_BASE_PATH}${route}`;
}

export const BoutiqueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialLocation = useMemo(() => parseRouteFromLocation(), []);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [collections, setCollections] = useState<Collection[]>(FEATURED_COLLECTIONS);
  const [campaigns, setCampaigns] = useState<EditorialCampaign[]>(EDITORIAL_CAMPAIGNS);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  const [route, setRoute] = useState<AppRoute>(initialLocation.route);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialLocation.productId);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategorySlug>('all');
  const [priceBand, setPriceBand] = useState<PriceBand>('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_STORE_SETTINGS.defaultCurrency);

  const [wishlistIds, setWishlistIds] = useState<string[]>([
    'vr-aurelia-gown',
    'vr-margaux-bag',
  ]);

  const [cart, setCart] = useState<CartItem[]>([
    {
      id: 'vr-celeste-midi::S::Champagne',
      productId: 'vr-celeste-midi',
      selectedSize: 'S',
      selectedColor: PRODUCTS[1].colors[0],
      quantity: 1,
    },
  ]);
  const [giftWrap, setGiftWrap] = useState(false);

  const [customer, setCustomer] = useState<CustomerProfile>(INITIAL_CUSTOMER);
  const [addresses, setAddresses] = useState<SavedAddress[]>(INITIAL_ADDRESSES);

  // In-memory customer Bearer token (never written to localStorage/sessionStorage)
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const customerTokenRef = useRef<string | null>(null);
  customerTokenRef.current = customerToken;

  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<BrowserNotificationPermission>(() => readBrowserNotificationPermission());

  // Device-bound Owner Security State (auth token held in HttpOnly cookie or Android Keystore)
  const [isOwnerAuthorized, setIsOwnerAuthorized] = useState(false);
  const [isOwnerDashboardOpen, setIsOwnerDashboardOpen] = useState(false);
  const [currentOwnerDevice, setCurrentOwnerDevice] = useState<OwnerDeviceSummary | null>(null);
  const [ownerSecurity, setOwnerSecurity] = useState<OwnerSecuritySummary | null>(null);
  const [ownerOrders, setOwnerOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOwnerOrders, setIsLoadingOwnerOrders] = useState(false);

  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [backendErrorMessage, setBackendErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const applyCatalogSnapshot = useCallback(
    (data: {
      products?: Product[];
      collections?: Collection[];
      campaigns?: EditorialCampaign[];
      storeSettings?: StoreSettings;
    }) => {
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.collections)) setCollections(data.collections);
      if (Array.isArray(data.campaigns)) setCampaigns(data.campaigns);
      if (data.storeSettings) setStoreSettings(data.storeSettings);
    },
    []
  );

  // Clean up any legacy owner hash or unknown subpath in URL without leaking owner entry
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const relative = stripBaseFromPathname(window.location.pathname).toLowerCase();
      if (hash === '#/owner' || hash === '#owner' || relative === 'owner') {
        window.history.replaceState(null, '', APP_BASE_PATH);
      }
    }
  }, []);

  const loadCatalogFromBackend = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl('/api/catalog'));
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as {
        products?: Product[];
        collections?: Collection[];
        campaigns?: EditorialCampaign[];
        storeSettings?: StoreSettings;
      };
      applyCatalogSnapshot(data);
      setBackendStatus('connected');
      setBackendErrorMessage(null);
      setCatalogError(null);
      return true;
    } catch {
      return false;
    }
  }, [applyCatalogSnapshot]);

  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    setBackendStatus('checking');
    try {
      const res = await fetch(apiUrl('/health'), { cache: 'no-store' });
      if (!res.ok) {
        setBackendStatus('unavailable');
        setBackendErrorMessage(
          'The boutique order & notification server is currently unavailable. Please retry in a moment.'
        );
        return false;
      }
      const data = (await res.json()) as { status?: string };
      if (data.status !== 'ok') {
        setBackendStatus('unavailable');
        setBackendErrorMessage(
          'The boutique backend returned an unexpected status. Please retry shortly.'
        );
        return false;
      }
      setBackendStatus('connected');
      setBackendErrorMessage(null);
      void loadCatalogFromBackend();
      return true;
    } catch {
      setBackendStatus('unavailable');
      setBackendErrorMessage(
        'Unable to reach the boutique backend server. Live orders and notifications require a connection.'
      );
      return false;
    }
  }, [loadCatalogFromBackend]);

  // Verify backend health and load live catalog snapshot on boot
  useEffect(() => {
    let active = true;
    const initBoot = async () => {
      try {
        const res = await fetch(apiUrl('/health'), { cache: 'no-store' });
        if (!active) return;
        if (res.ok) {
          setBackendStatus('connected');
          setBackendErrorMessage(null);
          await loadCatalogFromBackend();
        } else {
          setBackendStatus('unavailable');
          setBackendErrorMessage(
            'The boutique order & notification server is currently unavailable.'
          );
        }
      } catch {
        if (active) {
          setBackendStatus('unavailable');
          setBackendErrorMessage(
            'Unable to reach the boutique backend server. You can browse pieces while reconnecting.'
          );
        }
      }
    };
    void initBoot();
    return () => {
      active = false;
    };
  }, [loadCatalogFromBackend]);

  // Helper for signed, device-bound owner fetch calls
  // Signs the canonical API route path while targeting API_BASE_URL in production.
  const ownerFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const method = (init.method || 'GET').toUpperCase();
      const signedHeaders = await buildSignedOwnerHeaders(method, path);
      return fetch(apiUrl(path), {
        ...init,
        method,
        credentials: 'include',
        headers: {
          ...signedHeaders,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    },
    []
  );

  const handleUnauthorizedOwnerResponse = useCallback(() => {
    setIsOwnerAuthorized(false);
    setIsOwnerDashboardOpen(false);
    setCurrentOwnerDevice(null);
    setOwnerSecurity(null);
    setOwnerOrders([]);
  }, []);

  const refreshOwnerOrders = useCallback(async () => {
    setIsLoadingOwnerOrders(true);
    try {
      const res = await ownerFetch('/api/owner/orders');
      if (res.status === 401 || res.status === 403) {
        handleUnauthorizedOwnerResponse();
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { orders?: OrderRecord[] };
      if (Array.isArray(data.orders)) {
        setOwnerOrders(data.orders);
      }
    } finally {
      setIsLoadingOwnerOrders(false);
    }
  }, [handleUnauthorizedOwnerResponse, ownerFetch]);

  const refreshOwnerSecurity = useCallback(async () => {
    try {
      const res = await ownerFetch('/api/owner/security/devices');
      if (res.status === 401 || res.status === 403) {
        handleUnauthorizedOwnerResponse();
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { security?: OwnerSecuritySummary };
      if (data.security) {
        setOwnerSecurity(data.security);
      }
    } catch {
      // Ignore transient failure
    }
  }, [handleUnauthorizedOwnerResponse, ownerFetch]);

  // Verify whether current device already holds a valid bound owner session on boot
  useEffect(() => {
    let active = true;
    const verifyDeviceSession = async () => {
      try {
        const res = await ownerFetch('/api/owner/session');
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as OwnerSessionInfo;
          if (data.authorized && data.currentDevice) {
            setIsOwnerAuthorized(true);
            setCurrentOwnerDevice(data.currentDevice);
            setIsOwnerDashboardOpen(true);
            void refreshOwnerOrders();
            void refreshOwnerSecurity();
          }
        }
      } catch {
        // Normal unauthenticated customer session
      }
    };
    void verifyDeviceSession();
    return () => {
      active = false;
    };
  }, [ownerFetch, refreshOwnerOrders, refreshOwnerSecurity]);

  // Initialize customer session token in memory
  useEffect(() => {
    let active = true;
    const initCustomerSession = async () => {
      try {
        const res = await fetch(apiUrl('/api/customer/session'), { method: 'POST' });
        if (!res.ok) return;
        const data = (await res.json()) as { customerToken?: string };
        if (active && data.customerToken) {
          setCustomerToken(data.customerToken);
          setBackendStatus('connected');
          setBackendErrorMessage(null);
        }
      } catch {
        // Handled when making order or sync calls
      }
    };
    initCustomerSession();
    return () => {
      active = false;
    };
  }, []);

  const ensureCustomerToken = useCallback(async (): Promise<string | null> => {
    if (customerTokenRef.current) return customerTokenRef.current;
    try {
      const res = await fetch(apiUrl('/api/customer/session'), { method: 'POST' });
      if (!res.ok) {
        setBackendStatus('unavailable');
        setBackendErrorMessage('Unable to reach the boutique backend service.');
        return null;
      }
      const data = (await res.json()) as { customerToken?: string };
      if (data.customerToken) {
        setCustomerToken(data.customerToken);
        customerTokenRef.current = data.customerToken;
        setBackendStatus('connected');
        setBackendErrorMessage(null);
        return data.customerToken;
      }
      return null;
    } catch {
      setBackendStatus('unavailable');
      setBackendErrorMessage('Unable to reach the boutique backend service.');
      return null;
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    const token = await ensureCustomerToken();
    if (!token) return;
    setIsLoadingOrders(true);
    try {
      const res = await fetch(apiUrl('/api/orders'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status >= 500) {
          setBackendStatus('unavailable');
          setBackendErrorMessage('Order service returned a server error.');
        }
        return;
      }
      const data = (await res.json()) as { orders?: OrderRecord[] };
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
      setBackendStatus('connected');
      setBackendErrorMessage(null);
    } catch {
      setBackendStatus('unavailable');
      setBackendErrorMessage('Unable to reach the order service.');
    } finally {
      setIsLoadingOrders(false);
    }
  }, [ensureCustomerToken]);

  const refreshNotifications = useCallback(async () => {
    const token = await ensureCustomerToken();
    if (!token) {
      setNotificationsError('Unable to reach notification service. Please check your connection.');
      return;
    }
    setNotificationsError(null);
    setIsLoadingNotifications(true);
    try {
      const res = await fetch(apiUrl('/api/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setNotificationsError('Unable to load notifications right now.');
        if (res.status >= 500) {
          setBackendStatus('unavailable');
        }
        return;
      }
      const data = (await res.json()) as { notifications?: NotificationItem[] };
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
      setBackendStatus('connected');
      setBackendErrorMessage(null);
    } catch {
      setNotificationsError('Unable to reach notification service.');
      setBackendStatus('unavailable');
      setBackendErrorMessage('Unable to reach the boutique notification service.');
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [ensureCustomerToken]);

  useEffect(() => {
    if (!customerToken) return;
    void refreshOrders();
    void refreshNotifications();
  }, [customerToken, refreshOrders, refreshNotifications]);

  // Customer WebSocket connection (order updates, catalog updates & announcements)
  useEffect(() => {
    if (!customerToken) return;
    let closedByCleanup = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closedByCleanup) return;
      socket = new WebSocket(wsUrl('/ws'));

      socket.addEventListener('open', () => {
        socket?.send(JSON.stringify({ type: 'auth', role: 'customer', token: customerToken }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            order?: OrderRecord;
            notification?: NotificationItem;
            products?: Product[];
            collections?: Collection[];
            campaigns?: EditorialCampaign[];
            storeSettings?: StoreSettings;
          };
          if (payload.type === 'order:updated' && payload.order) {
            setOrders((prev) => upsertOrder(prev, payload.order!));
            if (payload.notification) {
              setNotifications((prev) => upsertNotification(prev, payload.notification!));
              showToast(payload.notification.title);
              if (
                typeof Notification !== 'undefined' &&
                Notification.permission === 'granted'
              ) {
                try {
                  new Notification(`VEY RASHA · ${payload.notification.title}`, {
                    body: payload.notification.message,
                  });
                } catch {
                  // Ignore environments restricting Notification constructor
                }
              }
            }
          } else if (payload.type === 'catalog:updated') {
            applyCatalogSnapshot(payload);
          } else if (payload.type === 'boutique:announcement' && payload.notification) {
            setNotifications((prev) => upsertNotification(prev, payload.notification!));
            showToast(payload.notification.title);
          }
        } catch {
          // Ignore malformed message
        }
      });

      socket.addEventListener('close', () => {
        if (!closedByCleanup) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      });
    };

    connect();
    return () => {
      closedByCleanup = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [applyCatalogSnapshot, customerToken, showToast]);

  // Authorized Owner Device WebSocket (authenticated via HttpOnly cookie or Keystore token + deviceId)
  useEffect(() => {
    if (!isOwnerAuthorized) return;
    let closedByCleanup = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = async () => {
      if (closedByCleanup) return;
      const identity = await getOrCreateDeviceIdentity();
      const nativeToken = await getNativeOwnerToken();
      if (closedByCleanup) return;

      socket = new WebSocket(wsUrl('/ws'));

      socket.addEventListener('open', () => {
        socket?.send(
          JSON.stringify({
            type: 'auth',
            role: 'owner',
            deviceId: identity.deviceId,
            ...(nativeToken ? { token: nativeToken } : {}),
          })
        );
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            order?: OrderRecord;
            products?: Product[];
            collections?: Collection[];
            campaigns?: EditorialCampaign[];
            storeSettings?: StoreSettings;
          };
          if (payload.type === 'owner:order_created' && payload.order) {
            setOwnerOrders((prev) => upsertOrder(prev, payload.order!));
            showToast(`New order request ${payload.order.orderReference}`);
          } else if (payload.type === 'owner:order_updated' && payload.order) {
            setOwnerOrders((prev) => upsertOrder(prev, payload.order!));
          } else if (payload.type === 'catalog:updated') {
            applyCatalogSnapshot(payload);
          }
        } catch {
          // Ignore malformed frame
        }
      });

      socket.addEventListener('close', (ev) => {
        if (ev.code === 4003) {
          // Device was revoked by the other authorized phone or backend recovery
          void clearNativeOwnerToken();
          handleUnauthorizedOwnerResponse();
          return;
        }
        if (!closedByCleanup) {
          reconnectTimer = window.setTimeout(() => void connect(), 3000);
        }
      });
    };

    void connect();
    return () => {
      closedByCleanup = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [applyCatalogSnapshot, handleUnauthorizedOwnerResponse, isOwnerAuthorized, showToast]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const navigate = useCallback(
    (nextRoute: AppRoute, options?: { productId?: string; category?: CategorySlug }) => {
      const nextProductId = options?.productId ?? selectedProductId;
      if (options?.productId) {
        setSelectedProductId(options.productId);
      }
      if (options?.category) {
        setActiveCategory(options.category);
      }
      // Never allow route='owner' via customer navigation
      const safeRoute: AppRoute = nextRoute === 'owner' ? 'home' : nextRoute;
      setIsOwnerDashboardOpen(false);
      setRoute(safeRoute);
      if (typeof window !== 'undefined') {
        const nextUrl = buildUrlForRoute(safeRoute, nextProductId);
        if (window.location.pathname !== nextUrl) {
          window.history.replaceState(null, '', nextUrl);
        }
      }
    },
    [selectedProductId]
  );

  const resetExploreFilters = useCallback(() => {
    setSearchQuery('');
    setActiveCategory('all');
    setPriceBand('all');
    setSortBy('featured');
  }, []);

  const toggleWishlist = useCallback(
    (productId: string) => {
      setWishlistIds((prev) => {
        const exists = prev.includes(productId);
        showToast(exists ? 'Removed from your wishlist' : 'Saved to your wishlist');
        return exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      });
    },
    [showToast]
  );

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  const addToCart = useCallback(
    (product: Product, size: string, color: ColorOption, quantity = 1) => {
      const itemKey = `${product.id}::${size}::${color.name}`;
      setCart((prev) => {
        const existing = prev.find((entry) => entry.id === itemKey);
        if (existing) {
          return prev.map((entry) =>
            entry.id === itemKey ? { ...entry, quantity: entry.quantity + quantity } : entry
          );
        }
        return [
          ...prev,
          {
            id: itemKey,
            productId: product.id,
            selectedSize: size,
            selectedColor: color,
            quantity,
          },
        ];
      });
      showToast(`Added ${product.name} to your bag`);
    },
    [showToast]
  );

  const updateCartQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === cartItemId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback(
    (cartItemId: string) => {
      setCart((prev) => prev.filter((item) => item.id !== cartItemId));
      showToast('Piece removed from bag');
    },
    [showToast]
  );

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotalUsd = useMemo(() => {
    return cart.reduce((sum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      return sum + (prod ? prod.priceUsd * item.quantity : 0);
    }, 0);
  }, [cart, products]);

  const submitOrderRequest = useCallback(
    async (payload: OrderRequestPayload): Promise<OrderSubmissionResult> => {
      const token = await ensureCustomerToken();
      if (!token) {
        return {
          status: 'error',
          message: 'Unable to initialize your order session. Please try again.',
        };
      }

      try {
        const response = await fetch(apiUrl('/api/orders'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as {
          status?: string;
          message?: string;
          order?: OrderRecord;
          error?: string;
        };

        if (!response.ok || !data.order) {
          return {
            status: 'error',
            message: data.error ?? 'Unable to submit your order request.',
          };
        }

        setOrders((prev) => upsertOrder(prev, data.order!));
        return {
          status: 'pending_review',
          message:
            data.message ??
            'Your order request has been received. Our boutique will review your delivery details and confirm your delivery fee and final total.',
          order: data.order,
        };
      } catch {
        setBackendStatus('unavailable');
        setBackendErrorMessage('Unable to reach the boutique order service.');
        return {
          status: 'error',
          message: 'Network error while submitting your order request. Please try again.',
        };
      }
    },
    [ensureCustomerToken]
  );

  const updateCustomer = useCallback(
    (patch: Partial<CustomerProfile>) => {
      setCustomer((prev) => ({ ...prev, ...patch }));
      showToast('Profile details updated');
    },
    [showToast]
  );

  const addAddress = useCallback(
    (address: Omit<SavedAddress, 'id'>): SavedAddress => {
      const newAddress: SavedAddress = {
        ...address,
        id: `addr-${Date.now()}`,
      };
      setAddresses((prev) => {
        const base = address.isDefault
          ? prev.map((a) => ({ ...a, isDefault: false }))
          : prev;
        return [...base, newAddress];
      });
      showToast('Address saved for this session');
      return newAddress;
    },
    [showToast]
  );

  const updateAddress = useCallback(
    (id: string, patch: Omit<SavedAddress, 'id'>) => {
      setAddresses((prev) =>
        prev.map((a) => {
          if (a.id === id) {
            return { ...patch, id };
          }
          return patch.isDefault ? { ...a, isDefault: false } : a;
        })
      );
      showToast('Delivery address updated');
    },
    [showToast]
  );

  const removeAddress = useCallback(
    (id: string) => {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      showToast('Address removed');
    },
    [showToast]
  );

  const setDefaultAddress = useCallback(
    (id: string) => {
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
      showToast('Default delivery address updated');
    },
    [showToast]
  );

  const retrieveGuestOrder = useCallback(
    async (
      orderReference: string,
      phone: string
    ): Promise<{ ok: boolean; order?: OrderRecord; error?: string }> => {
      const token = await ensureCustomerToken();
      if (!token) {
        return { ok: false, error: 'Unable to initialize your session. Please try again.' };
      }
      try {
        const res = await fetch(apiUrl('/api/orders/retrieve'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderReference: orderReference.trim(), phone: phone.trim() }),
        });
        const data = (await res.json()) as {
          order?: OrderRecord;
          notifications?: NotificationItem[];
          error?: string;
        };
        if (!res.ok || !data.order) {
          return { ok: false, error: data.error ?? 'Order could not be verified.' };
        }
        setOrders((prev) => upsertOrder(prev, data.order!));
        if (Array.isArray(data.notifications)) {
          setNotifications((prev) => {
            let next = [...prev];
            for (const notif of data.notifications!) {
              next = upsertNotification(next, notif);
            }
            return next;
          });
        }
        showToast(`Retrieved order ${data.order.orderReference}`);
        return { ok: true, order: data.order };
      } catch {
        setBackendStatus('unavailable');
        return { ok: false, error: 'Network error while verifying your order.' };
      }
    },
    [ensureCustomerToken, showToast]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      const token = customerTokenRef.current;
      if (token && !id.startsWith('announcement-')) {
        void fetch(apiUrl(`/api/notifications/${encodeURIComponent(id)}/read`), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    },
    []
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const token = customerTokenRef.current;
    if (token) {
      void fetch(apiUrl('/api/notifications/read-all'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    showToast('All notifications marked as read');
  }, [showToast]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setBrowserNotificationPermission('unsupported');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setBrowserNotificationPermission(perm);
      if (perm === 'granted') {
        showToast('Real-time order notifications enabled');
      }
    } catch {
      setBrowserNotificationPermission(readBrowserNotificationPermission());
    }
  }, [showToast]);

  // ---------------------------------------------------------------------------
  // Private Search-Bar Access & Two-Device Owner Management
  // ---------------------------------------------------------------------------
  const attemptSecretOwnerAccess = useCallback(
    async (candidateCode: string): Promise<boolean> => {
      const trimmed = candidateCode.trim();
      // Only probe backend when input resembles a continuous access token (>= 10 chars, no whitespace)
      // so ordinary boutique shopping queries never interfere or suffer latency.
      if (trimmed.length < 10 || /\s/.test(trimmed)) {
        return false;
      }

      try {
        const identity = await getOrCreateDeviceIdentity();
        const res = await fetch(apiUrl('/api/owner/device/enroll'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'VEYRASHA-Client',
          },
          body: JSON.stringify({
            code: trimmed,
            deviceId: identity.deviceId,
            deviceLabel: identity.deviceLabel,
            platform: identity.platform,
            publicKeyJwk: identity.publicKeyJwk,
          }),
        });

        if (!res.ok) {
          return false;
        }

        const data = (await res.json()) as {
          authorized?: boolean;
          currentDevice?: OwnerDeviceSummary;
          nativeDeviceToken?: string;
        };

        if (!data.authorized || !data.currentDevice) {
          return false;
        }

        if (data.nativeDeviceToken) {
          await saveNativeOwnerToken(data.nativeDeviceToken);
        }

        setIsOwnerAuthorized(true);
        setCurrentOwnerDevice(data.currentDevice);
        setIsOwnerDashboardOpen(true);
        setSearchQuery('');
        void refreshOwnerOrders();
        void refreshOwnerSecurity();
        return true;
      } catch {
        return false;
      }
    },
    [refreshOwnerOrders, refreshOwnerSecurity]
  );

  const openOwnerDashboard = useCallback(() => {
    if (!isOwnerAuthorized) return;
    setIsOwnerDashboardOpen(true);
    void refreshOwnerOrders();
    void refreshOwnerSecurity();
  }, [isOwnerAuthorized, refreshOwnerOrders, refreshOwnerSecurity]);

  const closeOwnerDashboard = useCallback(() => {
    setIsOwnerDashboardOpen(false);
  }, []);

  const rotateCurrentOwnerToken = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    try {
      const res = await ownerFetch('/api/owner/security/rotate-token', { method: 'POST' });
      const data = (await res.json()) as {
        ok?: boolean;
        nativeDeviceToken?: string;
        currentDevice?: OwnerDeviceSummary;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error ?? 'Unable to rotate device token.' };
      }
      if (data.nativeDeviceToken) {
        await saveNativeOwnerToken(data.nativeDeviceToken);
      }
      if (data.currentDevice) {
        setCurrentOwnerDevice(data.currentDevice);
      }
      void refreshOwnerSecurity();
      showToast('Device token rotated');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while rotating token.' };
    }
  }, [ownerFetch, refreshOwnerSecurity, showToast]);

  const revokeAuthorizedDevice = useCallback(
    async (slot: OwnerDeviceSlot): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await ownerFetch(`/api/owner/security/devices/${slot}/revoke`, {
          method: 'POST',
        });
        const data = (await res.json()) as {
          ok?: boolean;
          revokedSelf?: boolean;
          security?: OwnerSecuritySummary;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error ?? 'Unable to revoke device.' };
        }
        if (data.revokedSelf) {
          await clearNativeOwnerToken();
          handleUnauthorizedOwnerResponse();
          showToast('This device access has been revoked');
          return { ok: true };
        }
        if (data.security) {
          setOwnerSecurity(data.security);
        }
        showToast(`Device slot ${slot} revoked`);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while revoking device.' };
      }
    },
    [handleUnauthorizedOwnerResponse, ownerFetch, showToast]
  );

  const generateReplacementDeviceCode = useCallback(
    async (
      targetSlot: OwnerDeviceSlot
    ): Promise<{ ok: boolean; code?: string; expiresAt?: string; error?: string }> => {
      try {
        const res = await ownerFetch('/api/owner/security/replacement-code', {
          method: 'POST',
          body: JSON.stringify({ targetSlot }),
        });
        const data = (await res.json()) as {
          code?: string;
          expiresAt?: string;
          security?: OwnerSecuritySummary;
          error?: string;
        };
        if (!res.ok || !data.code) {
          return { ok: false, error: data.error ?? 'Unable to generate replacement code.' };
        }
        if (data.security) {
          setOwnerSecurity(data.security);
        }
        showToast(`One-time replacement code generated for slot ${targetSlot}`);
        return { ok: true, code: data.code, expiresAt: data.expiresAt };
      } catch {
        return { ok: false, error: 'Network error while generating replacement code.' };
      }
    },
    [ownerFetch, showToast]
  );

  const signOutOwnerSession = useCallback(async () => {
    try {
      await ownerFetch('/api/owner/security/logout', { method: 'POST' });
    } catch {
      // Ignore transient failure
    }
    await clearNativeOwnerToken();
    handleUnauthorizedOwnerResponse();
    setRoute('home');
  }, [handleUnauthorizedOwnerResponse, ownerFetch]);

  // ---------------------------------------------------------------------------
  // Owner Order & Catalog Management Mutations
  // ---------------------------------------------------------------------------
  const acceptOwnerOrder = useCallback(
    async (
      orderId: string,
      payload: { deliveryFeeUsd: number; estimatedDeliveryTime: string; ownerMessage?: string }
    ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
      try {
        const res = await ownerFetch(`/api/owner/orders/${encodeURIComponent(orderId)}/accept`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { order?: OrderRecord; error?: string };
        if (!res.ok || !data.order) {
          return { ok: false, error: data.error ?? 'Unable to accept order.' };
        }
        setOwnerOrders((prev) => upsertOrder(prev, data.order!));
        showToast(`Order ${data.order.orderReference} confirmed and customer notified`);
        return { ok: true, order: data.order };
      } catch {
        return { ok: false, error: 'Network error while accepting order.' };
      }
    },
    [ownerFetch, showToast]
  );

  const updateOwnerOrderStatus = useCallback(
    async (
      orderId: string,
      payload: { status: OrderStatus; estimatedDeliveryTime?: string; ownerMessage?: string }
    ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
      try {
        const res = await ownerFetch(`/api/owner/orders/${encodeURIComponent(orderId)}/status`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { order?: OrderRecord; error?: string };
        if (!res.ok || !data.order) {
          return { ok: false, error: data.error ?? 'Unable to update order status.' };
        }
        setOwnerOrders((prev) => upsertOrder(prev, data.order!));
        showToast(`Updated ${data.order.orderReference} status`);
        return { ok: true, order: data.order };
      } catch {
        return { ok: false, error: 'Network error while updating order status.' };
      }
    },
    [ownerFetch, showToast]
  );

  const updateOwnerPaymentStatus = useCallback(
    async (
      orderId: string,
      paymentStatus: PaymentStatus
    ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
      try {
        const res = await ownerFetch(`/api/owner/orders/${encodeURIComponent(orderId)}/payment`, {
          method: 'PATCH',
          body: JSON.stringify({ paymentStatus }),
        });
        const data = (await res.json()) as { order?: OrderRecord; error?: string };
        if (!res.ok || !data.order) {
          return { ok: false, error: data.error ?? 'Unable to update payment status.' };
        }
        setOwnerOrders((prev) => upsertOrder(prev, data.order!));
        showToast(`Updated payment status for ${data.order.orderReference}`);
        return { ok: true, order: data.order };
      } catch {
        return { ok: false, error: 'Network error while updating payment status.' };
      }
    },
    [ownerFetch, showToast]
  );

  const createOwnerProduct = useCallback(
    async (
      payload: ProductMutationInput
    ): Promise<{ ok: boolean; error?: string; product?: Product }> => {
      try {
        const res = await ownerFetch('/api/owner/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          product?: Product;
          products?: Product[];
          collections?: Collection[];
          campaigns?: EditorialCampaign[];
          storeSettings?: StoreSettings;
          error?: string;
        };
        if (!res.ok || !data.product) {
          return { ok: false, error: data.error ?? 'Unable to create product.' };
        }
        applyCatalogSnapshot(data);
        showToast(`Added ${data.product.name} to catalog`);
        return { ok: true, product: data.product };
      } catch {
        return { ok: false, error: 'Network error while creating product.' };
      }
    },
    [applyCatalogSnapshot, ownerFetch, showToast]
  );

  const updateOwnerProduct = useCallback(
    async (
      productId: string,
      payload: Partial<ProductMutationInput>
    ): Promise<{ ok: boolean; error?: string; product?: Product }> => {
      try {
        const res = await ownerFetch(`/api/owner/products/${encodeURIComponent(productId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          product?: Product;
          products?: Product[];
          collections?: Collection[];
          campaigns?: EditorialCampaign[];
          storeSettings?: StoreSettings;
          error?: string;
        };
        if (!res.ok || !data.product) {
          return { ok: false, error: data.error ?? 'Unable to update product.' };
        }
        applyCatalogSnapshot(data);
        showToast(`Saved changes to ${data.product.name}`);
        return { ok: true, product: data.product };
      } catch {
        return { ok: false, error: 'Network error while updating product.' };
      }
    },
    [applyCatalogSnapshot, ownerFetch, showToast]
  );

  const deleteOwnerProduct = useCallback(
    async (productId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await ownerFetch(`/api/owner/products/${encodeURIComponent(productId)}`, {
          method: 'DELETE',
        });
        const data = (await res.json()) as {
          ok?: boolean;
          products?: Product[];
          error?: string;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error ?? 'Unable to remove product.' };
        }
        applyCatalogSnapshot(data);
        showToast('Product removed from catalog');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while removing product.' };
      }
    },
    [applyCatalogSnapshot, ownerFetch, showToast]
  );

  const updateOwnerInventory = useCallback(
    async (productId: string, stockCount: number): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await ownerFetch(
          `/api/owner/products/${encodeURIComponent(productId)}/inventory`,
          {
            method: 'PATCH',
            body: JSON.stringify({ stockCount }),
          }
        );
        const data = (await res.json()) as {
          product?: Product;
          products?: Product[];
          error?: string;
        };
        if (!res.ok || !data.product) {
          return { ok: false, error: data.error ?? 'Unable to update inventory.' };
        }
        applyCatalogSnapshot(data);
        showToast(`Updated stock for ${data.product.name}`);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while updating inventory.' };
      }
    },
    [applyCatalogSnapshot, ownerFetch, showToast]
  );

  const updateOwnerCampaign = useCallback(
    async (
      campaignId: string,
      payload: Partial<EditorialCampaign>
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await ownerFetch(`/api/owner/campaigns/${encodeURIComponent(campaignId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          campaigns?: EditorialCampaign[];
          error?: string;
        };
        if (!res.ok) {
          return { ok: false, error: data.error ?? 'Unable to update campaign.' };
        }
        applyCatalogSnapshot(data);
        showToast('Editorial campaign updated');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while updating campaign.' };
      }
    },
    [applyCatalogSnapshot, ownerFetch, showToast]
  );

  const updateOwnerCollection = useCallback(
    async (
      collectionId: string,
      payload: Partial<Collection>
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await ownerFetch(`/api/owner/collections/${encodeURIComponent(collectionId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          collections?: Collection[];
          error?: string;
        };
        if (!res.ok) {
          return { ok: false, error: data.error ?? 'Unable to update collection.' };
        }
        applyCatalogSnapshot(data);
        showToast('Featured capsule updated');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while updating collection.' };
      }
    },
    [applyCatalogSnapshot, ownerFetch, showToast]
  );

  const publishOwnerAnnouncement = useCallback(
    async (title: string, message: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await ownerFetch('/api/owner/announcements', {
          method: 'POST',
          body: JSON.stringify({ title, message }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          return { ok: false, error: data.error ?? 'Unable to publish announcement.' };
        }
        showToast('Boutique announcement sent to clients');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while publishing announcement.' };
      }
    },
    [ownerFetch, showToast]
  );

  const updateOwnerStoreSettings = useCallback(
    async (patch: Partial<StoreSettings>): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await ownerFetch('/api/owner/settings', {
          method: 'PUT',
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as {
          storeSettings?: StoreSettings;
          error?: string;
        };
        if (!res.ok) {
          return { ok: false, error: data.error ?? 'Unable to save boutique settings.' };
        }
        applyCatalogSnapshot(data);
        showToast('Boutique settings saved');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while saving settings.' };
      }
    },
    [applyCatalogSnapshot, ownerFetch, showToast]
  );

  const retryCatalogLoad = useCallback(() => {
    setCatalogError(null);
    setIsCatalogLoading(true);
    void checkBackendHealth().finally(() => {
      setIsCatalogLoading(false);
    });
  }, [checkBackendHealth]);

  const simulateCatalogError = useCallback(() => {
    setCatalogError(
      'Unable to reach the boutique catalog service. Please check your connection and retry.'
    );
  }, []);

  const value = useMemo<BoutiqueContextValue>(
    () => ({
      route,
      selectedProductId,
      navigate,
      searchQuery,
      setSearchQuery,
      activeCategory,
      setActiveCategory,
      priceBand,
      setPriceBand,
      sortBy,
      setSortBy,
      resetExploreFilters,
      products,
      collections,
      campaigns,
      storeSettings,
      currency,
      setCurrency,
      wishlistIds,
      toggleWishlist,
      isWishlisted,
      cart,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      cartCount,
      cartSubtotalUsd,
      giftWrap,
      setGiftWrap,
      submitOrderRequest,
      customer,
      updateCustomer,
      addresses,
      addAddress,
      updateAddress,
      removeAddress,
      setDefaultAddress,
      orders,
      isLoadingOrders,
      refreshOrders,
      retrieveGuestOrder,
      notifications,
      unreadNotificationCount,
      isLoadingNotifications,
      notificationsError,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      browserNotificationPermission,
      requestBrowserNotifications,
      isOwnerAuthorized,
      isOwnerDashboardOpen,
      currentOwnerDevice,
      ownerSecurity,
      attemptSecretOwnerAccess,
      openOwnerDashboard,
      closeOwnerDashboard,
      refreshOwnerSecurity,
      rotateCurrentOwnerToken,
      revokeAuthorizedDevice,
      generateReplacementDeviceCode,
      signOutOwnerSession,
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
      backendStatus,
      backendErrorMessage,
      checkBackendHealth,
      toastMessage,
      showToast,
      isCatalogLoading,
      catalogError,
      retryCatalogLoad,
      simulateCatalogError,
    }),
    [
      route,
      selectedProductId,
      navigate,
      searchQuery,
      activeCategory,
      priceBand,
      sortBy,
      resetExploreFilters,
      products,
      collections,
      campaigns,
      storeSettings,
      currency,
      wishlistIds,
      toggleWishlist,
      isWishlisted,
      cart,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      cartCount,
      cartSubtotalUsd,
      giftWrap,
      submitOrderRequest,
      customer,
      updateCustomer,
      addresses,
      addAddress,
      updateAddress,
      removeAddress,
      setDefaultAddress,
      orders,
      isLoadingOrders,
      refreshOrders,
      retrieveGuestOrder,
      notifications,
      unreadNotificationCount,
      isLoadingNotifications,
      notificationsError,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      browserNotificationPermission,
      requestBrowserNotifications,
      isOwnerAuthorized,
      isOwnerDashboardOpen,
      currentOwnerDevice,
      ownerSecurity,
      attemptSecretOwnerAccess,
      openOwnerDashboard,
      closeOwnerDashboard,
      refreshOwnerSecurity,
      rotateCurrentOwnerToken,
      revokeAuthorizedDevice,
      generateReplacementDeviceCode,
      signOutOwnerSession,
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
      backendStatus,
      backendErrorMessage,
      checkBackendHealth,
      toastMessage,
      showToast,
      isCatalogLoading,
      catalogError,
      retryCatalogLoad,
      simulateCatalogError,
    ]
  );

  return <BoutiqueContext.Provider value={value}>{children}</BoutiqueContext.Provider>;
};

export function useBoutique(): BoutiqueContextValue {
  const ctx = useContext(BoutiqueContext);
  if (!ctx) {
    throw new Error('useBoutique must be used within a BoutiqueProvider');
  }
  return ctx;
}
