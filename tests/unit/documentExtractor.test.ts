import { describe, it, expect } from 'vitest';
import { extractTextFromFile } from '../../src/utils/documentExtractor';

describe('Document Extractor', () => {
  it('extracts plain text file correctly', async () => {
    const textContent = `Abhishek Sharma
Software Engineer with 4 years experience in React, Node.js, and TypeScript.
Key projects: Distributed real-time chat, AI interview copilot.`;

    const blob = new Blob([textContent], { type: 'text/plain' });
    const file = new File([blob], 'resume.txt', { type: 'text/plain' });

    const extracted = await extractTextFromFile(file);
    expect(extracted.text).toContain('Abhishek Sharma');
    expect(extracted.text).toContain('React, Node.js, and TypeScript');
  });

  it('extracts markdown file correctly', async () => {
    const mdContent = `# Senior Full Stack Engineer
- Skills: Python, TypeScript, Docker, Kubernetes`;

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const file = new File([blob], 'resume.md', { type: 'text/markdown' });

    const extracted = await extractTextFromFile(file);
    expect(extracted.text).toContain('Senior Full Stack Engineer');
    expect(extracted.text).toContain('Kubernetes');
  });
});
