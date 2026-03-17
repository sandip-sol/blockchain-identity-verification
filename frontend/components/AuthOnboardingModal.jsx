'use client';

import { AlertCircle, CheckCircle2, ChevronRight, Loader2, Shield, Wallet } from 'lucide-react';

const STEP_LABELS = {
  idle: 'Ready to start',
  connecting: 'Connecting wallet',
  nonce: 'Requesting verification message',
  signing: 'Waiting for signature',
  linking: 'Linking wallet',
  success: 'Wallet linked',
  error: 'Wallet linking failed',
};

function StepRow({ label, active, complete }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${
        complete ? 'border-green-400/30 bg-green-400/10 text-green-300' : active ? 'border-primary-500/40 bg-primary-500/10 text-primary-300' : 'border-white/10 bg-white/[0.03] text-white/40'
      }`}>
        {complete ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
      </div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-white/50">{complete ? 'Completed' : active ? 'In progress' : 'Pending'}</p>
      </div>
    </div>
  );
}

export default function AuthOnboardingModal({
  open,
  account,
  walletState,
  walletError,
  onClose,
  onSkip,
  onLinkWallet,
}) {
  if (!open) return null;

  const steps = [
    { key: 'connecting', label: 'Connect your wallet' },
    { key: 'nonce', label: 'Get a verification message' },
    { key: 'signing', label: 'Sign the message' },
    { key: 'linking', label: 'Attach wallet to account' },
  ];

  const activeIndex = steps.findIndex((step) => step.key === walletState);
  const success = walletState === 'success';
  const busy = ['connecting', 'nonce', 'signing', 'linking'].includes(walletState);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-6 backdrop-blur md:items-center">
      <div className="glass-card w-full max-w-2xl overflow-hidden border-white/15">
        <div className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary-500/20 bg-primary-500/10">
              <Shield className="h-6 w-6 text-primary-300" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Post-login onboarding</p>
              <h2 className="mt-2 font-['Space_Grotesk'] text-3xl font-semibold tracking-tight text-white">
                Link your wallet now?
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {account?.address
                  ? 'Your account already has a linked wallet, so there is nothing else to do here.'
                  : 'Email and password still authenticate your account. Linking a wallet unlocks blockchain actions and only requires signing a message, not sending a gas transaction.'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary-300" />
              <div>
                <p className="text-sm font-medium text-white">Current account</p>
                <p className="text-sm text-white/60">{account?.email || 'Signed-in account'}</p>
              </div>
            </div>
            {account?.address ? (
              <p className="mt-4 rounded-xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-sm text-green-200">
                Wallet already linked: <span className="font-mono text-xs">{account.address}</span>
              </p>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/60">
                Wallet features are optional for now. You can link one here or continue straight to your dashboard.
              </p>
            )}
          </div>

          {!account?.address && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Wallet linking progress</p>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">{STEP_LABELS[walletState] || STEP_LABELS.idle}</p>
              </div>
              <div className="grid gap-3">
                {steps.map((step, index) => (
                  <StepRow
                    key={step.key}
                    label={step.label}
                    active={walletState === step.key}
                    complete={success || (activeIndex !== -1 && index < activeIndex)}
                  />
                ))}
              </div>
            </div>
          )}

          {walletError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-100">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
              <p>{walletError}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-4 text-sm text-green-100">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-300" />
              <p>Your wallet is linked and ready for blockchain-based actions.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={success || account?.address ? onClose : onSkip}
            className="secondary-button"
            disabled={busy}
          >
            {success || account?.address ? 'Continue to dashboard' : 'Skip for now'}
          </button>
          {!account?.address && (
            <button
              type="button"
              onClick={onLinkWallet}
              disabled={busy}
              className="primary-button inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {busy ? STEP_LABELS[walletState] : 'Link Wallet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
