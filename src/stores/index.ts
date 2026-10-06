import { create } from 'zustand';
import type { AppSettings, Profile, Resume, JobDescription, Session } from '../types/electron';

// ============================
// App Store (global app state)
// ============================
interface AppState {
  isElectron: boolean;
  isInitialized: boolean;
  settings: AppSettings | null;
  isGeminiConnected: boolean;
  currentPage: string;

  setInitialized: (v: boolean) => void;
  setSettings: (s: AppSettings) => void;
  setGeminiConnected: (v: boolean) => void;
  setCurrentPage: (p: string) => void;
  saveSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  isElectron: typeof window !== 'undefined' && !!window.electronAPI,
  isInitialized: false,
  settings: null,
  isGeminiConnected: false,
  currentPage: 'dashboard',

  setInitialized: (v) => set({ isInitialized: v }),
  setSettings: (s) => set({ settings: s }),
  setGeminiConnected: (v) => set({ isGeminiConnected: v }),
  setCurrentPage: (p) => set({ currentPage: p }),

  saveSettings: async (updates) => {
    const current = get().settings;
    const merged = { ...current, ...updates } as AppSettings;
    set({ settings: merged });
    try {
      localStorage.setItem('interview_copilot_settings', JSON.stringify(merged));
    } catch {}
    if (window.electronAPI) {
      await window.electronAPI.storage.saveSettings(updates);
    }
  },
}));

// ============================
// Profile Store
// ============================
interface ProfileState {
  profile: Profile | null;
  resume: Resume | null;
  jobDescriptions: JobDescription[];
  isLoading: boolean;

  setProfile: (p: Profile | null) => void;
  setResume: (r: Resume | null) => void;
  setJobDescriptions: (jds: JobDescription[]) => void;
  loadAll: () => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  saveResume: (r: Partial<Resume>) => Promise<Resume | null>;
  addJobDescription: (jd: Partial<JobDescription>) => Promise<void>;
  deleteJobDescription: (id: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  resume: null,
  jobDescriptions: [],
  isLoading: false,

  setProfile: (p) => set({ profile: p }),
  setResume: (r) => set({ resume: r }),
  setJobDescriptions: (jds) => set({ jobDescriptions: jds }),

  loadAll: async () => {
    set({ isLoading: true });
    try {
      if (window.electronAPI) {
        const [profile, resume, jds] = await Promise.all([
          window.electronAPI.storage.getProfile(),
          window.electronAPI.storage.getResume(),
          window.electronAPI.storage.getJobDescriptions(),
        ]);
        set({ profile, resume, jobDescriptions: jds });
      } else {
        const profile = JSON.parse(localStorage.getItem('interview_copilot_profile') || 'null');
        const resume = JSON.parse(localStorage.getItem('interview_copilot_resume') || 'null');
        const jds = JSON.parse(localStorage.getItem('interview_copilot_jds') || '[]');
        set({ profile, resume, jobDescriptions: jds });
      }
    } catch (err) {
      console.warn('Failed to load profile data:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  saveProfile: async (p) => {
    const current = get().profile;
    const updated: Profile = {
      id: current?.id || crypto.randomUUID(),
      name: p.name || '',
      targetRole: p.targetRole || '',
      experience: p.experience || '',
      skills: p.skills || [],
      projects: p.projects || [],
      preferredStyle: p.preferredStyle || 'normal',
      language: p.language || 'en',
      updatedAt: new Date().toISOString(),
      ...current,
      ...p,
    };
    set({ profile: updated });
    try {
      localStorage.setItem('interview_copilot_profile', JSON.stringify(updated));
    } catch {}
    if (window.electronAPI) {
      await window.electronAPI.storage.saveProfile(p);
    }
  },

  saveResume: async (r) => {
    const saved: Resume = {
      id: crypto.randomUUID(),
      fileName: r.fileName || 'Resume',
      text: r.text || '',
      analysis: r.analysis || '',
      uploadedAt: new Date().toISOString(),
      ...r,
    };
    set({ resume: saved });
    try {
      localStorage.setItem('interview_copilot_resume', JSON.stringify(saved));
    } catch {}
    if (window.electronAPI) {
      return await window.electronAPI.storage.saveResume(r);
    }
    return saved;
  },

  addJobDescription: async (jd) => {
    const created: JobDescription = {
      id: crypto.randomUUID(),
      title: jd.title || 'Untitled Role',
      company: jd.company || '',
      text: jd.text || '',
      analysis: jd.analysis || '',
      createdAt: new Date().toISOString(),
      ...jd,
    };
    const nextJds = [created, ...get().jobDescriptions];
    set({ jobDescriptions: nextJds });
    try {
      localStorage.setItem('interview_copilot_jds', JSON.stringify(nextJds));
    } catch {}
    if (window.electronAPI) {
      await window.electronAPI.storage.saveJobDescription(jd);
    }
  },

  deleteJobDescription: async (id) => {
    const nextJds = get().jobDescriptions.filter(j => j.id !== id);
    set({ jobDescriptions: nextJds });
    try {
      localStorage.setItem('interview_copilot_jds', JSON.stringify(nextJds));
    } catch {}
    if (window.electronAPI) {
      await window.electronAPI.storage.deleteJobDescription(id);
    }
  },
}));

// ============================
// Session Store
// ============================
interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  isLoading: boolean;

