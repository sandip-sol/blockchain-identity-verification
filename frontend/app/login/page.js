'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Initialize mode from URL params
  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setIsLogin(false);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      const next = searchParams.get('next') || '/dashboard';
      router.push(next);
    }
  }, [auth.isAuthenticated, router, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin
        ? { email, password }
        : { email, password, name: name || undefined };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || (isLogin ? 'Login failed' : 'Registration failed'));
      }

      // Store auth data
      auth.login(data.token, data.account);

      // Redirect to dashboard
      const next = searchParams.get('next') || '/dashboard';
      router.push(next);
    } catch (e) {
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = email && password && (isLogin || password.length >= 6) && !loading;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden fabric-noise">
      {/* Fabric-style background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 fabric-grid opacity-40" />
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-44 -right-44 w-[520px] h-[520px] rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/10 bg-[#0b0c10]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0c10]/60">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button className="flex items-center gap-3" onClick={() => router.push('/')}
            aria-label="Home">
            <div className="h-9 w-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-400" />
            </div>
            <div className="leading-tight text-left">
              <div className="text-xs uppercase tracking-widest text-white/50">Identity & Signing</div>
              <div className="text-lg font-semibold tracking-tight text-white">KYC/KYB Platform</div>
            </div>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-white/70 text-lg">
              {isLogin
                ? 'Sign in to access your identity dashboard'
                : 'Start your journey with secure identity verification'}
            </p>
          </div>

          <div className="glass-card p-8 animate-slide-up">
            {/* Tabs */}
            <div className="flex p-1 bg-white/[0.03] border border-white/10 rounded-full mb-8 relative">
              <div
                className={`absolute inset-y-1 w-1/2 bg-white/[0.06] border border-white/10 rounded-full transition-all duration-300 ease-out ${isLogin ? 'left-1' : 'left-[calc(50%-4px)] translate-x-1'
                  }`}
              ></div>
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(null); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors relative z-10 ${isLogin ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(null); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors relative z-10 ${!isLogin ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name field (signup only) */}
              {!isLogin && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name (optional)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
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

              {/* Email field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
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

              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
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
                {!isLogin && (
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="glass-card p-4 border-red-500/20 bg-red-500/10 flex items-start gap-3 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              {/* Success message */}
              {success && (
                <div className="glass-card p-4 border-green-500/20 bg-green-500/10 flex items-start gap-3 animate-fade-in">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-green-200 text-sm">{success}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`primary-button w-full flex items-center justify-center gap-2 group ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                  </>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Footer note */}
            <p className="text-center text-gray-500 text-sm mt-6">
              {isLogin ? (
                <>Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => setIsLogin(false)} className="text-primary-400 hover:underline">Sign up</button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => setIsLogin(true)} className="text-primary-400 hover:underline">Sign in</button>
                </>
              )}
            </p>
          </div>

          {/* Security note */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm mb-4">Secured by</p>
            <div className="flex justify-center gap-6 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="font-bold text-gray-400">ETHEREUM</span>
              <span className="font-bold text-gray-400">POLYGON</span>
              <span className="font-bold text-gray-400">IPFS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
