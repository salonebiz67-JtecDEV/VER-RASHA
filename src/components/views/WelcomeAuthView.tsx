import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBoutique } from '../../context/BoutiqueContext';
import { CustomerAuthPanel } from '../auth/CustomerAuthPanel';
import { LuxuryImage } from '../ui/LuxuryImage';

export const WelcomeAuthView: React.FC = () => {
  const { isDevGuestEnabled } = useAuth();
  const { enterAsGuest, closeWelcomeAuth, heroImageUrl, storeSettings } = useBoutique();

  const resolvedHero = heroImageUrl || `${import.meta.env.BASE_URL}images/hero.jpg`;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F6F1E8] text-[#302923]">
      <div className="mx-auto grid min-h-screen min-h-[100dvh] max-w-7xl grid-cols-1 lg:grid-cols-12">
        {/* Editorial Campaign Imagery */}
        <div className="relative h-64 overflow-hidden bg-[#302923] sm:h-80 lg:col-span-6 lg:h-auto">
          <LuxuryImage
            src={resolvedHero}
            alt="VEY RASHA editorial silhouette"
            loading="eager"
            fetchPriority="high"
            className="h-full w-full"
            imgClassName="object-[center_20%]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#1E1813]/85 via-[#1E1813]/25 to-[#1E1813]/10"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <p className="text-[11px] font-medium tracking-[0.22em] text-[#D8C3A5] uppercase">
              {storeSettings.boutiqueName}
            </p>
            <p className="mt-1.5 max-w-sm font-serif text-2xl font-normal text-[#F6F1E8] sm:text-3xl">
              {storeSettings.boutiqueDescription ||
                'Timeless tailoring, eveningwear, and curated accessories.'}
            </p>
          </div>
        </div>

        {/* Welcome & Authentication Panel */}
        <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:col-span-6 lg:px-16">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] p-6 sm:p-8">
            <span className="font-serif text-2xl font-medium tracking-[0.16em] text-[#302923]">
              {storeSettings.boutiqueName}
            </span>

            <div className="mt-6">
              <p className="text-[11px] font-medium tracking-[0.18em] text-[#7A5D39] uppercase">
                Private Boutique Access
              </p>
              <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-[#302923] sm:text-4xl">
                Welcome to {storeSettings.boutiqueName}
              </h1>
              <p className="mt-3 mb-6 text-sm leading-relaxed text-[#665B51]">
                Sign in with Google or your email to save pieces to your wishlist, sync your bag,
                submit orders, and track real-time updates.
              </p>

              <CustomerAuthPanel onSuccess={closeWelcomeAuth} />

              <button
                type="button"
                onClick={closeWelcomeAuth}
                className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-[#D8C3A5] bg-[#F6F1E8] px-6 py-2.5 text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA] active:scale-[0.99]"
              >
                <span>Browse Boutique Catalogue</span>
                <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
              </button>

              {isDevGuestEnabled && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={enterAsGuest}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#8C6D46] bg-transparent px-6 py-2.5 text-xs font-medium tracking-[0.1em] text-[#665B51] uppercase transition-colors hover:bg-[#EFE7DA]/70 hover:text-[#302923]"
                  >
                    <span>Continue as Guest (Dev Helper)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
