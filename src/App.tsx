/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useRef } from 'react';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { AccountView } from './components/views/AccountView';
import { CartView } from './components/views/CartView';
import { CheckoutView } from './components/views/CheckoutView';
import { ExploreView } from './components/views/ExploreView';
import { HomeView } from './components/views/HomeView';
import { NotificationsView } from './components/views/NotificationsView';
import { ProductDetailView } from './components/views/ProductDetailView';
import { WelcomeAuthView } from './components/views/WelcomeAuthView';
import { WishlistView } from './components/views/WishlistView';
import { BoutiqueProvider, useBoutique } from './context/BoutiqueContext';
import type { AppRoute } from './types/boutique';

interface PageScrollContainerProps {
  pageKey: AppRoute;
  isActive: boolean;
  scrollPositionsRef: React.MutableRefObject<Partial<Record<AppRoute, number>>>;
  resetTrigger?: string;
  resetOnMount?: boolean;
  children: React.ReactNode;
}

const PageScrollContainer: React.FC<PageScrollContainerProps> = ({
  pageKey,
  isActive,
  scrollPositionsRef,
  resetTrigger,
  resetOnMount = false,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isActiveRef = useRef(isActive);
  const prevResetTriggerRef = useRef(resetTrigger);
  isActiveRef.current = isActive;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    (el as HTMLElement & { inert: boolean }).inert = !isActive;

    if (resetOnMount) {
      scrollPositionsRef.current[pageKey] = 0;
      el.scrollTop = 0;
      return;
    }

    if (prevResetTriggerRef.current !== resetTrigger) {
      prevResetTriggerRef.current = resetTrigger;
      scrollPositionsRef.current[pageKey] = 0;
      el.scrollTop = 0;
      return;
    }

    if (isActive) {
      const savedTop = scrollPositionsRef.current[pageKey] ?? 0;
      if (el.scrollTop !== savedTop) {
        el.scrollTop = savedTop;
      }
    }
  }, [isActive, pageKey, resetOnMount, resetTrigger, scrollPositionsRef]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isActiveRef.current) return;
    scrollPositionsRef.current[pageKey] = e.currentTarget.scrollTop;
  };

  return (
    <div
      ref={containerRef}
      data-scroll-container={pageKey}
      data-page-active={isActive ? 'true' : 'false'}
      aria-hidden={!isActive}
      onScroll={handleScroll}
      className={`vey-scroll-container scroll-touch absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain ${
        isActive
          ? 'visible pointer-events-auto z-10 opacity-100'
          : 'invisible pointer-events-none z-0 opacity-0'
      }`}
    >
      <div className="flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
};

const BoutiqueShell: React.FC = () => {
  const {
    route,
    selectedProductId,
    toastMessage,
    showWelcomeAuth,
  } = useBoutique();
  const scrollPositionsRef = useRef<Partial<Record<AppRoute, number>>>({});

  if (showWelcomeAuth) {
    return (
      <>
        <WelcomeAuthView />
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

  return (
    <div className="vey-app-shell flex h-screen h-[100dvh] flex-col overflow-hidden bg-[#F6F1E8] text-[#302923]">
      <Header />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        {/* Independent scroll containers preserving scroll state across tabs */}
        <PageScrollContainer
          pageKey="home"
          isActive={route === 'home'}
          scrollPositionsRef={scrollPositionsRef}
        >
          <HomeView />
        </PageScrollContainer>

        <PageScrollContainer
          pageKey="explore"
          isActive={route === 'explore'}
          scrollPositionsRef={scrollPositionsRef}
        >
          <ExploreView />
        </PageScrollContainer>

        <PageScrollContainer
          pageKey="wishlist"
          isActive={route === 'wishlist'}
          scrollPositionsRef={scrollPositionsRef}
        >
          <WishlistView />
        </PageScrollContainer>

        <PageScrollContainer
          pageKey="cart"
          isActive={route === 'cart'}
          scrollPositionsRef={scrollPositionsRef}
        >
          <CartView />
        </PageScrollContainer>

        <PageScrollContainer
          pageKey="account"
          isActive={route === 'account'}
          scrollPositionsRef={scrollPositionsRef}
        >
          <AccountView />
        </PageScrollContainer>

        <PageScrollContainer
          pageKey="notifications"
          isActive={route === 'notifications'}
          scrollPositionsRef={scrollPositionsRef}
        >
          <NotificationsView />
        </PageScrollContainer>

        <PageScrollContainer
          pageKey="product"
          isActive={route === 'product'}
          scrollPositionsRef={scrollPositionsRef}
          resetTrigger={selectedProductId}
        >
          <ProductDetailView />
        </PageScrollContainer>

        {route === 'checkout' && (
          <PageScrollContainer
            pageKey="checkout"
            isActive={true}
            scrollPositionsRef={scrollPositionsRef}
            resetOnMount={true}
          >
            <CheckoutView />
          </PageScrollContainer>
        )}
      </main>

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
