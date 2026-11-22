import React from 'react';
import { Heart, Home, LayoutGrid, ShoppingBag, User } from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import type { AppRoute } from '../../types/boutique';

export const BottomNav: React.FC = () => {
  const { route, navigate, cartCount, wishlistIds } = useBoutique();

  const tabs: {
    route: AppRoute;
    label: string;
    icon: React.FC<{ className?: string; strokeWidth?: number }>;
    badgeCount?: number;
  }[] = [
    { route: 'home', label: 'Home', icon: Home },
    { route: 'explore', label: 'Shop', icon: LayoutGrid },
    { route: 'wishlist', label: 'Wishlist', icon: Heart, badgeCount: wishlistIds.length },
    { route: 'cart', label: 'Bag', icon: ShoppingBag, badgeCount: cartCount },
    { route: 'account', label: 'Account', icon: User },
  ];

  const isRouteActive = (tabRoute: AppRoute) => {
    if (route === tabRoute) return true;
    if (tabRoute === 'explore' && route === 'product') return true;
    if (tabRoute === 'cart' && route === 'checkout') return true;
    if (tabRoute === 'account' && route === 'notifications') return true;
    return false;
  };

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E4D8C5] bg-[#FCF9F4]/96 backdrop-blur-md pb-safe md:hidden"
    >
      <div className="grid h-16 grid-cols-5 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isRouteActive(tab.route);
          return (
            <button
              key={tab.route}
              type="button"
              onClick={() => navigate(tab.route)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#302923] ${
                active ? 'text-[#302923]' : 'text-[#8B7F73] hover:text-[#302923]'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className="h-[19px] w-[19px]" strokeWidth={1.55} />
                {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#302923] px-1 text-[9px] font-semibold text-[#F6F1E8] tabular-nums">
                    {tab.badgeCount}
                  </span>
                )}
              </div>
              <span
                className={`mt-1 text-[10px] tracking-[0.02em] whitespace-nowrap ${
                  active ? 'font-semibold text-[#302923]' : 'font-normal text-[#8B7F73]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
