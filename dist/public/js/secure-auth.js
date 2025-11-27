/**
 * Secure Authentication Module
 * Replaces hardcoded API keys with proper authentication
 */

class SecureAuth {
    constructor() {
        this.apiKey = null;
        this.isAuthenticated = false;
    }

    // Initialize with API key
    async authenticate(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required for authentication');
        }

        try {
            // Test API key validity
            const response = await fetch('/api/v1/health', {
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.apiKey = apiKey;
                this.isAuthenticated = true;

                // Initialize global API client
                if (window.initializeCctApi) {
                    window.cctApi = window.initializeCctApi(apiKey);
                }

                return true;
            } else {
                throw new Error('Invalid API key');
            }
        } catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    // Logout
    logout() {
        this.apiKey = null;
        this.isAuthenticated = false;
        if (window.cctApi) {
            window.cctApi = null;
        }
    }

    // Get authentication status
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            hasApiKey: !!this.apiKey
        };
    }
}

// Global authentication instance
window.secureAuth = new SecureAuth();

// Authentication helper functions
window.requireAuthentication = function() {
    if (!window.secureAuth.isAuthenticated) {
        throw new Error('Authentication required. Please provide a valid API key.');
    }
};

window.showAuthenticationDialog = function() {
    // Create modal for API key input
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; max-width: 400px;">
                <h3>Authentication Required</h3>
                <p>Please enter your API key to continue:</p>
                <input type="password" id="apiKeyInput" placeholder="Enter API key" style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;">
                <button onclick="submitApiKey()" style="background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Authenticate</button>
                <button onclick="closeAuthDialog()" style="background: #ccc; color: black; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.submitApiKey = async function() {
    const input = document.getElementById('apiKeyInput');
    const apiKey = input.value.trim();

    if (!apiKey) {
        alert('Please enter a valid API key');
        return;
    }

    try {
        await window.secureAuth.authenticate(apiKey);
        closeAuthDialog();
        location.reload(); // Reload to initialize authenticated state
    } catch (error) {
        alert(`Authentication failed: ${error.message}`);
    }
};

window.closeAuthDialog = function() {
    const modal = document.querySelector('div[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
};
