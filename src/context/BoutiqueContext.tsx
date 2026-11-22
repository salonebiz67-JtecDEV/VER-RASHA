import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { APP_BASE_PATH } from '../config/api';
import { CATEGORIES } from '../data/catalog';
import { DEFAULT_STORE_SETTINGS } from '../data/storeConfig';
import { isSupabaseConfigured, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import {
  createUserAddress,
  deleteUserAddress,
  fetchUserAddresses,
  setDefaultUserAddress,
  updateUserAddress,
} from '../services/addresses.service';
import {
  clearUserCart,
  fetchCartState,
  removeCartItem,
  setCartGiftPresentation,
  updateCartItemQuantity,
  upsertCartItem,
} from '../services/cart.service';
import {
  fetchCustomerNotifications,
  markAllCustomerNotificationsAsRead,
  markCustomerNotificationAsRead,
  subscribeCustomerRealtime,
} from '../services/notifications.service';
import { fetchCustomerOrders, submitBoutiqueOrder } from '../services/orders.service';
import {
  type BoutiqueCategoryItem,
  fetchBoutiqueCatalog,
} from '../services/products.service';
import {
  fetchWishlistProductIds,
  toggleWishlistProduct,
} from '../services/wishlist.service';
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
  OrderSubmissionResult,
  Product,
  SavedAddress,
  StoreSettings,
  WelcomeAuthMode,
} from '../types/boutique';
import { useAuth } from './AuthContext';

export type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest';
export type PriceBand = 'all' | 'under-450' | '450-900' | 'over-900';
export type BackendStatus = 'checking' | 'connected' | 'unavailable';

