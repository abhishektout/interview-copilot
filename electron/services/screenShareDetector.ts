/**
 * ScreenShareDetector — Reliable Linux X11/Wayland screen capture detection.
 *
 * Uses multiple parallel methods and picks the fastest "yes" signal.
 * Poll interval: 1000ms (1 second) for fast response.
 */

import { exec } from 'child_process';
import { EventEmitter } from 'events';

interface DetectorEvents {
  'capture-started': () => void;
  'capture-ended': () => void;
}

export class ScreenShareDetector extends EventEmitter {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private _isCapturing = false;
  private readonly POLL_MS = 1000; // Check every second

  get isCapturing(): boolean {
    return this._isCapturing;
  }

  start(): void {
    if (this.pollTimer) return;
    if (process.platform !== 'linux') return; // macOS/Windows handled natively

    console.log('[ScreenShareDetector] Started polling for screen capture...');
    this.poll(); // immediate check
    this.pollTimer = setInterval(() => this.poll(), this.POLL_MS);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private poll(): void {
    this.detect()
      .then(capturing => {
        if (capturing !== this._isCapturing) {
          this._isCapturing = capturing;
          console.log(`[ScreenShareDetector] Screen capture ${capturing ? 'STARTED' : 'ENDED'}`);
          this.emit(capturing ? 'capture-started' : 'capture-ended');
        }
      })
      .catch(() => {});
  }

  /**
   * Run all detection methods in parallel — return true if ANY confirms capture.
   * This makes detection fast and robust across different Linux setups.
   */
  private async detect(): Promise<boolean> {
    const results = await Promise.allSettled([
      this.checkXdgPortal(),
      this.checkPipeWireScreenNodes(),
      this.checkXdgDesktopPortalProcess(),
    ]);

    return results.some(r => r.status === 'fulfilled' && r.value === true);
  }

  /**
   * Method 1 — XDG Desktop Portal D-Bus (works on Wayland + modern X11)
   *
   * When Chrome/Meet shares screen via portal, it creates a ScreenCast session
   * object under /org/freedesktop/portal/desktop/session/...
   * We query ObjectManager to see if any such object exists.
   */
  private checkXdgPortal(): Promise<boolean> {
    return new Promise(resolve => {
      // Use dbus-send (more widely available than gdbus)
      exec(
        `dbus-send --session --print-reply \
          --dest=org.freedesktop.portal.Desktop \
          /org/freedesktop/portal/desktop \
          org.freedesktop.DBus.ObjectManager.GetManagedObjects 2>/dev/null \
          | grep -c "ScreenCast\\|screencast" 2>/dev/null || echo 0`,
        { timeout: 900 },
        (_err, stdout) => {
          const n = parseInt(stdout?.trim() ?? '0', 10);
          resolve(n > 0);
        }
      );
    });
  }

  /**
   * Method 2 — PipeWire active Video/Source nodes count
   *
   * Baseline (no capture) = 0 or 1 (webcam only).
   * When screen is being captured, an extra node appears.
   * We use pw-cli instead of pw-dump as it's faster to parse.
   */
  private checkPipeWireScreenNodes(): Promise<boolean> {
    return new Promise(resolve => {
      exec(
        `pw-cli ls Node 2>/dev/null | grep -cE "Video/Source|pipewiresrc|xdg-screenshare|screencast" || echo 0`,
        { timeout: 900 },
        (_err, stdout) => {
          const n = parseInt(stdout?.trim() ?? '0', 10);
          resolve(n > 0);
        }
      );
    });
  }

  /**
   * Method 3 — Check if xdg-desktop-portal has an active screencast session
   *
   * When a screencast session is active, xdg-desktop-portal process
   * holds specific file descriptors open. We check via /proc.
   *
   * Also catches the case where Google Meet uses Chrome's built-in
   * screen capture on X11 (not via portal): Chrome process will have
   * extra socket connections to the X11 server for XDamage.
   */
  private checkXdgDesktopPortalProcess(): Promise<boolean> {
    return new Promise(resolve => {
      exec(
        // Check 1: portal process has many open fds (screencast session adds ~10 fds)
        // Check 2: Chrome/Chromium has pipewire sockets open
        `
        # xdg-desktop-portal baseline fd count is ~30; screencast adds more
        portal_pid=$(pgrep -x xdg-desktop-portal 2>/dev/null | head -1)
        if [ -n "$portal_pid" ]; then
          fd_count=$(ls /proc/$portal_pid/fd 2>/dev/null | wc -l)
          # Baseline ~30 fds; active screencast typically pushes it above 50
          if [ "$fd_count" -gt 50 ]; then
            echo 1
            exit 0
          fi
        fi

        # Check Chrome/Chromium for active pipewire fds
        for pid in $(pgrep -x "chrome|chromium|chromium-browser" 2>/dev/null | head -5); do
          if ls -la /proc/$pid/fd 2>/dev/null | grep -qE "pipewire|video"; then
            echo 1
            exit 0
          fi
        done
        echo 0
        `,
        { timeout: 900, shell: '/bin/bash' },
        (_err, stdout) => {
          resolve(stdout?.trim() === '1');
        }
      );
    });
  }

  override on<K extends keyof DetectorEvents>(event: K, listener: DetectorEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof DetectorEvents>(event: K, ...args: Parameters<DetectorEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
