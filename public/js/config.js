/**
 * Frontend Configuration
 * API key for cctApi - must match server X_API_KEY secret
 */
(function() {
  window.CCT_API_KEY = 'yanggf';
  window.CCT_ENV = 'production';

  // AI Model display names (update when models change)
  window.CCT_MODELS = {
    primary: {
      id: 'gpt-oss-120b',
      name: 'GPT-OSS 120B',
      field: 'gpt'  // Legacy field name in API responses
    },
    secondary: {
      id: 'deepseek-r1-distill-qwen-32b',
      name: 'DeepSeek-R1 32B',
      field: 'distilbert'  // Legacy field name in API responses
    }
  };
})();
