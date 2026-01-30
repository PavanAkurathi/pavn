// apps/workers/lib/api-client.ts
// Centralized API Client with proper error handling and retry logic

import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth-client';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4005';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// =============================================================================
// TYPES
// =============================================================================

export interface ApiError {
    error: string;
    code?: string;
    details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
    data: T | null;
    error: ApiError | null;
    status: number;
}

interface RequestConfig {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    timeout?: number;
    retries?: number;
    skipAuth?: boolean;
}

// =============================================================================
// API CLIENT CLASS
// =============================================================================

class ApiClient {
    private baseUrl: string;
    
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }
    
    /**
     * Get authentication headers
     */
    private async getAuthHeaders(): Promise<Record<string, string>> {
        const token = await SecureStore.getItemAsync('better-auth.session_token');
        const session = await authClient.getSession();
        const orgId = session.data?.session?.activeOrganizationId;
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (orgId) {
            headers['x-org-id'] = orgId;
        }
        
        return headers;
    }
    
    /**
     * Make an API request with retry logic
     */
    async request<T>(
        endpoint: string,
        config: RequestConfig = {}
    ): Promise<ApiResponse<T>> {
        const {
            method = 'GET',
            body,
            timeout = DEFAULT_TIMEOUT,
            retries = MAX_RETRIES,
            skipAuth = false,
        } = config;
        
        const url = `${this.baseUrl}${endpoint}`;
        
        // Get headers
        const headers = skipAuth 
            ? { 'Content-Type': 'application/json' }
            : await this.getAuthHeaders();
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await fetch(url, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });
                
                clearTimeout(timeoutId);
                
                // Parse response
                const contentType = response.headers.get('content-type');
                let data: T | ApiError | null = null;
                
                if (contentType?.includes('application/json')) {
                    data = await response.json();
                }
                
                // Handle errors
                if (!response.ok) {
                    const apiError = data as ApiError;
                    return {
                        data: null,
                        error: {
                            error: apiError?.error || `Request failed with status ${response.status}`,
                            code: apiError?.code || `HTTP_${response.status}`,
                            details: apiError?.details,
                        },
                        status: response.status,
                    };
                }
                
                return {
                    data: data as T,
                    error: null,
                    status: response.status,
                };
                
            } catch (error) {
                lastError = error as Error;
                
                // Don't retry on abort (timeout)
                if ((error as Error).name === 'AbortError') {
                    break;
                }
                
                // Don't retry on 4xx errors
                if (lastError.message.includes('HTTP_4')) {
                    break;
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        
        clearTimeout(timeoutId);
        
        return {
            data: null,
            error: {
                error: lastError?.message || 'Unknown error',
                code: lastError?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
            },
            status: 0,
        };
    }
    
    // Convenience methods
    async get<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) {
        return this.request<T>(endpoint, { ...config, method: 'GET' });
    }
    
    async post<T>(endpoint: string, body?: Record<string, unknown>, config?: Omit<RequestConfig, 'method'>) {
        return this.request<T>(endpoint, { ...config, method: 'POST', body });
    }
    
    async patch<T>(endpoint: string, body?: Record<string, unknown>, config?: Omit<RequestConfig, 'method'>) {
        return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
    }
    
    async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) {
        return this.request<T>(endpoint, { ...config, method: 'DELETE' });
    }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const apiClient = new ApiClient(API_BASE_URL);

export default apiClient;
