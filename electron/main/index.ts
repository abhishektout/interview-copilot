import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  nativeTheme,
  session,
  shell,
  dialog,
  desktopCapturer,
  screen,
} from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WindowManager } from './windowManager.js';
import { registerIpcHandlers } from '../ipc/handlers.js';
import { StorageService } from '../storage/storageService.js';
import { ShortcutManager } from './shortcutManager.js';

// ─── Linux: Enable Wayland mode ──────────────────────────────────────────────
// When Electron runs under Wayland (e.g. GNOME / KDE), setContentProtection(true)
// is honoured by the compositor and the overlay is NEVER captured by screen-share tools.
// `ozone-platform-hint=auto` auto-picks Wayland on Wayland sessions, X11 on X11 sessions.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform,WaylandWindowDecorations');
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Security: Set CSP depending on environment
const DEV_CSP = [
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: http://localhost:5173",
  "connect-src 'self' http://localhost:5173 ws://localhost:5173 https://generativelanguage.googleapis.com",
  "media-src 'self' blob:",
].join('; ');

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://generativelanguage.googleapis.com",
  "media-src 'self' blob:",
].join('; ');

const CSP = isDev ? DEV_CSP : PROD_CSP;

export let windowManager: WindowManager;
export let storageService: StorageService;
export let shortcutManager: ShortcutManager;

async function init() {
  // Set security headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    });
  });

  // Initialize services
  storageService = new StorageService();
  await storageService.initialize();

  // Create window manager
  windowManager = new WindowManager(isDev, VITE_DEV_SERVER_URL, __dirname);

  // Register all IPC handlers
  registerIpcHandlers(windowManager, storageService);

  // Create main window
  await windowManager.createMainWindow();

  // Initialize shortcut manager after windows are ready
  shortcutManager = new ShortcutManager(windowManager, storageService);
  await shortcutManager.initialize();

  // ─── Screen-share stealth & content protection ─────────────────────────────
  // setContentProtection(true) is applied in windowManager.ts on the overlay window.
  // On Windows/macOS: OS-level protection completely excludes overlay from capture.
  // On Linux X11: Full screen capture captures all X11 root pixels. For stealth
  // on Linux, users should share a specific Window (e.g. Chrome/IDE), not Entire Screen,
  // or use the mobile companion mode.
  // ──────────────────────────────────────────────────────────────────────────

  // Handle macOS dock click
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    } else {
      windowManager.getMainWindow()?.show();
    }
  });
}

app.whenReady().then(async () => {
  // Force dark mode
  nativeTheme.themeSource = 'dark';

  // Security: Prevent new window creation
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      // Only allow external URLs to open in system browser
      if (url.startsWith('http') || url.startsWith('https')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // Prevent navigation to external URLs
    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (!isDev && parsedUrl.origin !== 'null' && !navigationUrl.startsWith('file://')) {
        event.preventDefault();
      }
    });
  });

  await init();
}).catch(console.error);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    shortcutManager?.unregisterAll();
    app.quit();
  }
});

app.on('before-quit', () => {
  shortcutManager?.unregisterAll();
});

// Export for IPC access
export { desktopCapturer, screen, dialog };
