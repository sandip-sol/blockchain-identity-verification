/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };
        return config;
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'ipfs.io', pathname: '/**' },
            { protocol: 'https', hostname: 'ipfs.infura.io', pathname: '/**' },
        ],
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    }
};

module.exports = nextConfig;
