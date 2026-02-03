/**
 * Frontend Configuration
 * API key for cctApi - must match server X_API_KEY secret
 */
(function() {
  window.CCT_API_KEY = 'yanggf';
  window.CCT_ENV = 'production';

  // AI Model display names (update when models change)
  // API responses use model-agnostic naming: primary/mate (with backward compat for gpt/distilbert/gemma)
  window.CCT_MODELS = {
    primary: {
      id: 'gpt-oss-120b',
      name: 'GPT-OSS 120B',
      field: 'primary',      // Current field name in API responses
      legacyFields: ['gpt', 'gemma']  // Legacy field names for backward compat
    },
    secondary: {
      id: 'deepseek-r1-distill-qwen-32b',
      name: 'DeepSeek-R1 32B',
      field: 'mate',         // Current field name in API responses
      legacyFields: ['distilbert']  // Legacy field names for backward compat
    }
  };
})();
