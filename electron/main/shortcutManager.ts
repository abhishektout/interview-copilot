import { globalShortcut } from 'electron';
import type { WindowManager } from './windowManager.js';
import type { StorageService } from '../storage/storageService.js';

interface Shortcut {
  key: string;
  action: string;
  description: string;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'CommandOrControl+Shift+I', action: 'toggle-assistant', description: 'Toggle AI Assistant' },
  { key: 'CommandOrControl+Shift+Space', action: 'generate-answer', description: 'Generate Answer' },
  { key: 'CommandOrControl+Shift+H', action: 'hide-assistant', description: 'Hide AI Assistant' },
  { key: 'CommandOrControl+Shift+C', action: 'copy-answer', description: 'Copy Answer' },
  { key: 'CommandOrControl+Shift+R', action: 'regenerate', description: 'Regenerate Answer' },
];

export class ShortcutManager {
  private windowManager: WindowManager;
  private storageService: StorageService;
  private registeredShortcuts: Map<string, string> = new Map();

  constructor(windowManager: WindowManager, storageService: StorageService) {
    this.windowManager = windowManager;
    this.storageService = storageService;
  }

  async initialize(): Promise<void> {
    const settings = await this.storageService.getSettings();
    const shortcuts = settings.shortcuts || DEFAULT_SHORTCUTS;
    this.registerShortcuts(shortcuts);
  }

  private registerShortcuts(shortcuts: Shortcut[]): void {
    for (const shortcut of shortcuts) {
      this.registerShortcut(shortcut.key, shortcut.action);
    }
  }

  private registerShortcut(key: string, action: string): boolean {
    try {
      const success = globalShortcut.register(key, () => {
        this.executeAction(action);
      });

      if (success) {
        this.registeredShortcuts.set(action, key);
      }
      return success;
    } catch {
      console.error(`Failed to register shortcut: ${key}`);
      return false;
    }
  }

  private executeAction(action: string): void {
    switch (action) {
      case 'toggle-assistant':
        this.windowManager.toggleOverlay();
        break;
      case 'generate-answer':
        this.windowManager.sendToOverlay('shortcut:generate');
        this.windowManager.sendToInterview('shortcut:generate');
        break;
      case 'hide-assistant':
        // Toggle: hide if visible, show if hidden — perfect for quick stealth during screen share
        this.windowManager.toggleOverlay();
        break;
      case 'copy-answer':
        this.windowManager.sendToOverlay('shortcut:copy');
        break;
      case 'regenerate':
        this.windowManager.sendToOverlay('shortcut:regenerate');
        break;
    }
  }

  async updateShortcut(action: string, newKey: string): Promise<boolean> {
    // Unregister old shortcut
    const oldKey = this.registeredShortcuts.get(action);
    if (oldKey) {
      globalShortcut.unregister(oldKey);
    }

    // Register new one
    return this.registerShortcut(newKey, action);
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.registeredShortcuts.clear();
  }

  getShortcuts(): { action: string; key: string }[] {
    return Array.from(this.registeredShortcuts.entries()).map(([action, key]) => ({
      action,
      key,
    }));
  }
}
