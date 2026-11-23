import React, { useId, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CustomerAuthPanelProps {
  compact?: boolean;
  onSuccess?: () => void;
}

type AuthFormMode = 'signin' | 'signup';

export const CustomerAuthPanel: React.FC<CustomerAuthPanelProps> = ({
  compact = false,
  onSuccess,
}) => {
  const {
    authLoading,
    isSigningIn,
    authError,
    isConfigured,
    configWarning,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<AuthFormMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const idPrefix = useId();
  const displayError = localError || authError;
  const busy = authLoading || isSigningIn;

  const switchMode = (nextMode: AuthFormMode) => {
    setMode(nextMode);
    setLocalError(null);
    setInfoMessage(null);
    clearAuthError();
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setInfoMessage(null);
    clearAuthError();
    const res = await loginWithGoogle();
    if (res.ok) {
      onSuccess?.();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);
    clearAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signin') {
      const res = await loginWithEmail(cleanEmail, password);
      if (res.ok) {
        onSuccess?.();
      }
      return;
    }

    const res = await registerWithEmail(cleanEmail, password, fullName.trim());
    if (!res.ok) return;

    if (res.requiresEmailConfirmation) {
      setInfoMessage(
        res.message ??
          'Account created. Check your email inbox to confirm your address before signing in.'
      );
      setMode('signin');
      setPassword('');
    } else {
      onSuccess?.();
    }
  };

  return (
    <div className="w-full text-left">
      {!isConfigured && configWarning && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#D8C3A5] bg-[#FCF9F4] px-4 py-3 text-xs leading-relaxed text-[#302923]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7A5D39]" />
          <span>{configWarning}</span>
        </div>
      )}

      {displayError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#8C6D46] bg-[#EFE7DA] px-4 py-3 text-xs leading-relaxed text-[#302923]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7A5D39]" />
          <span>{displayError}</span>
        </div>
      )}

      {infoMessage && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#B59972] bg-[#FCF9F4] px-4 py-3 text-xs leading-relaxed text-[#302923]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7A5D39]" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Google Sign-In */}
      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={busy || !isConfigured}
        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-full bg-[#302923] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{authLoading ? 'Checking Session...' : 'Please wait...'}</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#F6F1E8"
                d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.48-1.68 4.35-5.27 4.35-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.79 4.1 14.69 3.2 12.18 3.2 7.21 3.2 3.2 7.21 3.2 12.2s4.01 9 8.98 9c5.18 0 8.62-3.64 8.62-8.77 0-.59-.06-1.04-.15-1.33z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Divider */}
      <div className={`relative ${compact ? 'my-4' : 'my-5'}`}>
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-[#E4D8C5]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#FCF9F4] px-3 text-[11px] font-medium tracking-[0.14em] text-[#665B51] uppercase">
            Or with Email
          </span>
        </div>
      </div>

      {/* Sign In / Create Account Toggle */}
      <div
        className="mb-3.5 grid grid-cols-2 rounded-full border border-[#E4D8C5] bg-[#F6F1E8] p-1"
        role="tablist"
        aria-label="Email authentication mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => switchMode('signin')}
          className={`min-h-[40px] rounded-full text-xs font-medium transition-colors ${
            mode === 'signin'
              ? 'bg-[#302923] text-[#F6F1E8]'
              : 'text-[#665B51] hover:text-[#302923]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => switchMode('signup')}
          className={`min-h-[40px] rounded-full text-xs font-medium transition-colors ${
            mode === 'signup'
              ? 'bg-[#302923] text-[#F6F1E8]'
              : 'text-[#665B51] hover:text-[#302923]'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Email & Password Form */}
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        {mode === 'signup' && (
          <div>
            <label
              htmlFor={`${idPrefix}-name`}
              className="mb-1 block text-xs font-medium text-[#302923]"
            >
              Full Name
            </label>
            <input
              id={`${idPrefix}-name`}
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
            />
          </div>
        )}

        <div>
          <label
            htmlFor={`${idPrefix}-email`}
            className="mb-1 block text-xs font-medium text-[#302923]"
          >
            Email Address
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] px-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-password`}
            className="mb-1 block text-xs font-medium text-[#302923]"
          >
            Password
          </label>
          <div className="relative">
            <input
              id={`${idPrefix}-password`}
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] pr-12 pl-3.5 text-sm text-[#302923] placeholder:text-[#665B51]/70 focus:border-[#B59972] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#665B51] hover:text-[#302923]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !isConfigured}
          className="mt-1 flex min-h-[46px] w-full items-center justify-center rounded-full border border-[#302923] bg-[#FCF9F4] px-6 py-2.5 text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase transition-colors hover:bg-[#EFE7DA] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? mode === 'signin'
              ? 'Signing In...'
              : 'Creating Account...'
            : mode === 'signin'
            ? 'Sign In with Email'
            : 'Create Account'}
        </button>
      </form>
    </div>
  );
};
