/**
 * API Service Layer
 * Handles all HTTP communication with the backend
 */

export class ApiService {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || '';
        this.defaultHeaders = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.defaultHeaders
        };
        this.credentials = options.credentials || 'include';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            credentials: this.credentials,
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            // Handle authentication redirects
            if (response.status === 401) {
                this.handleUnauthorized();
                throw new ApiError('Authentication required', 401);
            }

            // Parse response based on content type
            let data;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw new ApiError(data.message || `HTTP ${response.status}`, response.status, data);
            }

            return data;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(`Network error: ${error.message}`, 0, null, error);
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { method: 'GET', ...options });
    }

    async post(endpoint, data, options = {}) {
        const config = { method: 'POST', ...options };

        if (data instanceof FormData) {
            // Remove Content-Type header for FormData (browser will set it with boundary)
            const headers = { ...config.headers };
            delete headers['Content-Type'];
            config.headers = headers;
            config.body = data;
        } else {
            config.body = JSON.stringify(data);
        }

        return this.request(endpoint, config);
    }

    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { method: 'DELETE', ...options });
    }

    async downloadFile(endpoint, options = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            credentials: this.credentials,
            ...options
        });

        if (response.status === 401) {
            this.handleUnauthorized();
            throw new ApiError('Authentication required', 401);
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new ApiError(data.message || 'Download failed', response.status);
        }

        return response.blob();
    }

    handleUnauthorized() {
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }

    // User API methods
    async getCurrentUser() {
        return this.get('/api/user');
    }

    async logout() {
        return this.post('/api/logout');
    }

    // Proposal API methods
    async getProposals() {
        return this.get('/api/proposals');
    }

    async createProposal(name) {
        return this.post('/api/proposals', { name });
    }

    async deleteProposal(id) {
        return this.delete(`/api/proposals/${id}`);
    }

    async updateProposal(id, updates) {
        return this.put(`/api/proposals/${id}`, updates);
    }

    async getProposal(id) {
        return this.get(`/api/proposals/${id}`);
    }

    // Document processing API methods
    async uploadRfpDocument(proposalId, file) {
        const formData = new FormData();
        formData.append('rfpDocument', file);
        return this.post(`/api/proposals/${proposalId}/upload-rfp`, formData);
    }

    async downloadArtifact(proposalId, fileName) {
        return this.downloadFile(`/api/proposals/${proposalId}/artifacts/${encodeURIComponent(fileName)}`);
    }

    // Utility methods for file downloads
    downloadBlob(blob, fileName) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

export class ApiError extends Error {
    constructor(message, status, data = null, originalError = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
        this.originalError = originalError;
    }

    isNetworkError() {
        return this.status === 0;
    }

    isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    isServerError() {
        return this.status >= 500;
    }

    isUnauthorized() {
        return this.status === 401;
    }

    isForbidden() {
        return this.status === 403;
    }

    isNotFound() {
        return this.status === 404;
    }
}

// Request interceptor utility
export class RequestInterceptor {
    constructor() {
        this.interceptors = {
            request: [],
            response: []
        };
    }

    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }

    async executeRequestInterceptors(config) {
        let result = config;
        for (const interceptor of this.interceptors.request) {
            result = await interceptor(result);
        }
        return result;
    }

    async executeResponseInterceptors(response) {
        let result = response;
        for (const interceptor of this.interceptors.response) {
            result = await interceptor(result);
        }
        return result;
    }
}

// Factory for creating pre-configured API service instances
export class ApiServiceFactory {
    static createDefault() {
        return new ApiService({
            baseUrl: '',
            credentials: 'include',
            defaultHeaders: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
    }

    static createWithAuth(token) {
        return new ApiService({
            baseUrl: '',
            credentials: 'include',
            defaultHeaders: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
    }
}

// Utility functions
export const ApiUtils = {
    buildQueryString(params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                searchParams.append(key, String(value));
            }
        });
        return searchParams.toString();
    },

    parseErrorMessage(error) {
        if (error instanceof ApiError) {
            return error.message;
        }
        if (error && error.message) {
            return error.message;
        }
        return 'An unexpected error occurred';
    },

    isRetryableError(error) {
        if (error instanceof ApiError) {
            return error.isServerError() || error.isNetworkError();
        }
        return false;
    }
};