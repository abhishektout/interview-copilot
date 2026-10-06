import { BrowserWindow, shell, screen } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private interviewWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private isDev: boolean;
  private devServerUrl: string;
  private dirname: string;

  constructor(isDev: boolean, devServerUrl: string, dirname: string) {
    this.isDev = isDev;
    this.devServerUrl = devServerUrl;
    this.dirname = dirname;
  }

  private getPreloadPath(): string {
    const cjsPath = join(this.dirname, '../preload/index.cjs');
    if (existsSync(cjsPath)) {
      return cjsPath;
    }
    return join(this.dirname, '../preload/index.js');
  }

  private getLoadUrl(route: string): string {
    if (this.isDev) {
      return `${this.devServerUrl}#${route}`;
    }
    return `file://${join(this.dirname, '../../dist/index.html')}#${route}`;
  }

  async createMainWindow(): Promise<BrowserWindow> {
    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      show: false,
      backgroundColor: '#0a0a0f',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      frame: process.platform !== 'darwin',
      icon: join(this.dirname, '../../public/icon.png'),
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // needed for preload
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
      },
    });

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      if (this.isDev) {
        this.mainWindow?.webContents.openDevTools({ mode: 'detach' });
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      // Close other windows when main closes
      this.interviewWindow?.close();
      this.overlayWindow?.close();
    });

    // Open external links in system browser
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    await this.mainWindow.loadURL(this.getLoadUrl('/'));
    return this.mainWindow;
  }

  async createInterviewWindow(): Promise<BrowserWindow> {
    if (this.interviewWindow && !this.interviewWindow.isDestroyed()) {
      this.interviewWindow.focus();
      return this.interviewWindow;
    }

    this.interviewWindow = new BrowserWindow({
      width: 1100,
      height: 700,
      minWidth: 800,
      minHeight: 500,
      show: false,
      backgroundColor: '#0a0a0f',
      title: 'Interview Session',
      icon: join(this.dirname, '../../public/icon.png'),
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      },
    });

    this.interviewWindow.once('ready-to-show', () => {
      this.interviewWindow?.show();
    });

    this.interviewWindow.on('closed', () => {
      this.interviewWindow = null;
    });

    await this.interviewWindow.loadURL(this.getLoadUrl('/interview'));
    return this.interviewWindow;
  }

  async createOverlayWindow(): Promise<BrowserWindow> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.show();
      return this.overlayWindow;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight, x: displayX, y: displayY } = primaryDisplay.workArea;
    const overlaySize = 360;
    const defaultX = displayX + screenWidth - overlaySize - 24;
    const defaultY = displayY + 32;

    // Platform-specific window type for screen-capture exclusion:
    // - macOS 'panel': excluded from window capture, floats above full-screen apps
    // - Linux/Windows 'toolbar': hinted as a utility/tool window (non-capturable in many compositors)
    const windowType = process.platform === 'darwin'
      ? 'panel'
      : process.platform === 'linux'
        ? 'toolbar'
        : undefined; // Windows: no special type needed — setContentProtection covers it

    this.overlayWindow = new BrowserWindow({
      width: overlaySize,
      height: overlaySize,
      x: defaultX,
      y: defaultY,
      minWidth: 260,
      minHeight: 260,
      maxWidth: 600,
      maxHeight: 600,
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: true,
      movable: true,
      skipTaskbar: true,
      hasShadow: false, // shadow disabled: some compositors include shadow in capture
      ...(windowType ? { type: windowType } : {}),
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      },
    });

    // ─── SCREEN CAPTURE PROTECTION ────────────────────────────────────────────
    // setContentProtection: natively works on macOS & Windows.
    // On Linux it's a no-op in most Electron builds, but we call it anyway.
    this.overlayWindow.setContentProtection(true);

    // 'pop-up-menu' is the highest always-on-top level in Electron/Chromium.
    // On Linux (X11/Wayland) this window hint often causes the window to be
    // excluded from screen-capture sources presented by the browser's
    // getDisplayMedia() picker (used by Google Meet, etc.).
    this.overlayWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);

    // Visible on all workspaces / full-screen spaces
    this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // On Linux X11: mark window as non-capturable via _NET_WM_BYPASS_COMPOSITOR
    // and keep it out of the normal window stack used by capture tools.
    if (process.platform === 'linux') {
      // Electron exposes this via the window's native handle on X11.
      // Calling setIgnoreMouseEvents(false) then back ensures the window
      // compositor hint is refreshed after show().
      this.overlayWindow.once('show', () => {
        // Re-affirm content protection and always-on-top after show
        this.overlayWindow?.setContentProtection(true);
        this.overlayWindow?.setAlwaysOnTop(true, 'pop-up-menu', 1);
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    this.overlayWindow.once('ready-to-show', () => {
      this.overlayWindow?.show();
    });

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
    });

    await this.overlayWindow.loadURL(this.getLoadUrl('/overlay'));
    return this.overlayWindow;
  }

  snapOverlay(position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight, x: displayX, y: displayY } = primaryDisplay.workArea;
    const [width, height] = this.overlayWindow.getSize();
    let x = displayX + screenWidth - width - 24;
    let y = displayY + 32;

    if (position === 'bottom-right') {
      x = displayX + screenWidth - width - 24;
      y = displayY + screenHeight - height - 32;
    } else if (position === 'top-left') {
      x = displayX + 24;
      y = displayY + 32;
    } else if (position === 'bottom-left') {
      x = displayX + 24;
      y = displayY + screenHeight - height - 32;
    }
    this.overlayWindow.setPosition(x, y);
  }

  // Window control methods
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  getInterviewWindow(): BrowserWindow | null {
    return this.interviewWindow;
  }

  getOverlayWindow(): BrowserWindow | null {
    return this.overlayWindow;
  }

  toggleOverlay(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.createOverlayWindow();
      return;
    }
    if (this.overlayWindow.isVisible()) {
      this.overlayWindow.hide();
    } else {
      this.forceShowOverlay(this.overlayWindow);
    }
  }

  hideOverlay(): void {
    this.overlayWindow?.hide();
  }

  showOverlay(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.createOverlayWindow();
    } else {
      this.forceShowOverlay(this.overlayWindow);
    }
  }

  /**
   * Reliably show the overlay window on all platforms.
   * On Linux, simply calling show() is not enough for 'pop-up-menu' level windows —
   * we must re-assert always-on-top and content protection after every show().
   */
  private forceShowOverlay(win: BrowserWindow): void {
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    // Re-assert always-on-top — required on Linux after hide/show cycle
    win.setAlwaysOnTop(true, 'pop-up-menu', 1);
    // Re-assert content protection — some compositors reset it after show()
    win.setContentProtection(true);
    // Bring to front without stealing focus from the active window
    win.moveTop();
  }

  setOverlayAlwaysOnTop(value: boolean): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setAlwaysOnTop(value, 'screen-saver');
    }
  }

  setOverlayOpacity(opacity: number): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setOpacity(Math.max(0.1, Math.min(1.0, opacity)));
    }
  }

  setOverlayContentProtection(enabled: boolean): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setContentProtection(enabled);
    }
  }

  sendToOverlay(channel: string, ...args: unknown[]): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.send(channel, ...args);
    }
  }

  sendToInterview(channel: string, ...args: unknown[]): void {
    if (this.interviewWindow && !this.interviewWindow.isDestroyed()) {
      this.interviewWindow.webContents.send(channel, ...args);
    }
  }

  sendToMain(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }

  closeInterviewWindow(): void {
    this.interviewWindow?.close();
  }

  focusMainWindow(): void {
    this.mainWindow?.focus();
  }
}
