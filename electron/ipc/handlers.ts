import { ipcMain, BrowserWindow, desktopCapturer, screen, dialog } from 'electron';
import { readFileSync } from 'fs';
import type { WindowManager } from '../main/windowManager.js';
import type { StorageService } from '../storage/storageService.js';
import { GeminiService } from '../ai/geminiService.js';

const geminiService = new GeminiService();

// Allowed IPC channels (strict allowlist)
const ALLOWED_CHANNELS = new Set([
  'window:minimize', 'window:maximize', 'window:close',
  'overlay:toggle', 'overlay:show', 'overlay:hide', 'overlay:alwaysOnTop', 'overlay:opacity', 'overlay:contentProtection', 'overlay:snapPosition',
  'interview:open', 'interview:close',
  'gemini:validateKey', 'gemini:generateAnswer', 'gemini:generateFollowUp', 'gemini:evaluateAnswer',
  'gemini:analyzeResume', 'gemini:analyzeJobDescription', 'gemini:generateInterviewQuestions', 'gemini:generateReport',
  'storage:getSettings', 'storage:saveSettings',
  'storage:getProfile', 'storage:saveProfile',
  'storage:getResume', 'storage:saveResume',
  'storage:getJobDescriptions', 'storage:saveJobDescription', 'storage:deleteJobDescription',
  'storage:getSessions', 'storage:getSession', 'storage:createSession', 'storage:updateSession', 'storage:deleteSession',
  'storage:saveQA', 'storage:exportData', 'storage:clearAllData',
  'files:readPDF', 'files:readDOCX', 'files:openDialog', 'files:saveDialog', 'files:write',
  'capture:getSources', 'capture:getDisplays', 'capture:screenshot',
  'shortcuts:getAll', 'shortcuts:update',
]);

function validateChannel(channel: string): void {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`IPC channel not allowed: ${channel}`);
  }
}

