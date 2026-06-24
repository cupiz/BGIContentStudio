/**
 * BGI Content Studio - Custom Auto-Updater
 * Compatible with electron-packager (not electron-builder)
 * 
 * Flow:
 * 1. Check GitHub Releases API for latest version
 * 2. Compare with current version using semver
 * 3. Download ZIP asset
 * 4. Backup current app directory
 * 5. Extract new version
 * 6. Restart app
 * 7. Rollback on failure
 */
const { app, BrowserWindow, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');

const GITHUB_REPO = 'cupiz/BGIContentStudio';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CURRENT_VERSION = app.getVersion();

let mainWindow = null;
let updateAvailable = false;
let downloading = false;

/**
 * Set the main window reference for sending IPC messages
 */
function setMainWindow(win) {
  mainWindow = win;
}

/**
 * Send update status to renderer process
 */
function sendUpdateStatus(status, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...data });
  }
}

/**
 * Get current app version from package.json
 */
function getCurrentVersion() {
  return CURRENT_VERSION;
}

/**
 * Fetch latest release info from GitHub API
 */
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'BGI-Content-Studio-Updater',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          if (release.tag_name) {
            resolve({
              version: release.tag_name.replace(/^v/, ''),
              body: release.body || '',
              assets: release.assets || [],
              html_url: release.html_url
            });
          } else {
            reject(new Error('No release found'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse release: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Compare two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Download a file from URL to destination path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: { 'User-Agent': 'BGI-Content-Studio-Updater' }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }

      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloadedSize = 0;

      const fileStream = fs.createWriteStream(destPath);
      
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          sendUpdateStatus('downloading', { progress, downloadedSize, totalSize });
        }
      });

      res.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    request.on('error', reject);
    request.setTimeout(120000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Extract ZIP file to destination directory
 */
function extractZip(zipPath, destDir) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  
  // Get the root folder name in the ZIP
  const entries = zip.getEntries();
  const rootFolder = entries[0].entryName.split('/')[0];
  
  // Extract all files
  zip.extractAllTo(destDir, true);
  
  // Return the path to the extracted root folder
  return path.join(destDir, rootFolder);
}

/**
 * Backup current app directory
 */
function backupCurrentApp() {
  const appDir = app.isPackaged 
    ? path.dirname(app.getPath('exe'))
    : path.join(__dirname, '..');
  
  const backupDir = `${appDir}.backup`;
  
  // Remove old backup if exists
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
  
  // Copy current app to backup (excluding node_modules for speed)
  fs.cpSync(appDir, backupDir, {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !src.includes('.backup')
  });
  
  return backupDir;
}

/**
 * Restore from backup
 */
function restoreFromBackup(backupDir) {
  const appDir = app.isPackaged 
    ? path.dirname(app.getPath('exe'))
    : path.join(__dirname, '..');
  
  try {
    // Remove corrupted files
    fs.rmSync(appDir, { recursive: true, force: true });
    
    // Restore from backup
    fs.cpSync(backupDir, appDir, { recursive: true });
    
    return true;
  } catch (e) {
    console.error('[Updater] Restore failed:', e.message);
    return false;
  }
}

/**
 * Restart the application
 */
function restartApp() {
  const exePath = app.getPath('exe');
  
  // Spawn new instance
  execFile(exePath, [], { detached: true }, () => {});
  
  // Quit current instance
  app.quit();
}

/**
 * Main update check function
 */
async function checkForUpdates() {
  if (downloading) return;
  
  try {
    sendUpdateStatus('checking');
    
    const release = await fetchLatestRelease();
    const currentVersion = getCurrentVersion();
    
    console.log(`[Updater] Current: ${currentVersion}, Latest: ${release.version}`);
    
    if (compareVersions(release.version, currentVersion) > 0) {
      updateAvailable = true;
      sendUpdateStatus('available', {
        currentVersion,
        latestVersion: release.version,
        releaseNotes: release.body,
        releaseUrl: release.html_url
      });
      console.log(`[Updater] Update available: ${release.version}`);
    } else {
      sendUpdateStatus('not-available', { currentVersion });
      console.log('[Updater] App is up to date');
    }
  } catch (e) {
    console.error('[Updater] Check failed:', e.message);
    sendUpdateStatus('error', { message: e.message });
  }
}

/**
 * Download and install update
 */
async function downloadAndInstall() {
  if (downloading) return;
  downloading = true;
  
  let backupDir = null;
  let tempZipPath = null;
  
  try {
    sendUpdateStatus('downloading', { progress: 0 });
    
    // Fetch latest release
    const release = await fetchLatestRelease();
    
    // Find the ZIP asset
    const zipAsset = release.assets.find(a => a.name.endsWith('.zip'));
    if (!zipAsset) {
      throw new Error('No ZIP file found in release');
    }
    
    console.log(`[Updater] Downloading: ${zipAsset.name}`);
    
    // Download to temp file
    tempZipPath = path.join(app.getPath('temp'), zipAsset.name);
    await downloadFile(zipAsset.browser_download_url, tempZipPath);
    
    sendUpdateStatus('extracting');
    console.log('[Updater] Download complete, extracting...');
    
    // Backup current app
    sendUpdateStatus('backing-up');
    backupDir = backupCurrentApp();
    console.log(`[Updater] Backup created: ${backupDir}`);
    
    // Extract new version
    const extractedDir = extractZip(tempZipPath, app.getPath('temp'));
    
    // Replace current app files
    const appDir = app.isPackaged 
      ? path.dirname(app.getPath('exe'))
      : path.join(__dirname, '..');
    
    // Copy new files (except node_modules and server which the user has)
    const filesToCopy = fs.readdirSync(extractedDir);
    for (const file of filesToCopy) {
      if (file === 'node_modules' || file === '.git') continue;
      
      const src = path.join(extractedDir, file);
      const dest = path.join(appDir, file);
      
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      fs.cpSync(src, dest, { recursive: true });
    }
    
    sendUpdateStatus('installed', { version: release.version });
    console.log(`[Updater] Update ${release.version} installed successfully`);
    
    // Clean up temp files
    fs.unlinkSync(tempZipPath);
    fs.rmSync(backupDir, { recursive: true, force: true });
    
    // Ask user to restart
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Tersedia',
      message: `Update v${release.version} berhasil diinstall!`,
      detail: 'Aplikasi perlu direstart untuk menerapkan update.',
      buttons: ['Restart Sekarang', 'Nanti'],
      defaultId: 0,
      cancelId: 1
    });
    
    if (result.response === 0) {
      restartApp();
    }
    
  } catch (e) {
    console.error('[Updater] Install failed:', e.message);
    sendUpdateStatus('error', { message: e.message });
    
    // Rollback if backup exists
    if (backupDir && fs.existsSync(backupDir)) {
      console.log('[Updater] Rolling back...');
      sendUpdateStatus('rolling-back');
      restoreFromBackup(backupDir);
      sendUpdateStatus('rolled-back');
    }
    
    // Clean up temp files
    if (tempZipPath && fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  } finally {
    downloading = false;
  }
}

module.exports = {
  setMainWindow,
  getCurrentVersion,
  checkForUpdates,
  downloadAndInstall,
  compareVersions
};
