/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { AccountView } from './components/views/AccountView';
import { CartView } from './components/views/CartView';
import { CheckoutView } from './components/views/CheckoutView';
import { ExploreView } from './components/views/ExploreView';
import { HomeView } from './components/views/HomeView';
import { NotificationsView } from './components/views/NotificationsView';
import { OwnerPortalView } from './components/views/OwnerPortalView';
import { ProductDetailView } from './components/views/ProductDetailView';
import { WishlistView } from './components/views/WishlistView';
import { BoutiqueProvider, useBoutique } from './context/BoutiqueContext';

const BoutiqueShell: React.FC = () => {
  const { route, toastMessage } = useBoutique();

  if (route === 'owner') {
    return (
      <>
        <OwnerPortalView />
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#302923] px-5 py-2.5 text-xs font-medium text-[#F6F1E8] shadow-lg"
          >
            {toastMessage}
          </div>
        )}
      </>
    );
  }

  const renderRoute = () => {
    switch (route) {
      case 'home':
        return <HomeView />;
      case 'explore':
        return <ExploreView />;
      case 'product':
        return <ProductDetailView />;
      case 'wishlist':
        return <WishlistView />;
      case 'cart':
        return <CartView />;
      case 'checkout':
        return <CheckoutView />;
      case 'account':
        return <AccountView />;
      case 'notifications':
        return <NotificationsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F1E8] text-[#302923]">
      <Header />
      <main className="flex-1">{renderRoute()}</main>
      <Footer />
      <BottomNav />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#302923] px-5 py-2.5 text-xs font-medium text-[#F6F1E8] shadow-lg md:bottom-6"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <BoutiqueProvider>
      <BoutiqueShell />
    </BoutiqueProvider>
  );
}
