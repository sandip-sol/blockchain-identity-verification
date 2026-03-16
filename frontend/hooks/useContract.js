'use client';

import { useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { Contract } from 'ethers';
import { BrowserProvider } from 'ethers';

// Import contract ABIs (you'll need to export these from compiled contracts)
import IdentityTokenABI from '../contracts/IdentityToken.json';
import TransactionRegistryABI from '../contracts/TransactionRegistry.json';
import DataAccessControlABI from '../contracts/DataAccessControl.json';

const CONTRACT_ADDRESSES = {
    identityToken: process.env.NEXT_PUBLIC_IDENTITY_TOKEN_ADDRESS,
    transactionRegistry: process.env.NEXT_PUBLIC_TRANSACTION_REGISTRY_ADDRESS,
    dataAccessControl: process.env.NEXT_PUBLIC_DATA_ACCESS_CONTROL_ADDRESS,
};

export function useContract(contractName) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();

    const contract = useMemo(() => {
        if (!walletClient || !address) return null;

        let abi, contractAddress;

        switch (contractName) {
            case 'identityToken':
                abi = IdentityTokenABI.abi;
                contractAddress = CONTRACT_ADDRESSES.identityToken;
                break;
            case 'transactionRegistry':
                abi = TransactionRegistryABI.abi;
                contractAddress = CONTRACT_ADDRESSES.transactionRegistry;
                break;
            case 'dataAccessControl':
                abi = DataAccessControlABI.abi;
                contractAddress = CONTRACT_ADDRESSES.dataAccessControl;
                break;
            default:
                return null;
        }

        if (!contractAddress) {
            console.warn(`Contract address not found for ${contractName}`);
            return null;
        }

        // Create ethers provider from walletClient
        const provider = new BrowserProvider(walletClient);

        return {
            address: contractAddress,
            abi,
            read: async (method, ...args) => {
                try {
                    const contract = new Contract(contractAddress, abi, provider);
                    return await contract[method](...args);
                } catch (error) {
                    console.error(`Error reading ${method}:`, error);
                    throw error;
                }
            },
            write: async (method, ...args) => {
                try {
                    const signer = await provider.getSigner();
                    const contract = new Contract(contractAddress, abi, signer);
                    const tx = await contract[method](...args);
                    return await tx.wait();
                } catch (error) {
                    console.error(`Error writing ${method}:`, error);
                    throw error;
                }
            },
        };
    }, [contractName, walletClient, address]);

    return contract;
}

// Specific contract hooks
export function useIdentityToken() {
    return useContract('identityToken');
}

export function useTransactionRegistry() {
    return useContract('transactionRegistry');
}

export function useDataAccessControl() {
    return useContract('dataAccessControl');
}
