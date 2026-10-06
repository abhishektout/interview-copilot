import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure local worker to satisfy strict CSP
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
} catch {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  } catch {}
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getStoredApiKey(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('interview_copilot_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.geminiApiKey || '';
      }
    }
  } catch {}
  return '';
}

/**
 * Extract text from PDF using pdfjsLib
 */
async function extractWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const textParts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageStr = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    if (pageStr.trim()) {
      textParts.push(pageStr);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Universal document text extractor supporting PDF, DOCX, TXT, and MD.
 * If local PDF extraction fails, leverages Gemini multimodal PDF parsing.
 */
export async function extractTextFromFile(
  file: File,
  apiKey?: string
): Promise<{ text: string; analysis?: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  // 1. Plain text / Markdown
  if (ext === 'txt' || ext === 'md') {
    const text = await file.text();
    return { text };
  }

  const arrayBuffer = await file.arrayBuffer();

  // 2. Word Document (DOCX)
  if (ext === 'docx') {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value && result.value.trim()) {
        return { text: result.value };
      }
    } catch (docxErr) {
      console.warn('mammoth extraction failed, falling back:', docxErr);
    }
  }

  // 3. PDF Document
  if (ext === 'pdf') {
    // Try pdfjs-dist first
    try {
      const pdfText = await extractWithPdfJs(arrayBuffer);
      if (pdfText && pdfText.trim().length > 30) {
        return { text: pdfText };
      }
    } catch (pdfErr) {
      console.warn('pdfjs extraction failed, falling back to Gemini multimodal:', pdfErr);
    }

    // Direct Gemini Multimodal PDF parsing fallback
    const key = apiKey || getStoredApiKey();
    if (key) {
      try {
        const base64Data = await fileToBase64(file);
        const prompt = `You are an expert executive resume reviewer and technical interviewer.
Please carefully read this uploaded resume and output:

=== EXTRACTED TEXT ===
[Output the complete readable text extracted from this resume, preserving candidate name, contact, summary, skills, experience, and projects]

=== ANALYSIS ===
1. Executive Summary: 2-3 sentences overview of candidate background and target level
2. Core Technical Strengths: Bullet points of strongest demonstrated technical skills
3. Star Talking Points: 3 high-impact project stories from their experience for interviews
4. Recommended Interview Focus Areas: Likely topics and questions interviewers will ask`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'application/pdf',
                        data: base64Data,
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
            }),
          }
        );

        const data = await res.json();
        const geminiOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (geminiOutput && geminiOutput.length > 50) {
          if (geminiOutput.includes('=== EXTRACTED TEXT ===') && geminiOutput.includes('=== ANALYSIS ===')) {
            const parts = geminiOutput.split('=== ANALYSIS ===');
            const rawText = parts[0].replace('=== EXTRACTED TEXT ===', '').trim();
            const analysis = parts[1]?.trim() || '';
            return { text: rawText, analysis };
          }
          return { text: geminiOutput, analysis: geminiOutput };
        }
      } catch (geminiErr) {
        console.warn('Gemini multimodal PDF extraction failed:', geminiErr);
      }
    }
  }

  // 4. Fallback: try raw text decoding
  try {
    const raw = await file.text();
    if (raw && raw.length > 50 && !raw.includes('\u0000')) {
      return { text: raw };
    }
  } catch {}

  throw new Error(`Could not extract text from "${file.name}". Please ensure your Gemini API key is connected in Settings, or use the "Paste Text" option below.`);
}

/**
 * Analyze resume with Gemini API (works in both browser and Electron)
 */
export async function analyzeResumeWithGemini(
  resumeText: string,
  apiKey?: string,
  modelName: string = 'gemini-1.5-flash'
): Promise<string> {
  // If in Electron and API is available
  if (typeof window !== 'undefined' && window.electronAPI?.gemini?.analyzeResume) {
    try {
      return await window.electronAPI.gemini.analyzeResume(resumeText);
    } catch {}
  }

  const key = apiKey || getStoredApiKey();
  if (!key) {
    return 'Resume saved locally. Connect your Gemini API Key in Settings to generate full AI strengths and topic recommendations.';
  }

  const prompt = `You are an expert executive resume reviewer and technical interviewer.
Analyze this resume and provide:
1. Executive Summary: High-level overview of candidate profile (2-3 sentences)
2. Core Technical Strengths: Bullet points of strongest demonstrated skills
3. Star Talking Points: 3 specific high-impact project stories from their experience
4. Recommended Interview Focus Areas: Likely questions interviewers will ask based on this profile

Resume:
${resumeText.substring(0, 10000)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
  } catch (err) {
    console.warn('Gemini resume analysis failed:', err);
  }

  return 'Resume saved successfully. Ready for live practice!';
}
