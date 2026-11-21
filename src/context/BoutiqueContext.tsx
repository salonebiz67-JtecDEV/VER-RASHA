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
  INITIAL_ADDRESSES,
  INITIAL_CUSTOMER,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  PRODUCTS,
} from '../data/catalog';
import { DEFAULT_STORE_SETTINGS } from '../data/storeConfig';
import type {
  AppRoute,
  CartItem,
  CategorySlug,
  ColorOption,
  CurrencyCode,
  CustomerProfile,
  NotificationItem,
  OrderRecord,
  OrderRequestPayload,
  OrderStatus,
  OrderSubmissionResult,
  OwnerAuthResult,
  OwnerAuthStatus,
  PaymentStatus,
  Product,
  SavedAddress,
  StoreSettings,
} from '../types/boutique';

export type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest';
export type PriceBand = 'all' | 'under-450' | '450-900' | 'over-900';

type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

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
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  orders: OrderRecord[];
  isLoadingOrders: boolean;
  refreshOrders: () => Promise<void>;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isLoadingNotifications: boolean;
  notificationsError: string | null;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  browserNotificationPermission: BrowserNotificationPermission;
  requestBrowserNotifications: () => Promise<void>;
  isOwnerAuthenticated: boolean;
  ownerEmail: string | null;
  ownerAuthStatus: OwnerAuthStatus | null;
  refreshOwnerAuthStatus: () => Promise<void>;
  setupOwnerAccount: (email: string, password: string) => Promise<OwnerAuthResult>;
  authenticateOwner: (email: string, password: string) => Promise<OwnerAuthResult>;
  signOutOwner: () => void;
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
  toastMessage: string | null;
  showToast: (message: string) => void;
  isCatalogLoading: boolean;
  catalogError: string | null;
  retryCatalogLoad: () => void;
  simulateCatalogError: () => void;
}

const BoutiqueContext = createContext<BoutiqueContextValue | undefined>(undefined);

function isOwnerUrlEntry(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  return hash === '#/owner' || hash === '#owner' || path === '/owner';
}

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

