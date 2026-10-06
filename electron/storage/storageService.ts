import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface Settings {
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

export interface Profile {
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

export interface Resume {
  id: string;
  fileName: string;
  text: string;
  analysis: string;
  uploadedAt: string;
}

export interface JobDescription {
  id: string;
  title: string;
  company: string;
  text: string;
  analysis: string;
  createdAt: string;
}

export interface Session {
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

export interface QARecord {
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

const DEFAULT_SETTINGS: Settings = {
  geminiModel: 'gemini-1.5-flash',
  temperature: 0.7,
  maxTokens: 1024,
  answerStyle: 'normal',
  language: 'en',
  autoGenerate: true,
  questionDetection: true,
  audioDevice: 'default',
  overlayPosition: { x: 100, y: 100 },
  overlayOpacity: 0.95,
  overlayFontSize: 14,
  alwaysOnTop: true,
  contentProtection: true,
  shortcuts: [
    { key: 'CommandOrControl+Shift+I', action: 'toggle-assistant', description: 'Toggle AI Assistant' },
    { key: 'CommandOrControl+Shift+Space', action: 'generate-answer', description: 'Generate Answer' },
    { key: 'CommandOrControl+Shift+H', action: 'hide-assistant', description: 'Hide AI Assistant' },
    { key: 'CommandOrControl+Shift+C', action: 'copy-answer', description: 'Copy Answer' },
    { key: 'CommandOrControl+Shift+R', action: 'regenerate', description: 'Regenerate Answer' },
  ],
  theme: 'dark',
};

export class StorageService {
  private db: any = null;
  private dbPath: string;
  private isFallback: boolean = false;

  // In-memory fallback stores
  private memSettings: Partial<Settings> = {};
  private memProfile: Profile | null = null;
  private memResume: Resume | null = null;
  private memJDs: JobDescription[] = [];
  private memSessions: Session[] = [];
  private memQAs: QARecord[] = [];

  constructor(customDbPath?: string) {
    if (customDbPath) {
      this.dbPath = customDbPath;
    } else {
      const userDataPath = app?.getPath ? app.getPath('userData') : './data';
      const dataDir = join(userDataPath, 'data');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = join(dataDir, 'interview-copilot.db');
    }
  }

  async initialize(): Promise<void> {
    try {
      const DatabaseModule = await import('better-sqlite3');
      const Database = DatabaseModule.default || DatabaseModule;
      this.db = new (Database as any)(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.createTables();
    } catch {
      // Gracefully switch to in-memory store if native binary mismatch or unsupported
      this.isFallback = true;
    }
  }

  private createTables(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        targetRole TEXT,
        experience TEXT,
        skills TEXT,
        projects TEXT,
        preferredStyle TEXT DEFAULT 'normal',
        language TEXT DEFAULT 'en',
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resumes (
        id TEXT PRIMARY KEY,
        fileName TEXT NOT NULL,
        text TEXT NOT NULL,
        analysis TEXT,
        uploadedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_descriptions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT,
        text TEXT NOT NULL,
        analysis TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        jobDescriptionId TEXT,
        profileId TEXT,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        duration INTEGER,
        score REAL,
        report TEXT
      );

      CREATE TABLE IF NOT EXISTS qa_records (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        question TEXT NOT NULL,
        questionType TEXT,
        transcript TEXT,
        suggestedAnswer TEXT,
        userAnswer TEXT,
        evaluation TEXT,
        score REAL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);
  }

  // Settings
  async getSettings(): Promise<Settings> {
    if (this.isFallback || !this.db) {
      return { ...DEFAULT_SETTINGS, ...this.memSettings };
    }
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const stored: Partial<Settings> = {};
    for (const row of rows) {
      try {
        (stored as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        (stored as Record<string, unknown>)[row.key] = row.value;
      }
    }
    const result: Settings = { ...DEFAULT_SETTINGS, ...stored };
    if (!result.geminiModel || result.geminiModel.includes('3.8') || result.geminiModel.includes('2.5')) {
      result.geminiModel = 'gemini-1.5-flash';
    }
    return result;
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    if (this.isFallback || !this.db) {
      this.memSettings = { ...this.memSettings, ...settings };
      return;
    }
    const insert = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const tx = this.db.transaction((data: Partial<Settings>) => {
      for (const [key, value] of Object.entries(data)) {
        insert.run(key, JSON.stringify(value));
      }
    });
    tx(settings);
  }

  async getApiKey(): Promise<string | null> {
    const settings = await this.getSettings();
    return settings.geminiApiKey || null;
  }

  // Profile
  async getProfile(): Promise<Profile | null> {
    if (this.isFallback || !this.db) {
      return this.memProfile;
    }
    const row = this.db.prepare('SELECT * FROM profiles LIMIT 1').get() as Profile | null;
    if (!row) return null;
    return {
      ...row,
      skills: row.skills ? JSON.parse(row.skills as unknown as string) : [],
      projects: row.projects ? JSON.parse(row.projects as unknown as string) : [],
    };
  }

  async saveProfile(profile: Omit<Profile, 'id' | 'updatedAt'> & { id?: string }): Promise<Profile> {
    const id = profile.id || crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    const saved = { ...profile, id, updatedAt } as Profile;

    if (this.isFallback || !this.db) {
      this.memProfile = saved;
      return saved;
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO profiles (id, name, targetRole, experience, skills, projects, preferredStyle, language, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, profile.name, profile.targetRole, profile.experience,
      JSON.stringify(profile.skills || []),
      JSON.stringify(profile.projects || []),
      profile.preferredStyle || 'normal',
      profile.language || 'en',
      updatedAt
    );
    return saved;
  }

  // Resume
  async getResume(): Promise<Resume | null> {
    if (this.isFallback || !this.db) {
      return this.memResume;
    }
    return this.db.prepare('SELECT * FROM resumes ORDER BY uploadedAt DESC LIMIT 1').get() as Resume | null;
  }

  async saveResume(resume: Omit<Resume, 'id' | 'uploadedAt'>): Promise<Resume> {
    const id = crypto.randomUUID();
    const uploadedAt = new Date().toISOString();
    const saved = { ...resume, id, uploadedAt };

    if (this.isFallback || !this.db) {
      this.memResume = saved;
      return saved;
    }

    this.db.prepare('DELETE FROM resumes').run(); // keep only latest
    this.db.prepare(`
      INSERT INTO resumes (id, fileName, text, analysis, uploadedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, resume.fileName, resume.text, resume.analysis || '', uploadedAt);
    return saved;
  }

  // Job Descriptions
  async getJobDescriptions(): Promise<JobDescription[]> {
    if (this.isFallback || !this.db) {
      return this.memJDs;
    }
    return this.db.prepare('SELECT * FROM job_descriptions ORDER BY createdAt DESC').all() as JobDescription[];
  }

  async saveJobDescription(jd: Omit<JobDescription, 'id' | 'createdAt'>): Promise<JobDescription> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const saved = { ...jd, id, createdAt };

    if (this.isFallback || !this.db) {
      this.memJDs.unshift(saved);
      return saved;
    }

    this.db.prepare(`
      INSERT INTO job_descriptions (id, title, company, text, analysis, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, jd.title, jd.company || '', jd.text, jd.analysis || '', createdAt);
    return saved;
  }

  async deleteJobDescription(id: string): Promise<void> {
    if (this.isFallback || !this.db) {
      this.memJDs = this.memJDs.filter(j => j.id !== id);
      return;
    }
    this.db.prepare('DELETE FROM job_descriptions WHERE id = ?').run(id);
  }

  // Sessions
  async getSessions(): Promise<Session[]> {
    if (this.isFallback || !this.db) {
      return this.memSessions;
    }
    return this.db.prepare('SELECT * FROM sessions ORDER BY startedAt DESC').all() as Session[];
  }

  async getSession(id: string): Promise<Session | null> {
    if (this.isFallback || !this.db) {
      return this.memSessions.find(s => s.id === id) || null;
    }
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | null;
  }

  async createSession(session: Omit<Session, 'id' | 'startedAt'>): Promise<Session> {
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const created: Session = {
      ...session,
      id,
      startedAt,
      status: session.status || 'active',
    };

    if (this.isFallback || !this.db) {
      this.memSessions.unshift(created);
      return created;
    }

    this.db.prepare(`
      INSERT INTO sessions (id, title, type, status, jobDescriptionId, profileId, startedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, session.title, session.type, session.status || 'active', session.jobDescriptionId || null, session.profileId || null, startedAt);
    return created;
  }

  async updateSession(id: string, data: Partial<Session>): Promise<void> {
    if (this.isFallback || !this.db) {
      const idx = this.memSessions.findIndex(s => s.id === id);
      if (idx !== -1) {
        this.memSessions[idx] = { ...this.memSessions[idx], ...data };
      }
      return;
    }
    const fields = Object.entries(data)
      .map(([key]) => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(data), id];
    this.db.prepare(`UPDATE sessions SET ${fields} WHERE id = ?`).run(...values);
  }

  async deleteSession(id: string): Promise<void> {
    if (this.isFallback || !this.db) {
      this.memSessions = this.memSessions.filter(s => s.id !== id);
      this.memQAs = this.memQAs.filter(q => q.sessionId !== id);
      return;
    }
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  // QA Records
  async getSessionQA(sessionId: string): Promise<QARecord[]> {
    if (this.isFallback || !this.db) {
      return this.memQAs.filter(q => q.sessionId === sessionId);
    }
    return this.db.prepare('SELECT * FROM qa_records WHERE sessionId = ? ORDER BY createdAt ASC').all(sessionId) as QARecord[];
  }

  async saveQA(qa: Omit<QARecord, 'id' | 'createdAt'>): Promise<QARecord> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const saved: QARecord = {
      ...qa,
      id,
      createdAt,
      questionType: qa.questionType || 'general',
    };

    if (this.isFallback || !this.db) {
      this.memQAs.push(saved);
      return saved;
    }

    this.db.prepare(`
      INSERT INTO qa_records (id, sessionId, question, questionType, transcript, suggestedAnswer, userAnswer, evaluation, score, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, qa.sessionId, qa.question, qa.questionType || 'general',
      qa.transcript || '', qa.suggestedAnswer || '',
      qa.userAnswer || null, qa.evaluation || null, qa.score || null, createdAt
    );
    return saved;
  }

  // Export
  async exportData(): Promise<string> {
    const settings = await this.getSettings();
    const { geminiApiKey: _, ...safeSettings } = settings;
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      settings: safeSettings,
      profile: await this.getProfile(),
      sessions: await this.getSessions(),
    }, null, 2);
  }

  async clearAllData(): Promise<void> {
    if (this.isFallback || !this.db) {
      this.memSettings = {};
      this.memProfile = null;
      this.memResume = null;
      this.memJDs = [];
      this.memSessions = [];
      this.memQAs = [];
      return;
    }
    this.db.exec(`
      DELETE FROM qa_records;
      DELETE FROM sessions;
      DELETE FROM job_descriptions;
      DELETE FROM resumes;
      DELETE FROM profiles;
      DELETE FROM settings;
    `);
  }
}
