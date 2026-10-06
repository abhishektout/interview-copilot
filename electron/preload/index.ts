import { contextBridge, ipcRenderer } from 'electron';

// Type-safe IPC bridge - never expose Node.js APIs to renderer
const api = {
  // Window control
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),
    showOverlay: () => ipcRenderer.invoke('overlay:show'),
    hideOverlay: () => ipcRenderer.invoke('overlay:hide'),
    openInterview: () => ipcRenderer.invoke('interview:open'),
    closeInterview: () => ipcRenderer.invoke('interview:close'),
    setOverlayAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('overlay:alwaysOnTop', value),
    setOverlayOpacity: (value: number) => ipcRenderer.invoke('overlay:opacity', value),
    setOverlayContentProtection: (value: boolean) => ipcRenderer.invoke('overlay:contentProtection', value),
    snapOverlay: (position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left') =>
      ipcRenderer.invoke('overlay:snapPosition', position),
  },

  // Gemini AI
  gemini: {
    validateKey: (key: string) => ipcRenderer.invoke('gemini:validateKey', key),
    generateAnswer: (payload: {
      question: string;
      context: string;
      style: string;
      sessionId: string;
    }) => ipcRenderer.invoke('gemini:generateAnswer', payload),
    generateFollowUp: (payload: { question: string; answer: string; context: string }) =>
      ipcRenderer.invoke('gemini:generateFollowUp', payload),
    evaluateAnswer: (payload: { question: string; answer: string; context: string }) =>
      ipcRenderer.invoke('gemini:evaluateAnswer', payload),
    analyzeResume: (text: string) => ipcRenderer.invoke('gemini:analyzeResume', text),
    analyzeJobDescription: (text: string) => ipcRenderer.invoke('gemini:analyzeJobDescription', text),
    generateInterviewQuestions: (context: string) =>
      ipcRenderer.invoke('gemini:generateInterviewQuestions', context),
    generateReport: (sessionId: string) => ipcRenderer.invoke('gemini:generateReport', sessionId),
    onStreamChunk: (callback: (chunk: string) => void) => {
      ipcRenderer.on('gemini:streamChunk', (_event, chunk) => callback(chunk));
      return () => ipcRenderer.removeAllListeners('gemini:streamChunk');
    },
    onStreamEnd: (callback: () => void) => {
      ipcRenderer.on('gemini:streamEnd', () => callback());
      return () => ipcRenderer.removeAllListeners('gemini:streamEnd');
    },
    onStreamError: (callback: (error: string) => void) => {
      ipcRenderer.on('gemini:streamError', (_event, error) => callback(error));
      return () => ipcRenderer.removeAllListeners('gemini:streamError');
    },
  },

  // Storage
  storage: {
    getSettings: () => ipcRenderer.invoke('storage:getSettings'),
    saveSettings: (settings: Record<string, unknown>) =>
      ipcRenderer.invoke('storage:saveSettings', settings),
    getProfile: () => ipcRenderer.invoke('storage:getProfile'),
    saveProfile: (profile: Record<string, unknown>) =>
      ipcRenderer.invoke('storage:saveProfile', profile),
    getResume: () => ipcRenderer.invoke('storage:getResume'),
    saveResume: (resume: Record<string, unknown>) =>
      ipcRenderer.invoke('storage:saveResume', resume),
    getJobDescriptions: () => ipcRenderer.invoke('storage:getJobDescriptions'),
    saveJobDescription: (jd: Record<string, unknown>) =>
      ipcRenderer.invoke('storage:saveJobDescription', jd),
    deleteJobDescription: (id: string) => ipcRenderer.invoke('storage:deleteJobDescription', id),
    getSessions: () => ipcRenderer.invoke('storage:getSessions'),
    getSession: (id: string) => ipcRenderer.invoke('storage:getSession', id),
    createSession: (session: Record<string, unknown>) =>
      ipcRenderer.invoke('storage:createSession', session),
    updateSession: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('storage:updateSession', id, data),
    deleteSession: (id: string) => ipcRenderer.invoke('storage:deleteSession', id),
    saveQA: (qa: Record<string, unknown>) => ipcRenderer.invoke('storage:saveQA', qa),
    exportData: () => ipcRenderer.invoke('storage:exportData'),
    clearAllData: () => ipcRenderer.invoke('storage:clearAllData'),
  },

  // File operations
  files: {
    readPDF: (filePath: string) => ipcRenderer.invoke('files:readPDF', filePath),
    readDOCX: (filePath: string) => ipcRenderer.invoke('files:readDOCX', filePath),
    openFileDialog: (options: { filters: Array<{ name: string; extensions: string[] }> }) =>
      ipcRenderer.invoke('files:openDialog', options),
    saveFileDialog: (options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
      ipcRenderer.invoke('files:saveDialog', options),
    writeFile: (filePath: string, data: string) => ipcRenderer.invoke('files:write', filePath, data),
  },

  // Screen capture / desktop capture lab
  capture: {
    getSources: (types: string[]) => ipcRenderer.invoke('capture:getSources', types),
    getDisplays: () => ipcRenderer.invoke('capture:getDisplays'),
    takeScreenshot: (sourceId: string) => ipcRenderer.invoke('capture:screenshot', sourceId),
  },

  // Shortcuts
  shortcuts: {
    getAll: () => ipcRenderer.invoke('shortcuts:getAll'),
    update: (action: string, key: string) => ipcRenderer.invoke('shortcuts:update', action, key),
  },

  // Events from main → renderer
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const ALLOWED_CHANNELS = [
      'shortcut:generate',
      'shortcut:copy',
      'shortcut:regenerate',
      'overlay:answerReady',
      'interview:questionDetected',
      'interview:ended',
      'app:error',
      'screen-share:capture-started',
      'screen-share:capture-ended',
    ];
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Type-safe platform info
const platform = {
  os: process.platform as 'win32' | 'darwin' | 'linux',
  version: process.env.npm_package_version || '1.0.0',
  isDev: process.env.NODE_ENV === 'development',
};

contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('platform', platform);

// TypeScript types for renderer
export type ElectronAPI = typeof api;
export type Platform = typeof platform;
