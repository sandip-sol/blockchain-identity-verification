'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';

import AuthOnboardingModal from '../../components/AuthOnboardingModal';
import { useAuth } from '../../context/AuthContext';
import { connectInjectedWallet, toWalletErrorMessage } from '../../utils/wallet';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthErrorMessage(errorMessage, isLogin) {
  if (!errorMessage) {
    return isLogin ? 'Unable to sign in right now. Please try again.' : 'Unable to create your account right now. Please try again.';
  }

  const message = String(errorMessage);

  if (message.toLowerCase().includes('invalid email or password')) {
    return 'That email and password combination did not match our records.';
  }

  if (message.toLowerCase().includes('already exists')) {
    return 'An account with that email already exists. Try signing in instead.';
  }

  return message;
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletHint, setWalletHint] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [walletState, setWalletState] = useState('idle');
  const [walletError, setWalletError] = useState(null);
  const [pendingRedirect, setPendingRedirect] = useState(false);

  const redirectTarget = useMemo(() => searchParams.get('next') || '/dashboard', [searchParams]);

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setIsLogin(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (auth.isAuthenticated && !showOnboarding && !pendingRedirect) {
      router.push(redirectTarget);
    }
  }, [auth.isAuthenticated, pendingRedirect, redirectTarget, router, showOnboarding]);

  const canSubmit = email && password && (isLogin || password.length >= 6) && !loading;

  const completeOnboarding = () => {
    setShowOnboarding(false);
    setPendingRedirect(false);
    router.push(redirectTarget);
  };

  const handleWalletChoiceBeforeLogin = async () => {
    setWalletHint('Wallet connection is available after account sign-in. Create or sign in to your account first.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setWalletHint(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { email, password, name: name || undefined };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(getAuthErrorMessage(data?.error, isLogin));
      }

      const nextAccount = data.account || null;
      const hasLinkedWallet = Boolean(nextAccount?.address);

      if (!hasLinkedWallet) {
        setPendingRedirect(true);
        setShowOnboarding(true);
        setWalletState('idle');
        setWalletError(null);
      }

      auth.login(data.token, nextAccount);

      if (hasLinkedWallet) {
        router.push(redirectTarget);
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError.message, isLogin));
      setPendingRedirect(false);
      setShowOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkWallet = async () => {
    if (walletState !== 'idle' && walletState !== 'error') return;

    setWalletError(null);

    try {
      setWalletState('connecting');
      const { address, provider } = await connectInjectedWallet();

      setWalletState('nonce');
      const nonceRes = await fetch(`${API_URL}/api/auth/nonce?address=${encodeURIComponent(address)}`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) {
        throw new Error(nonceData?.error || 'Unable to request a wallet verification message.');
      }

      setWalletState('signing');
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(nonceData.message);

      setWalletState('linking');
      const linkRes = await fetch(`${API_URL}/api/auth/link-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          address,
          nonce: nonceData.nonce,
          signature,
        }),
      });

      const linkData = await linkRes.json();
      if (!linkRes.ok) {
        throw new Error(linkData?.error || 'Unable to link wallet right now.');
      }

      setWalletState('success');
      auth.login(auth.token, {
        ...auth.account,
        ...linkData.account,
      });

      window.setTimeout(() => {
        completeOnboarding();
      }, 900);
    } catch (walletLinkError) {
      setWalletState('error');
      setWalletError(toWalletErrorMessage(walletLinkError));
    }
  };

  return (
    <>
      <div className="relative min-h-screen overflow-hidden fabric-noise">
        <div className="pointer-events-none absolute inset-0">
          <div className="fabric-grid absolute inset-0 opacity-40" />
          <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary-500/20 blur-3xl" />
          <div className="absolute -bottom-44 -right-44 h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" />
        </div>

        <nav className="relative z-10 border-b border-white/10 bg-[#0b0c10]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0c10]/60">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <button aria-label="Home" className="flex items-center gap-3" onClick={() => router.push('/')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Shield className="h-5 w-5 text-primary-400" />
              </div>
              <div className="text-left leading-tight">
                <div className="text-xs uppercase tracking-widest text-white/50">Identity & Signing</div>
                <div className="text-lg font-semibold tracking-tight text-white">KYC/KYB Platform</div>
              </div>
            </button>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-74px)] max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75">
              <Sparkles className="h-4 w-4 text-primary-300" />
              Email-first authentication with wallet onboarding
            </div>
            <h1 className="mt-6 font-['Space_Grotesk'] text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Access your account,
              <span className="text-primary-400"> then bring your wallet in.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
              Sign in or create your account with email first. Once you are in, we can guide you through linking a wallet for KYC proofs, signing workflows, and other on-chain actions.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setWalletHint(null);
                  setError(null);
                  setIsLogin(true);
                }}
                className="glass-card rounded-3xl border-white/10 p-5 text-left hover:border-white/20"
              >
                <Mail className="h-6 w-6 text-primary-300" />
                <h2 className="mt-4 text-xl font-semibold text-white">Continue with Email</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Use your existing email and password, or create a new account. This remains the real sign-in method today.
                </p>
              </button>

              <button
                type="button"
                onClick={handleWalletChoiceBeforeLogin}
                className="glass-card rounded-3xl border-white/10 p-5 text-left hover:border-white/20"
              >
                <Wallet className="h-6 w-6 text-primary-300" />
                <h2 className="mt-4 text-xl font-semibold text-white">Connect Wallet</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Wallet connection is part of onboarding after account access, so it never replaces your current email-based login.
                </p>
              </button>
            </div>

            <div className="mt-8 grid gap-3 text-sm text-white/55 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-medium text-white">1. Authenticate</p>
                <p className="mt-1">Email and password return your JWT and account session.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-medium text-white">2. Link wallet</p>
                <p className="mt-1">Optional onboarding step using an off-chain signature, not a gas transaction.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-medium text-white">3. Use web3 features</p>
                <p className="mt-1">Start KYC proofs, envelopes, and other wallet-aware flows from the dashboard.</p>
              </div>
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="glass-card rounded-[28px] p-6 sm:p-8">
              <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Account access</p>
                <h2 className="mt-3 font-['Space_Grotesk'] text-4xl font-semibold tracking-tight text-white">
                  {isLogin ? 'Sign in first' : 'Create your account'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {isLogin
                    ? 'Use your email and password to enter the platform. Wallet linking comes right after if you want it.'
                    : 'Create an account now, then choose whether to link a wallet before you continue.'}
                </p>
              </div>

              <div className="relative mb-8 flex rounded-full border border-white/10 bg-white/[0.03] p-1">
                <div
                  className={`absolute inset-y-1 w-1/2 rounded-full border border-white/10 bg-white/[0.06] transition-all duration-300 ${isLogin ? 'left-1' : 'left-[calc(50%-4px)] translate-x-1'}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError(null);
                    setWalletHint(null);
                  }}
                  className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${isLogin ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError(null);
                    setWalletHint(null);
                  }}
                  className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${!isLogin ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Sign Up
                </button>
              </div>

              {walletHint && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary-500/20 bg-primary-500/10 px-4 py-4 text-sm text-primary-100">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-300" />
                  <p>{walletHint}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="input-field pl-11"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="input-field pl-11"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="input-field pl-11"
                    />
                  </div>
                  {!isLogin && <p className="mt-1 text-xs text-white/40">Minimum 6 characters</p>}
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-100">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="primary-button flex w-full items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isLogin ? 'Continue with Email' : 'Create Account'}</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-300" />
                  <p>
                    After account access, we will offer to link a wallet with a signed message. That signature confirms wallet ownership and does not create a gas transaction.
                  </p>
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-gray-500">
                {isLogin ? (
                  <>
                    Need an account?{' '}
                    <button type="button" onClick={() => setIsLogin(false)} className="text-primary-400 hover:underline">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button type="button" onClick={() => setIsLogin(true)} className="text-primary-400 hover:underline">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          </section>
        </div>
      </div>

      <AuthOnboardingModal
        open={showOnboarding}
        account={auth.account || { email }}
        walletState={walletState}
        walletError={walletError}
        onClose={completeOnboarding}
        onSkip={completeOnboarding}
        onLinkWallet={handleLinkWallet}
      />
    </>
  );
}
