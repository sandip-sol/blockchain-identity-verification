'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useIdentityToken } from './useContract';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useKYC() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const identityToken = useIdentityToken();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Submit KYC data
    const submitKYC = useCallback(async (kycData, files) => {
        if (!address) {
            throw new Error('Wallet not connected');
        }

        setLoading(true);
        setError(null);

        try {
            // Sign message to verify wallet ownership
            const message = `Submit KYC for ${address}`;
            const signature = await signMessageAsync({ message });

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('walletAddress', address);
            formData.append('signature', signature);
            formData.append('kycData', JSON.stringify(kycData));

            // Add files with specific field names expected by backend
            if (files && files.length > 0) {
                // Map files to expected field names
                const fileFields = ['governmentId', 'addressProof', 'selfie'];
                files.forEach((file, index) => {
                    if (index < fileFields.length) {
                        formData.append(fileFields[index], file);
                    }
                });
            }

            // Submit to backend
            const response = await axios.post(
                `${API_URL}/api/kyc/submit`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            setLoading(false);
            return response.data;
        } catch (err) {
            console.error('KYC submission error:', err);
            const retryAfter = err.response?.headers?.['retry-after'];
            const baseMessage = err.response?.data?.error || err.message;
            const nextError = err.response?.status === 429 && retryAfter
                ? `${baseMessage} Retry after ${retryAfter} seconds.`
                : baseMessage;
            setError(nextError);
            setLoading(false);
            throw new Error(nextError);
        }
    }, [address, signMessageAsync]);

    // Check verification status
    const checkStatus = useCallback(async (walletAddress = address) => {
        if (!walletAddress) return null;

        try {
            const response = await axios.get(
                `${API_URL}/api/kyc/status/${walletAddress}`
            );
            return response.data;
        } catch (err) {
            console.error('Status check error:', err);
            return null;
        }
    }, [address]);

    // Get identity token metadata from blockchain
    const getIdentityToken = useCallback(async () => {
        if (!address || !identityToken) return null;

        try {
            // Check if user has a token
            const tokenId = await identityToken.read('userToToken', address);

            if (!tokenId || tokenId.toString() === '0') {
                return null;
            }

            // Get token metadata
            const metadata = await identityToken.read('getTokenMetadata', tokenId);

            return {
                tokenId: tokenId.toString(),
                dataHash: metadata[0],
                verifier: metadata[1],
                verificationType: metadata[2],
                verifiedAt: new Date(Number(metadata[3]) * 1000),
                expiryDate: new Date(Number(metadata[4]) * 1000),
                isRevoked: metadata[5],
            };
        } catch (err) {
            console.error('Error fetching identity token:', err);
            return null;
        }
    }, [address, identityToken]);

    // Check if address is verified on-chain
    const isVerified = useCallback(async (walletAddress = address) => {
        if (!walletAddress || !identityToken) return false;

        try {
            return await identityToken.read('isVerified', walletAddress);
        } catch (err) {
            console.error('Verification check error:', err);
            return false;
        }
    }, [address, identityToken]);

    return {
        submitKYC,
        checkStatus,
        getIdentityToken,
        isVerified,
        loading,
        error,
    };
}
