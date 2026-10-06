import { describe, it, expect } from 'vitest';
import { GeminiService, type CandidateContext, type AnswerStyle } from '../../electron/ai/geminiService';

describe('GeminiService', () => {
  it('instantiates cleanly without errors', () => {
    const service = new GeminiService();
    expect(service).toBeDefined();
  });

  it('buildContextPrompt includes profile skills and projects', () => {
    const service = new GeminiService();
    // Use reflection or access private method for testing prompt formatting
    const context: CandidateContext = {
      profile: {
        name: 'Alex Johnson',
        targetRole: 'Senior Full Stack Engineer',
        experience: '5 years',
        skills: ['TypeScript', 'React', 'Node.js', 'System Design'],
        projects: ['High-throughput message queue', 'Real-time collaborative whiteboard'],
      },
      resumeSummary: 'Expertise in building distributed systems and microservices.',
      jobDescription: 'Seeking a Senior Full Stack Engineer experienced with TypeScript and distributed architectures.',
      recentTranscript: 'Can you describe your experience with microservices?',
    };

    const promptText = (service as any).buildContextPrompt(context);
    expect(promptText).toContain('Alex Johnson');
    expect(promptText).toContain('Senior Full Stack Engineer');
    expect(promptText).toContain('TypeScript, React, Node.js, System Design');
    expect(promptText).toContain('High-throughput message queue');
    expect(promptText).toContain('RESUME HIGHLIGHTS');
    expect(promptText).toContain('JOB REQUIREMENTS');
    expect(promptText).toContain('RECENT INTERVIEW CONTEXT');
  });

  it('returns empty context prompt when context is undefined', () => {
    const service = new GeminiService();
    const promptText = (service as any).buildContextPrompt(undefined);
    expect(promptText).toBe('');
  });

  it('provides appropriate style instructions for different styles', () => {
    const service = new GeminiService();
    const styles: AnswerStyle[] = ['concise', 'normal', 'technical', 'star', 'natural'];

    for (const style of styles) {
      const instruction = (service as any).getStyleInstruction(style);
      expect(instruction).toBeDefined();
      expect(typeof instruction).toBe('string');
      expect(instruction.length).toBeGreaterThan(10);
    }

    expect((service as any).getStyleInstruction('star')).toContain('STAR method');
    expect((service as any).getStyleInstruction('concise')).toContain('concise');
    expect((service as any).getStyleInstruction('technical')).toContain('technical');
  });

  it('throws error when generateAnswer is called without initialization', async () => {
    const service = new GeminiService();
    await expect(service.generateAnswer({ question: 'What is your background?' })).rejects.toThrow(
      'Gemini not initialized'
    );
  });
});
