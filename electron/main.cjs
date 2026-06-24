/**
 * BGI Content Studio - Electron Main Process
 * Mengelola window aplikasi, backend Express server, dan auto-install Playwright
 *
 * NOTE: This file uses CommonJS (require) intentionally.
 * Electron's main process requires CJS even when package.json has "type": "module".
 */
const { app, BrowserWindow, shell, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const http = require('http');
const fs = require('fs');
const updater = require('./updater.cjs');

// Disable GPU acceleration untuk stabilitas
app.disableHardwareAcceleration();

// ===== Single Instance Lock =====
// Prevent multiple windows from opening when user double-clicks .exe repeatedly
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // If a second instance is launched, focus the existing window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow;
let splashWindow;
let serverProcess;
let serverPort = 3001;

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

// ===== Splash Screen =====
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0f0f23'
  });

  const splashHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0f0f23 0%,#1a1a3e 50%,#0f0f23 100%);display:flex;align-items:center;justify-content:center;height:100vh;color:#c7d2fe;">
  <div style="text-align:center;padding:2rem;">
    <div style="font-size:2.5rem;margin-bottom:0.5rem;">🚀</div>
    <h2 style="margin:0 0 1.5rem 0;font-size:1.2rem;color:#a78bfa;">BGI Content Studio</h2>
    <div id="status" style="font-size:0.85rem;color:#818cf8;margin-bottom:1rem;">Memeriksa komponen...</div>
    <div style="width:320px;height:6px;background:rgba(99,102,241,0.2);border-radius:3px;overflow:hidden;margin:0 auto;">
      <div id="progress" style="width:10%;height:100%;background:linear-gradient(90deg,#6366f1,#a78bfa);border-radius:3px;transition:width 0.3s ease;"></div>
    </div>
    <div id="detail" style="font-size:0.7rem;color:#4b5563;margin-top:0.75rem;max-width:320px;word-wrap:break-word;"></div>
  </div>
</body>
</html>`;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml));
  splashWindow.center();
  return splashWindow;
}

function updateSplash(progress, status, detail) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    const script = `
      document.getElementById('progress').style.width = '${progress}%';
      document.getElementById('status').textContent = '${status.replace(/'/g, "\\'")}';
      if (document.getElementById('detail')) document.getElementById('detail').textContent = '${(detail || '').replace(/'/g, "\\'")}';
    `;
    splashWindow.webContents.executeJavaScript(script).catch(() => {});
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ===== Playwright Browser Auto-Install =====
function getPlaywrightBrowserDir() {
  // Playwright stores browsers in ~/.cache/ms-playwright (Linux/Mac)
  // or %LOCALAPPDATA%/ms-playwright (Windows)
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'ms-playwright');
  } else if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'ms-playwright');
  }
  return path.join(home, '.cache', 'ms-playwright');
}

function isChromiumInstalled() {
  const browserDir = getPlaywrightBrowserDir();
  if (!fs.existsSync(browserDir)) return false;

  // Check for chromium-* directory and verify the actual chrome binary exists
  try {
    const entries = fs.readdirSync(browserDir);
    for (const entry of entries) {
      if (!entry.startsWith('chromium-')) continue;
      const chromiumDir = path.join(browserDir, entry);
      if (!fs.statSync(chromiumDir).isDirectory()) continue;

      // Check for the actual chrome binary inside
      const chromePath = process.platform === 'win32'
        ? path.join(chromiumDir, 'chrome-win', 'chrome.exe')
        : process.platform === 'darwin'
          ? path.join(chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
          : path.join(chromiumDir, 'chrome-linux', 'chrome');

      if (fs.existsSync(chromePath)) {
        console.log(`[Main] Found Chromium binary: ${chromePath}`);
        return true;
      }
    }
    return false;
  } catch (_) {
    return false;
  }
}

function ensurePlaywrightBrowsers(splashWin) {
  return new Promise((resolve, reject) => {
    if (isChromiumInstalled()) {
      console.log('[Main] Playwright Chromium already installed, skipping...');
      updateSplash(100, 'Siap!', '');
      setTimeout(resolve, 300);
      return;
    }

    console.log('[Main] Playwright Chromium not found, installing...');
    updateSplash(5, 'Mengunduh Chromium...', 'Ini mungkin memakan waktu 1-3 menit tergantung koneksi internet.');

    const isWin = process.platform === 'win32';
    let cmd, args;

    if (isDev) {
      // Development: use npx from local node_modules
      cmd = isWin ? 'npx.cmd' : 'npx';
      args = ['playwright', 'install', 'chromium'];
    } else {
      // Production: Electron IS Node.js — use process.execPath to run scripts
      // process.execPath = the Electron binary which includes Node.js runtime
      const appDir = path.join(process.resourcesPath, 'app');
      const playwrightScript = path.join(appDir, 'node_modules', 'playwright', 'cli.js');

      if (fs.existsSync(playwrightScript)) {
        // Use Electron binary itself to run Playwright CLI (it IS Node.js)
        cmd = process.execPath;
        args = [playwrightScript, 'install', 'chromium'];
      } else {
        // Fallback: try system node (user might have it installed)
        cmd = isWin ? 'node.exe' : 'node';
        args = [path.join(appDir, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium'];
      }
    }

    console.log(`[Main] Running: ${cmd} ${args.join(' ')}`);

    const installProcess = spawn(cmd, args, {
      cwd: isDev ? path.join(__dirname, '..') : process.resourcesPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: getPlaywrightBrowserDir() }
    });

    // 5-minute timeout to prevent hanging
    const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      console.error('[Main] Playwright install timed out after 5 minutes');
      installProcess.kill('SIGTERM');
      reject(new Error('Playwright install timeout - unduhan terlalu lama. Periksa koneksi internet Anda.'));
    }, INSTALL_TIMEOUT_MS);

    installProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[Playwright Install]', text.trim());

      // Parse download progress
      const downloadMatch = text.match(/(\d+)%/);
      if (downloadMatch) {
        const pct = parseInt(downloadMatch[1]);
        const progress = 10 + Math.floor(pct * 0.8);
        updateSplash(progress, 'Mengunduh Chromium...', `${pct}% terunduh`);
      }

      if (text.includes('Downloading') || text.includes('downloading')) {
        updateSplash(15, 'Mengunduh Chromium...', text.trim().substring(0, 80));
      }
      if (text.includes('Extracting') || text.includes('extracting')) {
        updateSplash(85, 'Mengekstrak file...', text.trim().substring(0, 80));
      }
    });

    installProcess.stderr.on('data', (data) => {
      const text = data.toString();
      console.error('[Playwright Install Error]', text.trim());
    });

    installProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      console.error('[Main] Failed to run playwright install:', err);
      reject(new Error(`Gagal menjalankan playwright install: ${err.message}`));
    });

    installProcess.on('exit', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        updateSplash(95, 'Selesai mengunduh...', '');
        console.log('[Main] Playwright Chromium installed successfully');
        setTimeout(resolve, 500);
      } else {
        reject(new Error(`Playwright install exited with code ${code}. Silakan coba lagi.`));
      }
    });
  });
}

// ===== Server Health Check =====
function waitForServerReady(port, maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://localhost:${port}/api/health`, { timeout: 2000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`[Main] Server ready on port ${port}`);
            resolve(port);
          } else if (++attempts < maxAttempts) {
            setTimeout(check, interval);
          } else {
            reject(new Error(`Server health check failed after ${maxAttempts} attempts`));
          }
        });
      });
      req.on('error', () => {
        if (++attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          reject(new Error(`Server not reachable on port ${port} after ${maxAttempts} attempts`));
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (++attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          reject(new Error(`Server health check timed out after ${maxAttempts} attempts`));
        }
      });
    };
    check();
  });
}

