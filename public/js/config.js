/**
 * Frontend Configuration
 * API key loaded from environment - update via deployment or wrangler
 */
(function() {
  // API key for authenticated requests
  // This should match the X_API_KEY secret configured in wrangler
  // In production, this is injected during deployment
  window.CCT_API_KEY = 'yanggf';

  // Environment indicator
  window.CCT_ENV = 'production';
})();
