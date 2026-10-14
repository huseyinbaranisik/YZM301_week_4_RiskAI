const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // popup.html'yi doğrudan dosya yoluyla aç
    baseUrl: null,
    specPattern: "cypress/e2e/**/*.cy.js",

    // ── Video ayarları ──────────────────────────────
    video: true,
    videoCompression: 32,       // 0-51 arası; düşük = yüksek kalite
    videosFolder: "cypress/videos",
    screenshotOnRunFailure: true,
    screenshotsFolder: "cypress/screenshots",

    // ── Viewport: Chrome extension popup boyutu ─────
    viewportWidth: 460,
    viewportHeight: 600,

    // ── Timeout ayarları ────────────────────────────
    defaultCommandTimeout: 8000,
    pageLoadTimeout: 15000,

    setupNodeEvents(on, config) {
      // Gerekirse buraya node event listener ekle
    },
  },
});
