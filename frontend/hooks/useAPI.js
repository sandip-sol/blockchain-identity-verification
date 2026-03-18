'use client';

import axios from 'axios';
import { useCallback, useMemo } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000;

// Create axios instance with defaults
const apiClient = axios.create({
    baseURL: API_URL,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add auth token if available
        const token = localStorage.getItem('kyc_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Server responded with error status
            console.error('API Error:', error.response.data);
        } else if (error.request) {
            // Request made but no response
            console.error('Network Error:', error.message);
        } else {
            // Something else happened
            console.error('Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export function useAPI() {
    const get = useCallback(async (url, config = {}) => {
        try {
            const response = await apiClient.get(url, config);
            return response.data;
        } catch (error) {
            throw error;
        }
    }, []);

    const post = useCallback(async (url, data, config = {}) => {
        try {
            const response = await apiClient.post(url, data, config);
            return response.data;
        } catch (error) {
            throw error;
        }
    }, []);

    const put = useCallback(async (url, data, config = {}) => {
        try {
            const response = await apiClient.put(url, data, config);
            return response.data;
        } catch (error) {
            throw error;
        }
    }, []);

    const patch = useCallback(async (url, data, config = {}) => {
        try {
            const response = await apiClient.patch(url, data, config);
            return response.data;
        } catch (error) {
            throw error;
        }
    }, []);

    const del = useCallback(async (url, config = {}) => {
        try {
            const response = await apiClient.delete(url, config);
            return response.data;
        } catch (error) {
            throw error;
        }
    }, []);

    return useMemo(() => ({
        get,
        post,
        put,
        patch,
        delete: del,
        client: apiClient,
    }), [get, post, put, patch, del]);
}

export default apiClient;