// ===== Express Server =====
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server', 'scraper.mjs');
    
    console.log('[Main] Starting Express server...');
    updateSplash(96, 'Memulai server...');

    // In production (packaged app), 'node' is not in PATH.
    // Electron binary IS Node.js — use process.execPath to run the server script.
    const cmd = isDev ? 'node' : process.execPath;
    const appDir = path.join(__dirname, '..');

    serverProcess = spawn(cmd, [serverPath], {
      cwd: appDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        BGI_SERVER_PORT: String(serverPort)
      }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Server]', output);
      
      const portMatch = output.match(/http:\/\/localhost:(\d+)/);
      if (portMatch) {
        serverPort = parseInt(portMatch[1]);
        console.log(`[Main] Server running on port ${serverPort}`);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('[Main] Failed to start server:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Main] Server exited with code ${code}`);
    });

    setTimeout(() => {
      waitForServerReady(serverPort)
        .then(() => resolve(serverPort))
        .catch(reject);
    }, 1000);
  });
}

// ===== Main Application Window =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'BGI Content Studio',
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: isDev ? false : true
    },
    show: false,
    backgroundColor: '#0f0f23'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Load from Express server so relative /api/ URLs work (no Vite proxy in production)
    mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  mainWindow.once('ready-to-show', () => {
    closeSplash();
    mainWindow.show();
    console.log('[Main] Window ready');
    
    // Set updater window reference and check for updates
    updater.setMainWindow(mainWindow);
    if (!isDev) {
      setTimeout(() => updater.checkForUpdates(), 5000);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== Server Cleanup =====
function stopServer() {
  if (serverProcess) {
    console.log('[Main] Stopping server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ===== IPC Handlers =====
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('close-window', () => mainWindow?.close());

ipcMain.handle('show-save-dialog', async (_, options) => {
  return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (_, options) => {
  return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.on('show-notification', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// ===== Update Handlers =====
ipcMain.handle('check-for-updates', () => updater.checkForUpdates());
ipcMain.handle('download-update', () => updater.downloadAndInstall());

// ===== App Lifecycle =====
app.whenReady().then(async () => {
  try {
    // 1. Show splash screen
    createSplashWindow();
    updateSplash(2, 'Memeriksa komponen...');

    // 2. Ensure Playwright Chromium is installed
    await ensurePlaywrightBrowsers(splashWindow);
    updateSplash(95, 'Memulai server...');

    // 3. Start Express backend
    await startServer();
    updateSplash(99, 'Membuka aplikasi...');

    // 4. Create main window
    createWindow();

    console.log('[Main] App ready');
  } catch (err) {
    console.error('[Main] Failed to start:', err);
    closeSplash();
    
    // Show error dialog before quitting
    dialog.showErrorBox(
      'BGI Content Studio - Error',
      `Gagal memulai aplikasi:\n\n${err.message}\n\nSilakan coba jalankan ulang.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopServer();
  closeSplash();
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});
