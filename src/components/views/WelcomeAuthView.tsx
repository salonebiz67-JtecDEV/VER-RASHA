import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { ASSETS } from '../../data/catalog';
import { useBoutique } from '../../context/BoutiqueContext';
import { LuxuryImage } from '../ui/LuxuryImage';

export const WelcomeAuthView: React.FC = () => {
  const {
    welcomeAuthMode,
    setWelcomeAuthMode,
    enterAsGuest,
    storeSettings,
  } = useBoutique();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const resetFeedback = () => {
    setAuthNotice(null);
    setFormError(null);
  };

  const handleModeSwitch = (mode: 'landing' | 'signin' | 'signup' | 'forgot') => {
    resetFeedback();
    setWelcomeAuthMode(mode);
  };

  const handleEmailFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (welcomeAuthMode === 'forgot') {
      setAuthNotice(
        'Customer account authentication is not yet connected to a live identity provider on this storefront. You can continue immediately as a guest to browse and place order requests.'
      );
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }

    if (welcomeAuthMode === 'signup') {
      if (!fullName.trim()) {
        setFormError('Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
    }

    setAuthNotice(
      'Customer account sign-in requires connecting an identity provider (such as Supabase Auth) before personal accounts can be verified. Please continue as a guest in the meantime.'
    );
  };

  const handleGoogleSignIn = () => {
    resetFeedback();
    setAuthNotice(
      'Google Sign-In is not yet configured for this boutique storefront. Choose Continue as Guest below to explore the collection and submit order requests.'
    );
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F6F1E8] text-[#302923]">
      <div className="mx-auto grid min-h-screen min-h-[100dvh] max-w-7xl grid-cols-1 lg:grid-cols-12">
        {/* Editorial Campaign Imagery */}
        <div className="relative h-64 overflow-hidden bg-[#302923] sm:h-80 lg:col-span-6 lg:h-auto">
          <LuxuryImage
            src={ASSETS.heroGown}
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

        {/* Welcome & Authentication Panel */}
        <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:col-span-6 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center justify-between">
              <span className="font-serif text-2xl font-medium tracking-[0.16em] text-[#302923]">
                {storeSettings.boutiqueName}
              </span>
              {welcomeAuthMode !== 'landing' && (
                <button
                  type="button"
                  onClick={() => handleModeSwitch('landing')}
                  className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-[#665B51] transition-colors hover:text-[#302923]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
                  <span>Back</span>
                </button>
              )}
            </div>

            {welcomeAuthMode === 'landing' ? (
              <div className="mt-8">
                <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                  Private Boutique Access
                </p>
                <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-[#302923] sm:text-4xl">
                  Welcome to VEY RASHA
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-[#665B51]">
                  Sign in to manage personal preferences, or step directly into the boutique as a
                  guest to browse seasonal collections, curate your wishlist, and submit order
                  requests.
                </p>

                {authNotice && (
                  <div
                    role="status"
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-3.5 text-xs leading-relaxed text-[#302923]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                    <span>{authNotice}</span>
                  </div>
                )}

                <div className="mt-7 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('signin')}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-full bg-[#302923] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] active:scale-[0.99]"
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.6} />
                    <span>Continue with Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-6 py-3 text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA] active:scale-[0.99]"
                  >
                    <Sparkles className="h-4 w-4 text-[#8C6D46]" strokeWidth={1.6} />
                    <span>Continue with Google</span>
                  </button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-[#E4D8C5]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[#F6F1E8] px-3 text-[11px] tracking-wider text-[#665B51] uppercase">
                        Or explore freely
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={enterAsGuest}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[#302923]/30 bg-transparent px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#302923] uppercase transition-colors hover:border-[#302923] hover:bg-[#EFE7DA]/70 active:scale-[0.99]"
                  >
                    <span>Continue as Guest</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </div>

                <p className="mt-6 text-center text-xs leading-relaxed text-[#665B51]">
                  Guest shoppers enjoy full access to collections, wishlist, shopping bag, manual
                  checkout, and order tracking.
                </p>
              </div>
            ) : (
              <div className="mt-7">
                {/* Email Sub-Navigation Tabs */}
                <div className="flex border-b border-[#E4D8C5]" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={welcomeAuthMode === 'signin'}
                    onClick={() => handleModeSwitch('signin')}
                    className={`min-h-[44px] flex-1 border-b-2 text-xs font-semibold tracking-wider uppercase transition-colors ${
                      welcomeAuthMode === 'signin'
                        ? 'border-[#302923] text-[#302923]'
                        : 'border-transparent text-[#665B51] hover:text-[#302923]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={welcomeAuthMode === 'signup'}
                    onClick={() => handleModeSwitch('signup')}
                    className={`min-h-[44px] flex-1 border-b-2 text-xs font-semibold tracking-wider uppercase transition-colors ${
                      welcomeAuthMode === 'signup'
                        ? 'border-[#302923] text-[#302923]'
                        : 'border-transparent text-[#665B51] hover:text-[#302923]'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <h1 className="mt-6 font-serif text-3xl font-medium text-[#302923]">
                  {welcomeAuthMode === 'signin'
                    ? 'Sign In'
                    : welcomeAuthMode === 'signup'
                    ? 'Create Client Account'
                    : 'Reset Password'}
                </h1>
                <p className="mt-1.5 text-xs leading-relaxed text-[#665B51]">
                  {welcomeAuthMode === 'forgot'
                    ? 'Enter your email address to request password recovery instructions.'
                    : 'Enter your email credentials below or continue directly as a guest.'}
                </p>

                {formError && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs text-[#302923]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                    <span>{formError}</span>
                  </div>
                )}

                {authNotice && (
                  <div
                    role="status"
                    className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-3.5 text-xs leading-relaxed text-[#302923]"
                  >
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D46]" />
                    <span>{authNotice}</span>
                  </div>
                )}

                <form onSubmit={handleEmailFormSubmit} className="mt-5 space-y-4">
                  {welcomeAuthMode === 'signup' && (
                    <div>
                      <label
                        htmlFor="auth-full-name"
                        className="mb-1.5 block text-xs font-medium text-[#302923]"
                      >
                        Full Name
                      </label>
                      <input
                        id="auth-full-name"
                        type="text"
                        autoComplete="name"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="auth-email"
                      className="mb-1.5 block text-xs font-medium text-[#302923]"
                    >
                      Email Address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                    />
                  </div>

                  {welcomeAuthMode !== 'forgot' && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label
                          htmlFor="auth-password"
                          className="block text-xs font-medium text-[#302923]"
                        >
                          Password
                        </label>
                        {welcomeAuthMode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => handleModeSwitch('forgot')}
                            className="text-xs font-medium text-[#8C6D46] hover:text-[#302923]"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete={
                            welcomeAuthMode === 'signup' ? 'new-password' : 'current-password'
                          }
                          placeholder="Minimum 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] pr-11 pl-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#665B51] hover:text-[#302923]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" strokeWidth={1.6} />
                          ) : (
                            <Eye className="h-4 w-4" strokeWidth={1.6} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {welcomeAuthMode === 'signup' && (
                    <div>
                      <label
                        htmlFor="auth-confirm-password"
                        className="mb-1.5 block text-xs font-medium text-[#302923]"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="auth-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#FCF9F4] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#302923] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
                  >
                    {welcomeAuthMode === 'signin'
                      ? 'Sign In'
                      : welcomeAuthMode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Instructions'}
                  </button>
                </form>

                <div className="mt-5 border-t border-[#E4D8C5] pt-5">
                  <button
                    type="button"
                    onClick={enterAsGuest}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-[#D8C3A5] bg-[#FCF9F4] px-6 py-2.5 text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA]"
                  >
                    <span>Continue as Guest</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
