/**
 * CCT API Client - Secure Version
 * No hardcoded API keys - requires explicit authentication
 */

class CCTApiClient {
    constructor(options = {}) {
        // SECURITY: No fallback to hardcoded keys
        this.apiKey = options.apiKey;

        if (!this.apiKey) {
            throw new Error('API key is required for authentication. Please provide a valid API key.');
        }

        this.baseUrl = options.baseUrl || '/api/v1';
        this.timeout = options.timeout || 30000;
        this.cache = new Map();
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey
        };
    }

    // SECURITY: Removed insecure localStorage storage
    getStoredApiKey() {
        // SECURITY: Do not store API keys in localStorage
        console.warn('API key storage in localStorage is disabled for security reasons');
        return null;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            timeout: this.timeout,
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                throw new Error('Authentication failed. Please check your API key.');
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error.message);
            throw error;
        }
    }

    // Cache management without authentication data
    clearCache() {
        this.cache.clear();
    }

    // Example API methods
    async getSymbols() {
        return this.request('/data/symbols');
    }

    async getSentimentAnalysis(symbol) {
        return this.request(`/sentiment/symbols/${symbol}`);
    }

    async getReports(reportType) {
        return this.request(`/reports/${reportType}`);
    }
}

// Secure initialization helper
window.CCTApiClient = {
    create: function(options) {
        if (!options.apiKey) {
            throw new Error('API key is required. Please authenticate first.');
        }
        return new CCTApiClient(options);
    }
};

// Global API client instance (requires authentication)
window.cctApi = null;

window.initializeCctApi = function(apiKey) {
    if (!apiKey) {
        throw new Error('API key is required for initialization.');
    }
    window.cctApi = new CCTApiClient({ apiKey: apiKey });
    return window.cctApi;
};

console.log('CCT API Client module loaded');