type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface BoutiqueContextValue {
  route: AppRoute;
  selectedProductId: string;
  navigate: (route: AppRoute, options?: { productId?: string; category?: CategorySlug }) => void;
  showWelcomeAuth: boolean;
  welcomeAuthMode: WelcomeAuthMode;
  setWelcomeAuthMode: (mode: WelcomeAuthMode) => void;
  enterAsGuest: () => void;
  openWelcomeAuth: (mode?: WelcomeAuthMode) => void;
  closeWelcomeAuth: () => void;
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
  categories: BoutiqueCategoryItem[];
  heroImageUrl: string;
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
  addAddress: (address: Omit<SavedAddress, 'id'>) => Promise<SavedAddress | null>;
  updateAddress: (id: string, patch: Omit<SavedAddress, 'id'>) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
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
  backendStatus: BackendStatus;
  backendErrorMessage: string | null;
  checkBackendHealth: () => Promise<boolean>;
  toastMessage: string | null;
  showToast: (message: string) => void;
  isCatalogLoading: boolean;
  catalogError: string | null;
  retryCatalogLoad: () => void;
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

function parseRouteFromLocation(): {
  route: AppRoute;
  productId: string;
  isDeepLink: boolean;
} {
  if (typeof window === 'undefined') {
    return { route: 'home', productId: '', isDeepLink: false };
  }
  const relative = stripBaseFromPathname(window.location.pathname).toLowerCase();
  if (!relative || relative === 'home') {
    return { route: 'home', productId: '', isDeepLink: false };
  }
  const segments = relative.split('/').filter(Boolean);
  if (segments[0] === 'shop') {
    return { route: 'explore', productId: '', isDeepLink: true };
  }
  if (segments[0] === 'bag') {
    return { route: 'cart', productId: '', isDeepLink: true };
  }
  if (segments[0] === 'product' && segments[1]) {
    return {
      route: 'product',
      productId: decodeURIComponent(segments[1]),
      isDeepLink: true,
    };
  }
  const candidate = segments[0] as AppRoute;
  if (PUBLIC_ROUTES.has(candidate)) {
    return { route: candidate, productId: '', isDeepLink: true };
  }
  return { route: 'home', productId: '', isDeepLink: false };
}

function buildUrlForRoute(route: AppRoute, productId?: string): string {
  if (route === 'home') {
    return APP_BASE_PATH;
  }
  if (route === 'explore') {
    return `${APP_BASE_PATH}shop`;
  }
  if (route === 'cart') {
    return `${APP_BASE_PATH}bag`;
  }
  if (route === 'product' && productId) {
    return `${APP_BASE_PATH}product/${encodeURIComponent(productId)}`;
  }
  return `${APP_BASE_PATH}${route}`;
}

export const BoutiqueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    profile,
    authLoading,
    isAuthenticated,
    isDevGuestSession,
    enterDevGuestMode,
    saveProfile,
  } = useAuth();

  const initialLocation = useMemo(() => parseRouteFromLocation(), []);

  // Live catalog from Supabase (zero invented/starter products)
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<BoutiqueCategoryItem[]>(CATEGORIES);
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [campaigns, setCampaigns] = useState<EditorialCampaign[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  const [showWelcomeAuth, setShowWelcomeAuth] = useState<boolean>(
    () => !initialLocation.isDeepLink
  );
  const [welcomeAuthMode, setWelcomeAuthMode] = useState<WelcomeAuthMode>('landing');

  const [route, setRoute] = useState<AppRoute>(initialLocation.route);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialLocation.productId);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategorySlug>('all');
  const [priceBand, setPriceBand] = useState<PriceBand>('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_STORE_SETTINGS.defaultCurrency);

  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [giftWrap, setGiftWrapState] = useState(false);

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<BrowserNotificationPermission>(() => readBrowserNotificationPermission());

  const [backendStatus, setBackendStatus] = useState<BackendStatus>(
    isSupabaseConfigured ? 'checking' : 'unavailable'
  );
  const [backendErrorMessage, setBackendErrorMessage] = useState<string | null>(
    isSupabaseConfigured ? null : SUPABASE_CONFIG_WARNING
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(isSupabaseConfigured);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  // Automatically dismiss Welcome screen once authenticated via Google OAuth
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setShowWelcomeAuth(false);
    }
  }, [authLoading, isAuthenticated]);

  const enterAsGuest = useCallback(() => {
    enterDevGuestMode();
    setShowWelcomeAuth(false);
    setWelcomeAuthMode('landing');
  }, [enterDevGuestMode]);

  const openWelcomeAuth = useCallback((mode: WelcomeAuthMode = 'landing') => {
    setWelcomeAuthMode(mode);
    setShowWelcomeAuth(true);
  }, []);

  const closeWelcomeAuth = useCallback(() => {
    setShowWelcomeAuth(false);
  }, []);

  const loadCatalogFromSupabase = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setProducts([]);
      setCollections([]);
      setCampaigns([]);
      setBackendStatus('unavailable');
      setBackendErrorMessage(SUPABASE_CONFIG_WARNING);
      setIsCatalogLoading(false);
      setCatalogError(null);
      return false;
    }

    setIsCatalogLoading(true);
    setCatalogError(null);
    try {
      const snapshot = await fetchBoutiqueCatalog();
      setProducts(snapshot.products);
      setCategories(snapshot.categories.length > 0 ? snapshot.categories : CATEGORIES);
      setHeroImageUrl(snapshot.heroImageUrl || '');
      setCollections(snapshot.collections);
      setCampaigns(snapshot.campaigns);
      setStoreSettings(snapshot.storeSettings);
      setBackendStatus('connected');
      setBackendErrorMessage(null);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to load the boutique catalogue right now.';
      setCatalogError(msg);
      setBackendStatus('unavailable');
      setBackendErrorMessage(msg);
      return false;
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    setBackendStatus('checking');
    return loadCatalogFromSupabase();
  }, [loadCatalogFromSupabase]);

  // Initial catalog fetch from Supabase
  useEffect(() => {
    void loadCatalogFromSupabase();
  }, [loadCatalogFromSupabase]);

  const refreshOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      return;
    }
    setIsLoadingOrders(true);
    try {
      const list = await fetchCustomerOrders(user.id);
      setOrders(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setIsLoadingOrders(false);
    }
  }, [showToast, user]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setNotificationsError(null);
      return;
    }
    setNotificationsError(null);
    setIsLoadingNotifications(true);
    try {
      const list = await fetchCustomerNotifications(user.id);
      setNotifications(list);
    } catch (err) {
      setNotificationsError(
        err instanceof Error ? err.message : 'Unable to load notifications right now.'
      );
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [user]);

  // Hydrate authenticated customer data (wishlist, bag, addresses, orders, notifications)
  const hydratedUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      hydratedUserIdRef.current = null;
      if (!isDevGuestSession) {
        setWishlistIds([]);
        setCart([]);
        setGiftWrapState(false);
        setAddresses([]);
        setOrders([]);
        setNotifications([]);
      }
      return;
    }

    let active = true;
    hydratedUserIdRef.current = user.id;

    const loadUserData = async () => {
      try {
        const [wishIds, cartState, addrList, orderList, notifList] = await Promise.all([
          fetchWishlistProductIds(user.id),
          fetchCartState(user.id),
          fetchUserAddresses(user.id),
          fetchCustomerOrders(user.id),
          fetchCustomerNotifications(user.id),
        ]);
        if (!active || hydratedUserIdRef.current !== user.id) return;
        setWishlistIds(wishIds);
        setCart(cartState.items);
        setGiftWrapState(cartState.giftPresentation);
        setAddresses(addrList);
        setOrders(orderList);
        setNotifications(notifList);
      } catch (err) {
        if (active) {
          showToast(
            err instanceof Error ? err.message : 'Unable to sync your boutique account data.'
          );
        }
      }
    };

    void loadUserData();

    return () => {
      active = false;
    };
  }, [isDevGuestSession, showToast, user]);

  // Supabase Realtime subscription for private notifications & order status updates
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    const unsubscribe = subscribeCustomerRealtime(user.id, {
      onNotification: (incoming) => {
        setNotifications((prev) => upsertNotification(prev, incoming));
        showToast(incoming.title);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`VEY RASHA · ${incoming.title}`, {
              body: incoming.message,
            });
          } catch {
            // Ignore environments restricting Notification constructor
          }
        }
      },
      onOrderUpdated: (updatedOrder) => {
        setOrders((prev) => upsertOrder(prev, updatedOrder));
      },
    });

    return () => {
      unsubscribe();
    };
  }, [showToast, user]);

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
      setShowWelcomeAuth(false);
      setRoute(nextRoute);
      if (typeof window !== 'undefined') {
        const nextUrl = buildUrlForRoute(nextRoute, nextProductId);
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

  const requireCustomerSession = useCallback(
    (actionLabel: string): boolean => {
      if (user) return true;
      if (isDevGuestSession) return true;
      showToast(`Sign in with Google to ${actionLabel}`);
      openWelcomeAuth('landing');
      return false;
    },
    [isDevGuestSession, openWelcomeAuth, showToast, user]
  );

  const toggleWishlist = useCallback(
    (productId: string) => {
      if (!requireCustomerSession('save pieces to your wishlist')) return;

      const currentlySaved = wishlistIds.includes(productId);
      setWishlistIds((prev) =>
        currentlySaved ? prev.filter((id) => id !== productId) : [productId, ...prev]
      );
      showToast(currentlySaved ? 'Removed from your wishlist' : 'Saved to your wishlist');

      if (user) {
        void toggleWishlistProduct(user.id, productId, currentlySaved).catch((err) => {
          setWishlistIds((prev) =>
            currentlySaved ? [productId, ...prev] : prev.filter((id) => id !== productId)
          );
          showToast(err instanceof Error ? err.message : 'Unable to update wishlist.');
        });
      }
    },
    [requireCustomerSession, showToast, user, wishlistIds]
  );

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  const addToCart = useCallback(
    (product: Product, size: string, color: ColorOption, quantity = 1) => {
      if (!requireCustomerSession('add pieces to your shopping bag')) return;

      if (user) {
        void upsertCartItem(user.id, product.id, size, color, quantity)
          .then((nextItems) => {
            setCart(nextItems);
            showToast(`Added ${product.name} to your bag`);
          })
          .catch((err) => {
            showToast(err instanceof Error ? err.message : 'Unable to add piece to bag.');
          });
        return;
      }

      // Dev-only guest local fallback
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
    [requireCustomerSession, showToast, user]
  );

  const updateCartQuantity = useCallback(
    (cartItemId: string, delta: number) => {
      const current = cart.find((c) => c.id === cartItemId);
      if (!current) return;
      const nextQty = current.quantity + delta;

      if (user) {
        void updateCartItemQuantity(user.id, cartItemId, nextQty)
          .then((nextItems) => setCart(nextItems))
          .catch((err) => {
            showToast(err instanceof Error ? err.message : 'Unable to update bag quantity.');
          });
        return;
      }

      setCart((prev) =>
        prev
          .map((item) => (item.id === cartItemId ? { ...item, quantity: nextQty } : item))
          .filter((item) => item.quantity > 0)
      );
    },
    [cart, showToast, user]
  );

  const removeFromCart = useCallback(
    (cartItemId: string) => {
      if (user) {
        void removeCartItem(user.id, cartItemId)
          .then((nextItems) => {
            setCart(nextItems);
            showToast('Piece removed from bag');
          })
          .catch((err) => {
            showToast(err instanceof Error ? err.message : 'Unable to remove piece from bag.');
          });
        return;
      }

      setCart((prev) => prev.filter((item) => item.id !== cartItemId));
      showToast('Piece removed from bag');
    },
    [showToast, user]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    if (user) {
      void clearUserCart(user.id).catch(() => undefined);
    }
  }, [user]);

  const setGiftWrap = useCallback(
    (val: boolean) => {
      setGiftWrapState(val);
      if (user) {
        void setCartGiftPresentation(user.id, val).catch(() => undefined);
      }
    },
    [user]
  );

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
      if (!user) {
        return {
          status: 'error',
          message: 'Please sign in with Google before submitting an order request.',
        };
      }

      const result = await submitBoutiqueOrder(payload);
      if (result.status === 'pending_review' && result.order) {
        setOrders((prev) => upsertOrder(prev, result.order!));
        void refreshNotifications();
      }
      return result;
    },
    [refreshNotifications, user]
  );

  const updateCustomer = useCallback(
    (patch: Partial<CustomerProfile>) => {
      void saveProfile(patch)
        .then(() => {
          showToast('Profile details updated');
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : 'Unable to save profile details.');
        });
    },
    [saveProfile, showToast]
  );

  const addAddress = useCallback(
    async (address: Omit<SavedAddress, 'id'>): Promise<SavedAddress | null> => {
      if (!user) {
        if (!isDevGuestSession) {
          requireCustomerSession('save delivery addresses');
          return null;
        }
        const localAddr: SavedAddress = { ...address, id: `addr-${Date.now()}` };
        setAddresses((prev) => {
          const base = address.isDefault
            ? prev.map((a) => ({ ...a, isDefault: false }))
            : prev;
          return [...base, localAddr];
        });
        showToast('Address saved for dev session');
        return localAddr;
      }

      try {
        const created = await createUserAddress(user.id, address);
        const list = await fetchUserAddresses(user.id);
        setAddresses(list);
        showToast('Delivery address saved');
        return created;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to save delivery address.');
        return null;
      }
    },
    [isDevGuestSession, requireCustomerSession, showToast, user]
  );

  const updateAddress = useCallback(
    async (id: string, patch: Omit<SavedAddress, 'id'>): Promise<void> => {
      if (!user) {
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === id) return { ...patch, id };
            return patch.isDefault ? { ...a, isDefault: false } : a;
          })
        );
        showToast('Delivery address updated');
        return;
      }

      try {
        await updateUserAddress(user.id, id, patch);
        const list = await fetchUserAddresses(user.id);
        setAddresses(list);
        showToast('Delivery address updated');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to update delivery address.');
      }
    },
    [showToast, user]
  );

  const removeAddress = useCallback(
    async (id: string): Promise<void> => {
      if (!user) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        showToast('Address removed');
        return;
      }

      try {
        await deleteUserAddress(user.id, id);
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        showToast('Address removed');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to remove address.');
      }
    },
    [showToast, user]
  );

  const setDefaultAddress = useCallback(
    async (id: string): Promise<void> => {
      if (!user) {
        setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
        showToast('Default delivery address updated');
        return;
      }

      try {
        await setDefaultUserAddress(user.id, id);
        setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
        showToast('Default delivery address updated');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to update default address.');
      }
    },
    [showToast, user]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      if (user) {
        void markCustomerNotificationAsRead(user.id, id).catch(() => undefined);
      }
    },
    [user]
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) {
      void markAllCustomerNotificationsAsRead(user.id).catch(() => undefined);
    }
    showToast('All notifications marked as read');
  }, [showToast, user]);

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

  const retryCatalogLoad = useCallback(() => {
    void loadCatalogFromSupabase();
  }, [loadCatalogFromSupabase]);

  const value = useMemo<BoutiqueContextValue>(
    () => ({
      route,
      selectedProductId,
      navigate,
      showWelcomeAuth,
      welcomeAuthMode,
      setWelcomeAuthMode,
      enterAsGuest,
      openWelcomeAuth,
      closeWelcomeAuth,
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
      categories,
      heroImageUrl,
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
      customer: profile,
      updateCustomer,
      addresses,
      addAddress,
      updateAddress,
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
      backendStatus,
      backendErrorMessage,
      checkBackendHealth,
      toastMessage,
      showToast,
      isCatalogLoading,
      catalogError,
      retryCatalogLoad,
    }),
    [
      route,
      selectedProductId,
      navigate,
      showWelcomeAuth,
      welcomeAuthMode,
      enterAsGuest,
      openWelcomeAuth,
      closeWelcomeAuth,
      searchQuery,
      activeCategory,
      priceBand,
      sortBy,
      resetExploreFilters,
      products,
      categories,
      heroImageUrl,
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
      setGiftWrap,
      submitOrderRequest,
      profile,
      updateCustomer,
      addresses,
      addAddress,
      updateAddress,
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
      backendStatus,
      backendErrorMessage,
      checkBackendHealth,
      toastMessage,
      showToast,
      isCatalogLoading,
      catalogError,
      retryCatalogLoad,
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
