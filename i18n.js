// Internationalization (i18n) Module
// Auto-detects browser language, loads locale JSON, and applies translations

(function() {
  'use strict';

  /**
   * Detect browser language and match to supported locales
   * Supports language prefix matching (zh-CN → zh, en-US → en, ja-JP → ja)
   * @returns {string} Language code ('zh', 'en', or 'ja')
   */
  function detectLanguage() {
    const lang = navigator.language || 'zh';
    const prefix = lang.split('-')[0].toLowerCase();
    return ['zh', 'en', 'ja'].includes(prefix) ? prefix : 'zh';
  }

  /**
   * Load locale JSON file
   * @param {string} lang - Language code
   * @returns {Promise<Object>} Translations object
   * @throws {Error} If fetch fails
   */
  async function loadLocale(lang) {
    const response = await fetch(`locales/${lang}.json`);
    if (!response.ok) throw new Error('Failed to load locale');
    return response.json();
  }

  /**
   * Update meta tags with translations
   * @param {Object} translations - Translations object
   */
  function updateMeta(translations) {
    // Update page title
    if (translations['meta.title']) {
      document.title = translations['meta.title'];
    }

    // Update meta tags
    const metaUpdates = [
      { selector: 'meta[name="description"]', attr: 'content', key: 'meta.description' },
      { selector: 'meta[name="keywords"]', attr: 'content', key: 'meta.keywords' },
      { selector: 'meta[property="og:title"]', attr: 'content', key: 'og.title' },
      { selector: 'meta[property="og:description"]', attr: 'content', key: 'og.description' },
      { selector: 'meta[name="twitter:title"]', attr: 'content', key: 'og.title' },
      { selector: 'meta[name="twitter:description"]', attr: 'content', key: 'og.description' }
    ];

    metaUpdates.forEach(({ selector, attr, key }) => {
      const el = document.querySelector(selector);
      if (el && translations[key]) {
        el.setAttribute(attr, translations[key]);
      }
    });
  }

  /**
   * Apply translations to DOM
   * - Updates text content for elements with data-i18n
   * - Updates attributes for elements with data-i18n-attr
   * - Updates meta tags
   * @param {Object} translations - Translations object
   */
  function applyTranslations(translations) {
    // 1. Update text content for elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[key]) el.textContent = translations[key];
    });

    // 2. Update attributes for elements with data-i18n-attr
    // Format: data-i18n-attr="alt:avatar.alt" (attribute:translation_key)
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const config = el.getAttribute('data-i18n-attr');
      const [attr, key] = config.split(':');
      if (translations[key]) el.setAttribute(attr, translations[key]);
    });

    // 3. Update meta tags
    updateMeta(translations);
  }

  /**
   * Initialize i18n system
   * Detects language, loads translations, and applies them
   * Falls back to Chinese on error
   */
  async function initI18n() {
    const lang = detectLanguage();
    try {
      const translations = await loadLocale(lang);
      applyTranslations(translations);
      document.documentElement.lang = lang;
    } catch (error) {
      console.error('i18n error, falling back to zh:', error);
      // Fallback to Chinese if not already Chinese
      if (lang !== 'zh') {
        try {
          const zhTranslations = await loadLocale('zh');
          applyTranslations(zhTranslations);
          document.documentElement.lang = 'zh';
        } catch (fallbackError) {
          console.error('Failed to load fallback locale:', fallbackError);
        }
      }
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }

})();