import { describe, it, expect } from 'vitest';
import { GeminiService } from '../../electron/ai/geminiService';

describe('Question Detection & Classification', () => {
  const service = new GeminiService();

  describe('detectIsQuestion', () => {
    it('detects question ending with question mark', () => {
      expect(service.detectIsQuestion('Do you know how to use Docker?')).toBe(true);
      expect(service.detectIsQuestion('What is event-driven architecture?')).toBe(true);
    });

    it('detects questions starting with common interview question starters without question mark', () => {
      expect(service.detectIsQuestion('Tell me about a time you resolved a production outage')).toBe(true);
      expect(service.detectIsQuestion('Explain how database indexes work')).toBe(true);
      expect(service.detectIsQuestion('Walk me through your resume')).toBe(true);
      expect(service.detectIsQuestion('Describe a challenging situation with a stakeholder')).toBe(true);
      expect(service.detectIsQuestion('Give me an example of when you took initiative')).toBe(true);
      expect(service.detectIsQuestion('Can you describe your experience with GraphQL')).toBe(true);
    });

    it('rejects regular non-question statements', () => {
      expect(service.detectIsQuestion('Sounds good, thank you for that.')).toBe(false);
      expect(service.detectIsQuestion('I will now explain my background.')).toBe(false);
      expect(service.detectIsQuestion('Welcome to the call today.')).toBe(false);
    });
  });

  describe('detectQuestionType', () => {
    it('classifies system design questions', () => {
      expect(service.detectQuestionType('How would you design a system to scale to 10M DAU?')).toBe('system-design');
      expect(service.detectQuestionType('Discuss the architecture of a real-time messaging application.')).toBe('system-design');
    });

    it('classifies coding questions', () => {
      expect(service.detectQuestionType('Can you implement an LRU cache in TypeScript?')).toBe('coding');
      expect(service.detectQuestionType('Write a function to detect cycles in a directed graph.')).toBe('coding');
      expect(service.detectQuestionType('What algorithm would you choose for shortest path?')).toBe('coding');
    });

    it('classifies behavioral questions', () => {
      expect(service.detectQuestionType('Tell me about a time you disagreed with a tech lead.')).toBe('behavioral');
      expect(service.detectQuestionType('Describe a situation where a project missed a deadline.')).toBe('behavioral');
      expect(service.detectQuestionType('Give me an example of handling conflict.')).toBe('behavioral');
    });

    it('classifies HR questions', () => {
      expect(service.detectQuestionType('What are your salary expectations?')).toBe('hr');
      expect(service.detectQuestionType('Why this company specifically?')).toBe('hr');
      expect(service.detectQuestionType('What are your greatest strengths and weaknesses?')).toBe('hr');
    });

    it('classifies technical explanation questions', () => {
      expect(service.detectQuestionType('What is the difference between TCP and UDP?')).toBe('technical');
      expect(service.detectQuestionType('Explain how optimistic concurrency control works.')).toBe('technical');
      expect(service.detectQuestionType('Why would you use Redis over Memcached?')).toBe('technical');
    });

    it('classifies follow-up questions', () => {
      expect(service.detectQuestionType('Can you clarify that last point about partitions?')).toBe('follow-up');
      expect(service.detectQuestionType('Could you elaborate on how caching was invalidated?')).toBe('follow-up');
    });

    it('defaults to general for unstructured questions', () => {
      expect(service.detectQuestionType('What are your thoughts on this?')).toBe('general');
      expect(service.detectQuestionType('Hello there.')).toBe('general');
    });
  });
});
