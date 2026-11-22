import React from 'react';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBoutique } from '../../context/BoutiqueContext';
import { LuxuryImage } from '../ui/LuxuryImage';

export const WelcomeAuthView: React.FC = () => {
  const {
    authLoading,
    isSigningIn,
    authError,
    isConfigured,
    configWarning,
    isDevGuestEnabled,
    loginWithGoogle,
    clearAuthError,
  } = useAuth();
  const { enterAsGuest, closeWelcomeAuth, heroImageUrl, storeSettings } = useBoutique();

  const handleGoogleSignIn = async () => {
    clearAuthError();
    await loginWithGoogle();
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F6F1E8] text-[#302923]">
      <div className="mx-auto grid min-h-screen min-h-[100dvh] max-w-7xl grid-cols-1 lg:grid-cols-12">
        {/* Editorial Campaign Imagery */}
        <div className="relative h-64 overflow-hidden bg-[#302923] sm:h-80 lg:col-span-6 lg:h-auto">
          <LuxuryImage
            src={heroImageUrl}
            alt="VEY RASHA Autumn-Winter collection silk silhouette"
            loading="eager"
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
              Timeless tailoring, silk eveningwear, and sculpted objects.
            </p>
          </div>
        </div>

        {/* Welcome & Google OAuth Authentication Panel */}
        <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:col-span-6 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center justify-between">
              <span className="font-serif text-2xl font-medium tracking-[0.16em] text-[#302923]">
                {storeSettings.boutiqueName}
              </span>
            </div>

            <div className="mt-8">
              <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                Private Boutique Access
              </p>
              <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-[#302923] sm:text-4xl">
                Welcome to {storeSettings.boutiqueName}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#665B51]">
                Sign in securely with your Google account to save pieces to your wishlist, sync your
                shopping bag across devices, submit order requests, and receive real-time boutique
                updates.
              </p>

              {!isConfigured && configWarning && (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-3.5 text-xs leading-relaxed text-[#302923]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                  <span>{configWarning}</span>
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3.5 text-xs leading-relaxed text-[#302923]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="mt-7 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={authLoading || isSigningIn || !isConfigured}
                  className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-full bg-[#302923] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authLoading || isSigningIn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {authLoading ? 'Checking Session...' : 'Redirecting to Google...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4 shrink-0"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          fill="#F6F1E8"
                          d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.48-1.68 4.35-5.27 4.35-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.79 4.1 14.69 3.2 12.18 3.2 7.21 3.2 3.2 7.21 3.2 12.2s4.01 9 8.98 9c5.18 0 8.62-3.64 8.62-8.77 0-.59-.06-1.04-.15-1.33z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={closeWelcomeAuth}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-6 py-2.5 text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA] active:scale-[0.99]"
                >
                  <span>Browse Boutique Catalogue</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                </button>

                {isDevGuestEnabled && (
                  <div className="pt-2">
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-[#E4D8C5]" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-[#F6F1E8] px-3 text-[11px] tracking-wider text-[#665B51] uppercase">
                          Development Mode Only
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={enterAsGuest}
                      className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#8C6D46] bg-transparent px-6 py-2.5 text-xs font-medium tracking-[0.1em] text-[#665B51] uppercase transition-colors hover:bg-[#EFE7DA]/70 hover:text-[#302923]"
                    >
                      <span>Continue as Guest (Dev Helper)</span>
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-6 text-center text-xs leading-relaxed text-[#665B51]">
                Public visitors may browse published collections. Google authentication is required
                to save wishlists, sync your bag, submit orders, and track real-time updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