  loadSessions: () => Promise<void>;
  setCurrentSession: (s: Session | null) => void;
  createSession: (s: Partial<Session>) => Promise<Session | null>;
  updateCurrentSession: (data: Partial<Session>) => Promise<void>;
  endSession: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: false,

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      if (window.electronAPI) {
        const sessions = await window.electronAPI.storage.getSessions();
        set({ sessions });
      } else {
        const sessions = JSON.parse(localStorage.getItem('interview_copilot_sessions') || '[]');
        set({ sessions });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  setCurrentSession: (s) => set({ currentSession: s }),

  createSession: async (s) => {
    const session: Session = {
      id: crypto.randomUUID(),
      title: s.title || 'Practice Session',
      type: s.type || 'practice',
      status: s.status || 'active',
      startedAt: new Date().toISOString(),
      ...s,
    };
    const nextSessions = [session, ...get().sessions];
    set({ currentSession: session, sessions: nextSessions });
    try {
      localStorage.setItem('interview_copilot_sessions', JSON.stringify(nextSessions));
    } catch {}
    if (window.electronAPI) {
      return await window.electronAPI.storage.createSession(s);
    }
    return session;
  },

  updateCurrentSession: async (data) => {
    const current = get().currentSession;
    if (!current) return;
    const updated = { ...current, ...data };
    const nextSessions = get().sessions.map(s => s.id === current.id ? updated : s);
    set({
      currentSession: updated,
      sessions: nextSessions,
    });
    try {
      localStorage.setItem('interview_copilot_sessions', JSON.stringify(nextSessions));
    } catch {}
    if (window.electronAPI) {
      await window.electronAPI.storage.updateSession(current.id, data);
    }
  },

  endSession: async () => {
    const current = get().currentSession;
    if (!current) return;
    const endedAt = new Date().toISOString();
    const duration = Math.floor((new Date(endedAt).getTime() - new Date(current.startedAt).getTime()) / 1000);
    const updated = {
      ...current,
      status: 'completed' as const,
      endedAt,
      duration,
    };
    const nextSessions = get().sessions.map(s => s.id === current.id ? updated : s);
    set({ currentSession: null, sessions: nextSessions });
    try {
      localStorage.setItem('interview_copilot_sessions', JSON.stringify(nextSessions));
    } catch {}
    if (window.electronAPI) {
      await window.electronAPI.storage.updateSession(current.id, {
        status: 'completed',
        endedAt,
        duration,
      });
      await get().loadSessions();
    }
  },

  deleteSession: async (id) => {
    const nextSessions = get().sessions.filter(s => s.id !== id);
    set({ sessions: nextSessions });
    try {
      localStorage.setItem('interview_copilot_sessions', JSON.stringify(nextSessions));
    } catch {}
    if (window.electronAPI) {
      await window.electronAPI.storage.deleteSession(id);
    }
  },
}));

// ============================
// Interview Store (live state)
// ============================
interface InterviewState {
  isRunning: boolean;
  isPaused: boolean;
  transcript: string;
  currentQuestion: string;
  currentQuestionType: string;
  suggestedAnswer: string;
  isGenerating: boolean;
  streamingAnswer: string;
  elapsedSeconds: number;
  qaHistory: Array<{
    question: string;
    answer: string;
    score?: number;
    timestamp: string;
  }>;

  startInterview: () => void;
  pauseInterview: () => void;
  stopInterview: () => void;
  setTranscript: (t: string) => void;
  setCurrentQuestion: (q: string, type?: string) => void;
  setSuggestedAnswer: (a: string) => void;
  setIsGenerating: (v: boolean) => void;
  appendStreamChunk: (chunk: string) => void;
  finalizeStreamAnswer: () => void;
  addToHistory: (qa: { question: string; answer: string; score?: number }) => void;
  incrementTimer: () => void;
  resetTimer: () => void;
}

export const useInterviewStore = create<InterviewState>((set, get) => ({
  isRunning: false,
  isPaused: false,
  transcript: '',
  currentQuestion: '',
  currentQuestionType: 'general',
  suggestedAnswer: '',
  isGenerating: false,
  streamingAnswer: '',
  elapsedSeconds: 0,
  qaHistory: [],

  startInterview: () => set({ isRunning: true, isPaused: false }),
  pauseInterview: () => set({ isPaused: !get().isPaused }),
  stopInterview: () => set({
    isRunning: false,
    isPaused: false,
    transcript: '',
    currentQuestion: '',
    suggestedAnswer: '',
    streamingAnswer: '',
    isGenerating: false,
  }),

  setTranscript: (t) => set({ transcript: t }),
  setCurrentQuestion: (q, type = 'general') => set({
    currentQuestion: q,
    currentQuestionType: type,
    suggestedAnswer: '',
    streamingAnswer: '',
  }),
  setSuggestedAnswer: (a) => set({ suggestedAnswer: a }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  appendStreamChunk: (chunk) => set((state) => ({
    streamingAnswer: state.streamingAnswer + chunk,
    isGenerating: true,
  })),
  finalizeStreamAnswer: () => set((state) => ({
    suggestedAnswer: state.streamingAnswer,
    streamingAnswer: '',
    isGenerating: false,
  })),

  addToHistory: (qa) => set((state) => ({
    qaHistory: [...state.qaHistory, { ...qa, timestamp: new Date().toISOString() }],
  })),

  incrementTimer: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
  resetTimer: () => set({ elapsedSeconds: 0 }),
}));
