/**
 * BGI Content Studio - Server Entry Point (CommonJS wrapper)
 * 
 * electron-packager bundles the app and Electron's binary IS Node.js,
 * but it can't directly run ES module (.mjs) files as standalone scripts.
 * This CJS wrapper uses dynamic import() to load the ESM server.
 */
(async () => {
  try {
    await import('./scraper.mjs');
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
