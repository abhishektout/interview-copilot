import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../../electron/storage/storageService';

describe('StorageService (SQLite In-Memory)', () => {
  let storage: StorageService;

  beforeEach(async () => {
    storage = new StorageService(':memory:');
    await storage.initialize();
  });

  describe('Settings Management', () => {
    it('returns default settings when none are stored', async () => {
      const settings = await storage.getSettings();
      expect(settings).toBeDefined();
      expect(settings.geminiModel).toBe('gemini-1.5-flash');
      expect(settings.temperature).toBe(0.7);
      expect(settings.autoGenerate).toBe(true);
      expect(settings.alwaysOnTop).toBe(true);
    });

    it('updates and persists settings', async () => {
      await storage.saveSettings({
        geminiApiKey: 'test-api-key-12345',
        geminiModel: 'gemini-1.5-pro',
        temperature: 0.4,
      });

      const updated = await storage.getSettings();
      expect(updated.geminiApiKey).toBe('test-api-key-12345');
      expect(updated.geminiModel).toBe('gemini-1.5-pro');
      expect(updated.temperature).toBe(0.4);
      expect(updated.autoGenerate).toBe(true); // preserved default
    });
  });

  describe('Profile Management', () => {
    it('saves and retrieves candidate profile', async () => {
      const profile = {
        name: 'Sarah Connor',
        targetRole: 'Staff Systems Architect',
        experience: '8+ years',
        skills: ['Rust', 'Distributed Systems', 'Linux Kernel'],
        projects: ['High-performance storage engine'],
        preferredStyle: 'technical',
        language: 'en',
      };

      const saved = await storage.saveProfile(profile);
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe('Sarah Connor');
      expect(saved.skills).toContain('Rust');

      const retrieved = await storage.getProfile();
      expect(retrieved).toBeDefined();
      expect(retrieved?.targetRole).toBe('Staff Systems Architect');
      expect(retrieved?.skills).toEqual(['Rust', 'Distributed Systems', 'Linux Kernel']);
    });
  });

  describe('Session & Q&A Management', () => {
    it('creates, retrieves, and updates an interview session', async () => {
      const session = await storage.createSession({
        title: 'Google Staff Engineer Mock',
        type: 'mock',
        status: 'active',
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');

      // Add QA record
      const qa = await storage.saveQA({
        sessionId: session.id,
        question: 'How do you design a distributed lock service?',
        questionType: 'system-design',
        transcript: 'Tell me how you would approach distributed locking',
        suggestedAnswer: 'You could use Chubby or Raft-backed consensus (etcd)...',
        score: 92,
      });

      expect(qa.id).toBeDefined();
      expect(qa.sessionId).toBe(session.id);

      // Fetch QA records for session
      const records = await storage.getSessionQA(session.id);
      expect(records.length).toBe(1);
      expect(records[0].question).toContain('distributed lock');

      // Update session with report and score
      await storage.updateSession(session.id, {
        status: 'completed',
        score: 88,
        duration: 1200,
        report: JSON.stringify({ overallScore: 88, strengths: ['Deep consensus knowledge'] }),
      });

      const updatedSession = await storage.getSession(session.id);
      expect(updatedSession?.status).toBe('completed');
      expect(updatedSession?.score).toBe(88);

      const allSessions = await storage.getSessions();
      expect(allSessions.length).toBe(1);
      expect(allSessions[0].score).toBe(88);
    });

    it('deletes session and cascading QA records', async () => {
      const session = await storage.createSession({
        title: 'Test Session',
        type: 'practice',
        status: 'completed',
      });

      await storage.saveQA({
        sessionId: session.id,
        question: 'Test question?',
        questionType: 'general',
        transcript: '',
        suggestedAnswer: 'Test answer',
      });

      await storage.deleteSession(session.id);

      const sessions = await storage.getSessions();
      expect(sessions.length).toBe(0);

      const records = await storage.getSessionQA(session.id);
      expect(records.length).toBe(0);
    });
  });
});
