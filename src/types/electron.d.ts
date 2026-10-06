// Global type declarations for the Electron bridge
interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    toggleOverlay: () => Promise<void>;
    showOverlay: () => Promise<void>;
    hideOverlay: () => Promise<void>;
    openInterview: () => Promise<void>;
    closeInterview: () => Promise<void>;
    setOverlayAlwaysOnTop: (value: boolean) => Promise<void>;
    setOverlayOpacity: (value: number) => Promise<void>;
    setOverlayContentProtection: (value: boolean) => Promise<void>;
    snapOverlay: (position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left') => Promise<void>;
  };
  gemini: {
    validateKey: (key: string) => Promise<{ valid: boolean; error?: string; model?: string }>;
    generateAnswer: (payload: {
      question: string;
      context: Record<string, unknown>;
      style: string;
      sessionId: string;
    }) => Promise<string>;
    generateFollowUp: (payload: {
      question: string;
      answer: string;
      context: Record<string, unknown>;
    }) => Promise<string>;
    evaluateAnswer: (payload: {
      question: string;
      answer: string;
      context: Record<string, unknown>;
    }) => Promise<{
      score: number;
      feedback: string;
      strengths: string[];
      improvements: string[];
      technical_accuracy?: number;
      communication?: number;
      clarity?: number;
      relevance?: number;
    }>;
    analyzeResume: (text: string) => Promise<string>;
    analyzeJobDescription: (text: string) => Promise<string>;
    generateInterviewQuestions: (context: string) => Promise<string[]>;
    generateReport: (sessionId: string) => Promise<InterviewReport>;
    onStreamChunk: (callback: (chunk: string) => void) => () => void;
    onStreamEnd: (callback: () => void) => () => void;
    onStreamError: (callback: (error: string) => void) => () => void;
  };
  storage: {
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
    getProfile: () => Promise<Profile | null>;
    saveProfile: (profile: Partial<Profile>) => Promise<Profile>;
    getResume: () => Promise<Resume | null>;
    saveResume: (resume: Partial<Resume>) => Promise<Resume>;
    getJobDescriptions: () => Promise<JobDescription[]>;
    saveJobDescription: (jd: Partial<JobDescription>) => Promise<JobDescription>;
    deleteJobDescription: (id: string) => Promise<void>;
    getSessions: () => Promise<Session[]>;
    getSession: (id: string) => Promise<Session | null>;
    createSession: (session: Partial<Session>) => Promise<Session>;
    updateSession: (id: string, data: Partial<Session>) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    saveQA: (qa: Partial<QARecord>) => Promise<QARecord>;
    exportData: () => Promise<string>;
    clearAllData: () => Promise<void>;
  };
  files: {
    readPDF: (filePath: string) => Promise<{ success: boolean; text?: string; pages?: number; error?: string }>;
    readDOCX: (filePath: string) => Promise<{ success: boolean; text?: string; error?: string }>;
    openFileDialog: (options: { filters: Array<{ name: string; extensions: string[] }> }) => Promise<{ canceled: boolean; filePaths: string[] }>;
    saveFileDialog: (options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ canceled: boolean; filePath?: string }>;
    writeFile: (filePath: string, data: string) => Promise<boolean>;
  };
  capture: {
    getSources: (types: string[]) => Promise<Array<{
      id: string;
      name: string;
      appIconUrl?: string;
      thumbnailUrl: string;
      display_id?: string;
    }>>;
    getDisplays: () => Promise<Array<{
      id: number;
      label: string;
      bounds: { x: number; y: number; width: number; height: number };
      workArea: { x: number; y: number; width: number; height: number };
      scaleFactor: number;
      rotation: number;
      primary: boolean;
    }>>;
    takeScreenshot: (sourceId: string) => Promise<string | null>;
  };
  shortcuts: {
    getAll: () => Promise<Array<{ key: string; action: string; description: string }>>;
    update: (action: string, key: string) => Promise<boolean>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string) => void;
}

interface Platform {
  os: 'win32' | 'darwin' | 'linux';
  version: string;
  isDev: boolean;
}

interface AppSettings {
  geminiApiKey?: string;
  geminiModel: string;
  temperature: number;
  maxTokens: number;
  answerStyle: string;
  language: string;
  autoGenerate: boolean;
  questionDetection: boolean;
  audioDevice: string;
  overlayPosition: { x: number; y: number };
  overlayOpacity: number;
  overlayFontSize: number;
  alwaysOnTop: boolean;
  contentProtection: boolean;
  shortcuts: Array<{ key: string; action: string; description: string }>;
  theme: string;
}

interface Profile {
  id: string;
  name: string;
  targetRole: string;
  experience: string;
  skills: string[];
  projects: string[];
  preferredStyle: string;
  language: string;
  updatedAt: string;
}

interface Resume {
  id: string;
  fileName: string;
  text: string;
  analysis: string;
  uploadedAt: string;
}

interface JobDescription {
  id: string;
  title: string;
  company: string;
  text: string;
  analysis: string;
  createdAt: string;
}

interface Session {
  id: string;
  title: string;
  type: 'practice' | 'mock' | 'capture-test';
  status: 'active' | 'completed' | 'paused';
  jobDescriptionId?: string;
  profileId?: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  score?: number;
  report?: string;
}

interface QARecord {
  id: string;
  sessionId: string;
  question: string;
  questionType: string;
  transcript: string;
  suggestedAnswer: string;
  userAnswer?: string;
  evaluation?: string;
  score?: number;
  createdAt: string;
}

interface InterviewReport {
  overallScore: number;
  technicalKnowledge: number;
  communication: number;
  clarity: number;
  confidence: number;
  relevance: number;
  problemSolving: number;
  answerStructure: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  topicsToStudy: string[];
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    platform: Platform;
  }
}

export type {
  ElectronAPI, Platform, AppSettings, Profile, Resume,
  JobDescription, Session, QARecord, InterviewReport,
};
