'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useIdentityToken } from './useContract';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useKYC() {
    const { address } = useAccount();
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
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('walletAddress', address);
            formData.append('verificationType', 'KYC');

            // Add KYC fields
            Object.keys(kycData).forEach(key => {
                formData.append(key, kycData[key]);
            });

            // Add files
            if (files && files.length > 0) {
                files.forEach((file, index) => {
                    formData.append(`documents`, file);
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
            setError(err.response?.data?.error || err.message);
            setLoading(false);
            throw err;
        }
    }, [address]);

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