export function registerIpcHandlers(windowManager: WindowManager, storageService: StorageService): void {
  // ===== Window Controls =====
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  // ===== Overlay Controls =====
  ipcMain.handle('overlay:toggle', () => windowManager.toggleOverlay());
  ipcMain.handle('overlay:show', () => windowManager.showOverlay());
  ipcMain.handle('overlay:hide', () => windowManager.hideOverlay());

  ipcMain.handle('overlay:alwaysOnTop', (_event, value: boolean) => {
    windowManager.setOverlayAlwaysOnTop(value);
  });

  ipcMain.handle('overlay:opacity', (_event, value: number) => {
    windowManager.setOverlayOpacity(value);
  });

  ipcMain.handle('overlay:contentProtection', (_event, value: boolean) => {
    windowManager.setOverlayContentProtection(value);
  });

  ipcMain.handle('overlay:snapPosition', (_event, position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left') => {
    windowManager.snapOverlay(position);
  });

  // ===== Interview Window =====
  ipcMain.handle('interview:open', () => windowManager.createInterviewWindow());
  ipcMain.handle('interview:close', () => windowManager.closeInterviewWindow());

  // ===== Gemini API =====
  ipcMain.handle('gemini:validateKey', async (_event, key: string) => {
    if (!key || typeof key !== 'string' || key.length < 10) {
      return { valid: false, error: 'Invalid key format.' };
    }
    return geminiService.validateApiKey(key);
  });

  ipcMain.handle('gemini:generateAnswer', async (event, payload: {
    question: string;
    context: Record<string, unknown>;
    style: string;
    sessionId: string;
  }) => {
    // Get API key from storage
    const apiKey = await storageService.getApiKey();
    if (!apiKey) throw new Error('INVALID_GEMINI_KEY: No API key configured.');

    const settings = await storageService.getSettings();
    geminiService.initialize(apiKey, settings.geminiModel, settings.temperature);

    let fullAnswer = '';

    try {
      fullAnswer = await geminiService.generateAnswer(
        {
          question: payload.question,
          answerStyle: payload.style as 'concise' | 'normal' | 'technical' | 'star' | 'natural',
          context: payload.context as Parameters<GeminiService['generateAnswer']>[0]['context'],
          questionType: geminiService.detectQuestionType(payload.question),
        },
        (chunk: string) => {
          // Stream chunks to the sender window
          BrowserWindow.fromWebContents(event.sender)?.webContents.send('gemini:streamChunk', chunk);
          // Also send to overlay
          windowManager.sendToOverlay('gemini:streamChunk', chunk);
        }
      );

      BrowserWindow.fromWebContents(event.sender)?.webContents.send('gemini:streamEnd');
      windowManager.sendToOverlay('gemini:streamEnd');
      windowManager.sendToOverlay('overlay:answerReady', {
        question: payload.question,
        answer: fullAnswer,
        questionType: geminiService.detectQuestionType(payload.question),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      BrowserWindow.fromWebContents(event.sender)?.webContents.send('gemini:streamError', msg);
      windowManager.sendToOverlay('gemini:streamError', msg);
      throw error;
    }

    return fullAnswer;
  });

  ipcMain.handle('gemini:generateFollowUp', async (_event, payload: {
    question: string;
    answer: string;
    context: Record<string, unknown>;
  }) => {
    const apiKey = await storageService.getApiKey();
    if (!apiKey) throw new Error('INVALID_GEMINI_KEY');
    const settings = await storageService.getSettings();
    geminiService.initialize(apiKey, settings.geminiModel, settings.temperature);
    return geminiService.generateFollowUp(
      payload.question,
      payload.answer,
      payload.context as Parameters<GeminiService['generateFollowUp']>[2]
    );
  });

  ipcMain.handle('gemini:evaluateAnswer', async (_event, payload: {
    question: string;
    answer: string;
    context: Record<string, unknown>;
  }) => {
    const apiKey = await storageService.getApiKey();
    if (!apiKey) throw new Error('INVALID_GEMINI_KEY');
    const settings = await storageService.getSettings();
    geminiService.initialize(apiKey, settings.geminiModel, settings.temperature);
    return geminiService.evaluateAnswer(
      payload.question,
      payload.answer,
      payload.context as Parameters<GeminiService['evaluateAnswer']>[2]
    );
  });

  ipcMain.handle('gemini:analyzeResume', async (_event, text: string) => {
    const apiKey = await storageService.getApiKey();
    if (!apiKey) throw new Error('INVALID_GEMINI_KEY');
    const settings = await storageService.getSettings();
    geminiService.initialize(apiKey, settings.geminiModel, settings.temperature);
    return geminiService.analyzeResume(text);
  });

  ipcMain.handle('gemini:analyzeJobDescription', async (_event, text: string) => {
    const apiKey = await storageService.getApiKey();
    if (!apiKey) throw new Error('INVALID_GEMINI_KEY');
    const settings = await storageService.getSettings();
    geminiService.initialize(apiKey, settings.geminiModel, settings.temperature);
    return geminiService.analyzeJobDescription(text);
  });

  ipcMain.handle('gemini:generateInterviewQuestions', async (_event, context: string) => {
    const apiKey = await storageService.getApiKey();
    if (!apiKey) throw new Error('INVALID_GEMINI_KEY');
    const settings = await storageService.getSettings();
    geminiService.initialize(apiKey, settings.geminiModel, settings.temperature);
    return geminiService.generateInterviewQuestions(context);
  });

  ipcMain.handle('gemini:generateReport', async (_event, sessionId: string) => {
    const apiKey = await storageService.getApiKey();
    if (!apiKey) throw new Error('INVALID_GEMINI_KEY');
    const settings = await storageService.getSettings();
    geminiService.initialize(apiKey, settings.geminiModel, settings.temperature);

    const qaRecords = await storageService.getSessionQA(sessionId);
    const profile = await storageService.getProfile();
    const resume = await storageService.getResume();

    const context = profile ? {
      profile: {
        name: profile.name,
        targetRole: profile.targetRole,
        experience: profile.experience,
        skills: profile.skills,
        projects: profile.projects,
      },
      resumeSummary: resume?.analysis,
    } : undefined;

    return geminiService.generateReport(qaRecords, context);
  });

  // ===== Storage =====
  ipcMain.handle('storage:getSettings', () => storageService.getSettings());
  ipcMain.handle('storage:saveSettings', (_event, settings) => storageService.saveSettings(settings));
  ipcMain.handle('storage:getProfile', () => storageService.getProfile());
  ipcMain.handle('storage:saveProfile', (_event, profile) => storageService.saveProfile(profile));
  ipcMain.handle('storage:getResume', () => storageService.getResume());
  ipcMain.handle('storage:saveResume', (_event, resume) => storageService.saveResume(resume));
  ipcMain.handle('storage:getJobDescriptions', () => storageService.getJobDescriptions());
  ipcMain.handle('storage:saveJobDescription', (_event, jd) => storageService.saveJobDescription(jd));
  ipcMain.handle('storage:deleteJobDescription', (_event, id) => storageService.deleteJobDescription(id));
  ipcMain.handle('storage:getSessions', () => storageService.getSessions());
  ipcMain.handle('storage:getSession', (_event, id) => storageService.getSession(id));
  ipcMain.handle('storage:createSession', (_event, session) => storageService.createSession(session));
  ipcMain.handle('storage:updateSession', (_event, id, data) => storageService.updateSession(id, data));
  ipcMain.handle('storage:deleteSession', (_event, id) => storageService.deleteSession(id));
  ipcMain.handle('storage:saveQA', (_event, qa) => storageService.saveQA(qa));
  ipcMain.handle('storage:exportData', () => storageService.exportData());
  ipcMain.handle('storage:clearAllData', () => storageService.clearAllData());

  // ===== Files =====
  ipcMain.handle('files:readPDF', async (_event, filePath: string) => {
    try {
      const { default: pdfParse } = await import('pdf-parse');
      const buffer = readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { success: true, text: data.text, pages: data.numpages };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('files:readDOCX', async (_event, filePath: string) => {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return { success: true, text: result.value };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('files:openDialog', async (_event, options: {
    filters: Array<{ name: string; extensions: string[] }>
  }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options.filters,
    });
    return result;
  });

  ipcMain.handle('files:saveDialog', async (_event, options) => {
    return dialog.showSaveDialog(options);
  });

  ipcMain.handle('files:write', async (_event, filePath: string, data: string) => {
    const { writeFileSync } = await import('fs');
    writeFileSync(filePath, data, 'utf8');
    return true;
  });

  // ===== Desktop Capture Lab =====
  ipcMain.handle('capture:getSources', async (_event, types: string[]) => {
    const sources = await desktopCapturer.getSources({
      types: types as ('window' | 'screen')[],
      thumbnailSize: { width: 320, height: 200 },
      fetchWindowIcons: true,
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      appIconUrl: s.appIcon?.toDataURL(),
      thumbnailUrl: s.thumbnail.toDataURL(),
      display_id: s.display_id,
    }));
  });

  ipcMain.handle('capture:getDisplays', () => {
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      rotation: d.rotation,
      touchSupport: d.touchSupport,
      primary: d.id === screen.getPrimaryDisplay().id,
    }));
  });

  ipcMain.handle('capture:screenshot', async (_event, sourceId: string) => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });
    const source = sources.find(s => s.id === sourceId);
    return source ? source.thumbnail.toDataURL() : null;
  });

  // ===== Shortcuts =====
  ipcMain.handle('shortcuts:getAll', async () => {
    const settings = await storageService.getSettings();
    return settings.shortcuts || [];
  });

  ipcMain.handle('shortcuts:update', async (_event, action: string, key: string) => {
    const settings = await storageService.getSettings();
    const shortcuts = settings.shortcuts || [];
    const idx = shortcuts.findIndex(s => s.action === action);
    if (idx >= 0) {
      shortcuts[idx].key = key;
    }
    await storageService.saveSettings({ shortcuts });
    return true;
  });
}
