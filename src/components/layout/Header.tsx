import React from 'react';
import { Bell, Search, ShoppingBag } from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';
import type { AppRoute } from '../../types/boutique';

export const Header: React.FC = () => {
  const { route, navigate, cartCount, unreadNotificationCount } = useBoutique();

  const navItems: { route: AppRoute; label: string }[] = [
    { route: 'home', label: 'Home' },
    { route: 'explore', label: 'Explore' },
    { route: 'wishlist', label: 'Wishlist' },
    { route: 'account', label: 'Account' },
    { route: 'notifications', label: 'Updates' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4D8C5]/80 bg-[#F6F1E8]/92 backdrop-blur-md pt-safe">
      {/* Desktop 3-Zone Top Bar */}
      <div className="mx-auto hidden max-w-7xl items-center justify-between gap-8 px-6 py-4 md:flex">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="font-serif text-2xl font-medium tracking-[0.14em] text-[#302923] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#302923]"
        >
          VEY RASHA
        </button>

        <nav className="flex items-center gap-7" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const active = route === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#302923] ${
                  active ? 'text-[#302923]' : 'text-[#665B51] hover:text-[#302923]'
                }`}
              >
                <span>{item.label}</span>
                {item.route === 'notifications' && unreadNotificationCount > 0 && (
                  <span className="ml-1.5 text-xs text-[#8C6D46] tabular-nums">
                    ({unreadNotificationCount})
                  </span>
                )}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#302923]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => navigate('cart')}
            className="inline-flex items-center gap-2 rounded-full bg-[#302923] px-5 py-2.5 text-xs font-medium tracking-wide text-[#F6F1E8] transition-colors duration-150 hover:bg-[#463D35] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#302923]"
          >
            <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Bag</span>
            <span className="tabular-nums">({cartCount})</span>
          </button>
        </div>
      </div>

      {/* Compact Mobile App Top Bar (52px) */}
      <div className="flex h-[52px] items-center justify-between px-4 md:hidden">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="font-serif text-xl font-medium tracking-[0.14em] text-[#302923] whitespace-nowrap shrink-0"
        >
          VEY RASHA
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('explore')}
            aria-label="Search boutique"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#302923] transition-colors hover:bg-[#EFE7DA]"
          >
            <Search className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            onClick={() => navigate('notifications')}
            aria-label="Notifications"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#302923] transition-colors hover:bg-[#EFE7DA]"
          >
            <Bell className="h-5 w-5" strokeWidth={1.6} />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-2.5 right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#302923] px-1 text-[10px] font-medium text-[#F6F1E8] tabular-nums">
                {unreadNotificationCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
