'use client';

import { BrowserProvider } from 'ethers';

function getInjectedProvider() {
  if (typeof window === 'undefined') return null;
  return window.ethereum || null;
}

export function hasInjectedWallet() {
  return Boolean(getInjectedProvider());
}

export async function connectInjectedWallet() {
  const injected = getInjectedProvider();
  if (!injected) {
    const error = new Error('No wallet detected. Install MetaMask or another injected wallet to continue.');
    error.code = 'WALLET_NOT_INSTALLED';
    throw error;
  }

  const provider = new BrowserProvider(injected);
  const accounts = await provider.send('eth_requestAccounts', []);
  const address = accounts?.[0];

  if (!address) {
    const error = new Error('Wallet connection did not return an account.');
    error.code = 'WALLET_NO_ACCOUNT';
    throw error;
  }

  return { provider, address };
}

export async function signWalletMessage(message) {
  const { provider, address } = await connectInjectedWallet();
  const signer = await provider.getSigner();
  const signature = await signer.signMessage(message);

  return { address, signature };
}

export function toWalletErrorMessage(error) {
  if (!error) return 'Wallet linking failed. Please try again.';

  if (error.code === 'WALLET_NOT_INSTALLED') {
    return error.message;
  }

  if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
    return 'Wallet request was rejected. You can try again whenever you are ready.';
  }

  const message = String(error.message || '');

  if (message.toLowerCase().includes('user rejected')) {
    return 'Signature request was rejected. No gas fee was charged.';
  }

  if (message.toLowerCase().includes('nonce')) {
    return 'Could not create a wallet verification request. Please try again.';
  }

  return message || 'Wallet linking failed. Please try again.';
}
