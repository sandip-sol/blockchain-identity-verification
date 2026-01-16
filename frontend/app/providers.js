'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import { polygonMumbai, hardhat } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';

import { defineChain } from 'viem';

const hoodi = defineChain({
    id: 560048,
    name: 'Hoodi',
    network: 'hoodi',
    nativeCurrency: {
        decimals: 18,
        name: 'Hoodi Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: ['https://rpc.hoodi.ethpandaops.io'] },
        public: { http: ['https://rpc.hoodi.ethpandaops.io'] },
    },
    blockExplorers: {
        default: {
            name: 'Hoodi Explorer',
            url: 'https://explorer.hoodi.ethpandaops.io',
        },
    },
    testnet: true,
});

const config = getDefaultConfig({
    appName: 'KYC/KYB Platform',
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || 'YOUR_PROJECT_ID',
    chains: [hoodi, hardhat, polygonMumbai],
    transports: {
        [hoodi.id]: http(),
        [polygonMumbai.id]: http(),
        [hardhat.id]: http('http://127.0.0.1:8545'),
    },
    ssr: true, // Enable SSR support
});

const queryClient = new QueryClient();

export function Providers({ children }) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    {mounted && children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