export const BoutiqueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storeSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [route, setRoute] = useState<AppRoute>(() => (isOwnerUrlEntry() ? 'owner' : 'home'));
  const [selectedProductId, setSelectedProductId] = useState<string>(PRODUCTS[0].id);
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

  // In-memory Bearer tokens (never written to localStorage/sessionStorage)
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const customerTokenRef = useRef<string | null>(null);
  customerTokenRef.current = customerToken;

  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const ownerTokenRef = useRef<string | null>(null);
  ownerTokenRef.current = ownerToken;

  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<BrowserNotificationPermission>(() => readBrowserNotificationPermission());

  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [ownerAuthStatus, setOwnerAuthStatus] = useState<OwnerAuthStatus | null>(null);
  const [ownerOrders, setOwnerOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOwnerOrders, setIsLoadingOwnerOrders] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  // Initialize customer session token in memory
  useEffect(() => {
    let active = true;
    const initCustomerSession = async () => {
      try {
        const res = await fetch('/api/customer/session', { method: 'POST' });
        if (!res.ok) return;
        const data = (await res.json()) as { customerToken?: string };
        if (active && data.customerToken) {
          setCustomerToken(data.customerToken);
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
      const res = await fetch('/api/customer/session', { method: 'POST' });
      if (!res.ok) return null;
      const data = (await res.json()) as { customerToken?: string };
      if (data.customerToken) {
        setCustomerToken(data.customerToken);
        customerTokenRef.current = data.customerToken;
        return data.customerToken;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    const token = await ensureCustomerToken();
    if (!token) return;
    setIsLoadingOrders(true);
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { orders?: OrderRecord[] };
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } finally {
      setIsLoadingOrders(false);
    }
  }, [ensureCustomerToken]);

  const refreshNotifications = useCallback(async () => {
    const token = await ensureCustomerToken();
    if (!token) return;
    setNotificationsError(null);
    setIsLoadingNotifications(true);
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setNotificationsError('Unable to load notifications right now.');
        return;
      }
      const data = (await res.json()) as { notifications?: NotificationItem[] };
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
    } catch {
      setNotificationsError('Unable to reach notification service.');
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [ensureCustomerToken]);

  useEffect(() => {
    if (!customerToken) return;
    void refreshOrders();
    void refreshNotifications();
  }, [customerToken, refreshOrders, refreshNotifications]);

  // Customer WebSocket connection for real-time order updates & notifications
  useEffect(() => {
    if (!customerToken) return;
    let closedByCleanup = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closedByCleanup) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.addEventListener('open', () => {
        socket?.send(JSON.stringify({ type: 'auth', role: 'customer', token: customerToken }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            order?: OrderRecord;
            notification?: NotificationItem;
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
  }, [customerToken, showToast]);

  // Owner WebSocket connection for real-time new order requests
  useEffect(() => {
    if (!isOwnerAuthenticated || !ownerToken) return;
    let closedByCleanup = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closedByCleanup) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.addEventListener('open', () => {
        socket?.send(JSON.stringify({ type: 'auth', role: 'owner', token: ownerToken }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            order?: OrderRecord;
          };
          if (payload.type === 'owner:order_created' && payload.order) {
            setOwnerOrders((prev) => upsertOrder(prev, payload.order!));
            showToast(`New order request ${payload.order.orderReference}`);
          } else if (payload.type === 'owner:order_updated' && payload.order) {
            setOwnerOrders((prev) => upsertOrder(prev, payload.order!));
          }
        } catch {
          // Ignore malformed frame
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
  }, [isOwnerAuthenticated, ownerToken, showToast]);

  useEffect(() => {
    const handleHashOrPop = () => {
      if (isOwnerUrlEntry()) {
        setRoute('owner');
      }
    };
    window.addEventListener('hashchange', handleHashOrPop);
    window.addEventListener('popstate', handleHashOrPop);
    return () => {
      window.removeEventListener('hashchange', handleHashOrPop);
      window.removeEventListener('popstate', handleHashOrPop);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const navigate = useCallback(
    (nextRoute: AppRoute, options?: { productId?: string; category?: CategorySlug }) => {
      if (options?.productId) {
        setSelectedProductId(options.productId);
      }
      if (options?.category) {
        setActiveCategory(options.category);
      }
      if (nextRoute !== 'owner' && typeof window !== 'undefined' && isOwnerUrlEntry()) {
        window.history.replaceState(null, '', '/');
      }
      setRoute(nextRoute);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
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
      const prod = PRODUCTS.find((p) => p.id === item.productId);
      return sum + (prod ? prod.priceUsd * item.quantity : 0);
    }, 0);
  }, [cart]);

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
        const response = await fetch('/api/orders', {
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

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      const token = customerTokenRef.current;
      if (token) {
        void fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
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
      void fetch('/api/notifications/read-all', {
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
  // Owner Auth & Order Management
  // ---------------------------------------------------------------------------
  const refreshOwnerAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/auth-status');
      if (!res.ok) return;
      const status = (await res.json()) as OwnerAuthStatus;
      setOwnerAuthStatus(status);
    } catch {
      // Ignore transient network errors
    }
  }, []);

  const refreshOwnerOrders = useCallback(async () => {
    const token = ownerTokenRef.current;
    if (!token) return;
    setIsLoadingOwnerOrders(true);
    try {
      const res = await fetch('/api/owner/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { orders?: OrderRecord[] };
      if (Array.isArray(data.orders)) {
        setOwnerOrders(data.orders);
      }
    } finally {
      setIsLoadingOwnerOrders(false);
    }
  }, []);

  const setupOwnerAccount = useCallback(
    async (emailInput: string, passwordInput: string): Promise<OwnerAuthResult> => {
      try {
        const res = await fetch('/api/owner/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput.trim(), password: passwordInput }),
        });
        const data = (await res.json()) as OwnerAuthResult;
        if (res.ok && data.authenticated && data.token) {
          setOwnerToken(data.token);
          ownerTokenRef.current = data.token;
          setIsOwnerAuthenticated(true);
          setOwnerEmail(data.email ?? emailInput.trim());
          void refreshOwnerAuthStatus();
          void refreshOwnerOrders();
          return data;
        }
        return { authenticated: false, error: data.error ?? 'Setup failed.' };
      } catch {
        return { authenticated: false, error: 'Unable to reach server.' };
      }
    },
    [refreshOwnerAuthStatus, refreshOwnerOrders]
  );

  const authenticateOwner = useCallback(
    async (emailInput: string, passwordInput: string): Promise<OwnerAuthResult> => {
      const trimmedEmail = emailInput.trim();
      if (!trimmedEmail || !passwordInput) {
        return {
          authenticated: false,
          error: 'Please enter both your owner email and password.',
        };
      }

      try {
        const response = await fetch('/api/owner/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password: passwordInput }),
        });

        const data = (await response.json()) as OwnerAuthResult;

        if (response.ok && data.authenticated && data.token) {
          setOwnerToken(data.token);
          ownerTokenRef.current = data.token;
          setIsOwnerAuthenticated(true);
          setOwnerEmail(data.email ?? trimmedEmail);
          void refreshOwnerOrders();
          return data;
        }

        return {
          authenticated: false,
          error: data.error ?? 'Invalid owner credentials or unauthorized account.',
        };
      } catch {
        return {
          authenticated: false,
          error:
            'Unable to reach the owner authentication service. Verify the server is running.',
        };
      }
    },
    [refreshOwnerOrders]
  );

  const signOutOwner = useCallback(() => {
    setOwnerToken(null);
    ownerTokenRef.current = null;
    setIsOwnerAuthenticated(false);
    setOwnerEmail(null);
    setOwnerOrders([]);
    showToast('Signed out of Owner Workspace');
  }, [showToast]);

  const acceptOwnerOrder = useCallback(
    async (
      orderId: string,
      payload: { deliveryFeeUsd: number; estimatedDeliveryTime: string; ownerMessage?: string }
    ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
      const token = ownerTokenRef.current;
      if (!token) return { ok: false, error: 'Owner authentication required.' };
      try {
        const res = await fetch(`/api/owner/orders/${encodeURIComponent(orderId)}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
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
    [showToast]
  );

  const updateOwnerOrderStatus = useCallback(
    async (
      orderId: string,
      payload: { status: OrderStatus; estimatedDeliveryTime?: string; ownerMessage?: string }
    ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
      const token = ownerTokenRef.current;
      if (!token) return { ok: false, error: 'Owner authentication required.' };
      try {
        const res = await fetch(`/api/owner/orders/${encodeURIComponent(orderId)}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
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
    [showToast]
  );

  const updateOwnerPaymentStatus = useCallback(
    async (
      orderId: string,
      paymentStatus: PaymentStatus
    ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
      const token = ownerTokenRef.current;
      if (!token) return { ok: false, error: 'Owner authentication required.' };
      try {
        const res = await fetch(`/api/owner/orders/${encodeURIComponent(orderId)}/payment`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
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
    [showToast]
  );

  const retryCatalogLoad = useCallback(() => {
    setCatalogError(null);
    setIsCatalogLoading(true);
    window.setTimeout(() => {
      setIsCatalogLoading(false);
    }, 450);
  }, []);

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
      removeAddress,
      setDefaultAddress,
      orders,
      isLoadingOrders,
      refreshOrders,
      notifications,
      unreadNotificationCount,
      isLoadingNotifications,
      notificationsError,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      browserNotificationPermission,
      requestBrowserNotifications,
      isOwnerAuthenticated,
      ownerEmail,
      ownerAuthStatus,
      refreshOwnerAuthStatus,
      setupOwnerAccount,
      authenticateOwner,
      signOutOwner,
      ownerOrders,
      isLoadingOwnerOrders,
      refreshOwnerOrders,
      acceptOwnerOrder,
      updateOwnerOrderStatus,
      updateOwnerPaymentStatus,
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
      removeAddress,
      setDefaultAddress,
      orders,
      isLoadingOrders,
      refreshOrders,
      notifications,
      unreadNotificationCount,
      isLoadingNotifications,
      notificationsError,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      browserNotificationPermission,
      requestBrowserNotifications,
      isOwnerAuthenticated,
      ownerEmail,
      ownerAuthStatus,
      refreshOwnerAuthStatus,
      setupOwnerAccount,
      authenticateOwner,
      signOutOwner,
      ownerOrders,
      isLoadingOwnerOrders,
      refreshOwnerOrders,
      acceptOwnerOrder,
      updateOwnerOrderStatus,
      updateOwnerPaymentStatus,
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
