import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export type AnswerStyle = 'concise' | 'normal' | 'technical' | 'star' | 'natural';
export type QuestionType = 'technical' | 'behavioral' | 'hr' | 'coding' | 'system-design' | 'general' | 'follow-up';

export interface CandidateContext {
  profile?: {
    name: string;
    targetRole: string;
    experience: string;
    skills: string[];
    projects: string[];
  };
  resumeSummary?: string;
  jobDescription?: string;
  recentTranscript?: string;
}

export interface GenerateAnswerOptions {
  question: string;
  questionType?: QuestionType;
  answerStyle?: AnswerStyle;
  context?: CandidateContext;
  sessionId?: string;
}

export interface EvaluationResult {
  score: number; // 0-100
  feedback: string;
  strengths: string[];
  improvements: string[];
  technical_accuracy?: number;
  communication?: number;
  clarity?: number;
  relevance?: number;
}

export interface InterviewReport {
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

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export class GeminiService {
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;
  private model: string = 'gemini-1.5-flash';
  private temperature: number = 0.7;

  initialize(apiKey: string, model?: string, temperature?: number): void {
    this.apiKey = apiKey;
    this.client = new GoogleGenerativeAI(apiKey);
    if (model && !model.includes('3.8')) this.model = model;
    if (temperature !== undefined) this.temperature = temperature;
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return { valid: false, error: 'Invalid API key format.' };
    }

    const key = apiKey.trim();

    try {
      // 1. Query Google's ModelService.ListModels endpoint directly
      // This is the most reliable method as recommended by Google's API
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      const data = await res.json() as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
        error?: { code: number; message: string; details?: Array<{ reason?: string }> };
      };

      if (data.error) {
        const errMsg = data.error.message || '';
        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('not valid') || data.error.code === 400 || data.error.code === 401) {
          return { valid: false, error: 'Invalid API key. Please check your key from Google AI Studio.' };
        }
        return { valid: false, error: errMsg };
      }

      if (Array.isArray(data.models) && data.models.length > 0) {
        const contentModels = data.models
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));

        // Pick best model: prefer 1.5-flash or any flash model, else first available content model
        const bestModel = contentModels.find(m => m.includes('1.5-flash')) ||
                          contentModels.find(m => m.includes('flash')) ||
                          contentModels.find(m => m.includes('gemini')) ||
                          contentModels[0] ||
                          'gemini-1.5-flash';

        this.model = bestModel;
        this.apiKey = key;
        this.client = new GoogleGenerativeAI(key);
        return { valid: true, model: bestModel };
      }

      // 2. Direct generateContent fallback with candidate models
      const testClient = new GoogleGenerativeAI(key);
      const candidateModels = [this.model, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'].filter(
        m => m && !m.includes('3.8')
      );
      const uniqueModels = Array.from(new Set(candidateModels));

      for (const m of uniqueModels) {
        try {
          const testModel = testClient.getGenerativeModel({ model: m });
          const result = await testModel.generateContent('Say "valid" in one word.');
          if (result.response.text()) {
            this.model = m;
            this.apiKey = key;
            this.client = testClient;
            return { valid: true, model: m };
          }
        } catch {
          continue;
        }
      }

      return { valid: false, error: 'No compatible text generation model found for this key.' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { valid: false, error: msg };
    }
  }

  private buildContextPrompt(context?: CandidateContext): string {
    if (!context) return '';
    const parts: string[] = [];

    if (context.profile) {
      parts.push(`CANDIDATE PROFILE:
- Name: ${context.profile.name}
- Target Role: ${context.profile.targetRole}
- Experience: ${context.profile.experience}
- Key Skills: ${context.profile.skills.join(', ')}
- Notable Projects: ${context.profile.projects.join(', ')}`);
    }

    if (context.resumeSummary) {
      parts.push(`RESUME HIGHLIGHTS:\n${context.resumeSummary}`);
    }

    if (context.jobDescription) {
      parts.push(`JOB REQUIREMENTS:\n${context.jobDescription.substring(0, 500)}`);
    }

    if (context.recentTranscript) {
      parts.push(`RECENT INTERVIEW CONTEXT:\n${context.recentTranscript.substring(0, 300)}`);
    }

    return parts.join('\n\n');
  }

  private getStyleInstruction(style: AnswerStyle): string {
    switch (style) {
      case 'concise':
        return 'Provide a concise answer (20-40 seconds when spoken). Be direct and punchy.';
      case 'normal':
        return 'Provide a well-rounded answer (45-90 seconds when spoken). Cover key points naturally.';
      case 'technical':
        return 'Provide a technical, detailed answer with specific examples, code concepts, or architectural decisions.';
      case 'star':
        return 'Structure the answer using the STAR method: Situation → Task → Action → Result. Each section should be clear.';
      case 'natural':
        return 'Provide a conversational, human-sounding answer. Avoid buzzwords. Sound authentic.';
      default:
        return 'Provide a professional interview answer.';
    }
  }

  async generateAnswer(
    options: GenerateAnswerOptions,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.client) throw new Error('Gemini not initialized. Please set your API key.');

    const model = this.client.getGenerativeModel({
      model: this.model,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: 1024,
      },
    });

    const contextPrompt = this.buildContextPrompt(options.context);
    const styleInstruction = this.getStyleInstruction(options.answerStyle || 'normal');

    const prompt = `You are an expert interview coach helping a candidate practice for a ${options.context?.profile?.targetRole || 'software engineering'} role.

${contextPrompt}

INTERVIEW QUESTION: "${options.question}"
QUESTION TYPE: ${options.questionType || 'general'}

INSTRUCTIONS:
- ${styleInstruction}
- Base the answer ONLY on the candidate's actual experience and skills listed above
- Never invent experience or credentials not mentioned in the profile
- Sound natural and human - avoid corporate jargon
- Be specific with real examples when possible
- Do not include phrases like "As an AI" or "I should mention"
- Respond as if the candidate is speaking directly

Provide the answer directly without any preamble:`;

    if (onChunk) {
      const stream = await model.generateContentStream(prompt);
      let fullText = '';
      for await (const chunk of stream.stream) {
        const text = chunk.text();
        fullText += text;
        onChunk(text);
      }
      return fullText;
    } else {
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
  }

  async evaluateAnswer(
    question: string,
    answer: string,
    context?: CandidateContext
  ): Promise<EvaluationResult> {
    if (!this.client) throw new Error('Gemini not initialized.');

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    const contextPrompt = this.buildContextPrompt(context);

    const prompt = `You are an expert technical interviewer. Evaluate this interview answer objectively.

${contextPrompt}

QUESTION: "${question}"
CANDIDATE'S ANSWER: "${answer}"

Evaluate on these dimensions (0-100 each):
- technical_accuracy: Correctness of technical claims
- communication: Clarity and articulation
- clarity: Structure and coherence
- relevance: How well it addresses the question

Respond ONLY with valid JSON in this exact format:
{
  "score": <overall 0-100>,
  "feedback": "<2-3 sentence overall feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "technical_accuracy": <0-100>,
  "communication": <0-100>,
  "clarity": <0-100>,
  "relevance": <0-100>
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as EvaluationResult;
      }
    } catch {
      // fallback
    }

    return {
      score: 70,
      feedback: text,
      strengths: ['Answer provided'],
      improvements: ['Could be more structured'],
    };
  }

  async analyzeResume(text: string): Promise<string> {
    if (!this.client) throw new Error('Gemini not initialized.');

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
    });

    const prompt = `Analyze this resume and extract key information. Return a structured summary.

RESUME TEXT:
${text.substring(0, 4000)}

Extract and summarize:
1. Professional Summary (2-3 sentences)
2. Key Technical Skills (list)
3. Work Experience (company, role, key achievements)
4. Notable Projects (name, description, tech stack)
5. Education
6. Soft Skills inferred from experience

Return as a clean, structured summary suitable for interview coaching context.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async analyzeJobDescription(text: string): Promise<string> {
    if (!this.client) throw new Error('Gemini not initialized.');

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
    });

    const prompt = `Analyze this job description and extract key requirements.

JOB DESCRIPTION:
${text.substring(0, 3000)}

Return a structured JSON summary:
{
  "title": "<role title>",
  "company": "<company name if present>",
  "requiredSkills": ["<skill 1>", ...],
  "preferredSkills": ["<skill 1>", ...],
  "responsibilities": ["<key responsibility>", ...],
  "technologies": ["<tech>", ...],
  "seniority": "<junior/mid/senior/lead>",
  "keywords": ["<important keyword>", ...]
}`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async generateInterviewQuestions(context: string): Promise<string[]> {
    if (!this.client) throw new Error('Gemini not initialized.');

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
    });

    const prompt = `You are a technical interviewer. Generate 10 realistic interview questions for this candidate/role context.

${context}

Generate a mix of:
- 3 technical questions
- 2 system design questions  
- 2 behavioral questions (STAR format)
- 2 situational questions
- 1 role-specific question

Return ONLY a JSON array of question strings:
["Question 1?", "Question 2?", ...]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as string[];
      }
    } catch {
      // fallback
    }

    // Parse line by line
    return text
      .split('\n')
      .filter(line => line.trim() && line.includes('?'))
      .map(line => line.replace(/^[\d\-\.\*\s]+/, '').trim())
      .slice(0, 10);
  }

  async generateReport(
    qaRecords: Array<{ question: string; suggestedAnswer: string; userAnswer?: string; evaluation?: string; score?: number }>,
    context?: CandidateContext
  ): Promise<InterviewReport> {
    if (!this.client) throw new Error('Gemini not initialized.');

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
    });

    const contextPrompt = this.buildContextPrompt(context);
    const qaText = qaRecords.map((qa, i) =>
      `Q${i + 1}: ${qa.question}\nAnswer: ${qa.userAnswer || qa.suggestedAnswer}\nScore: ${qa.score || 'N/A'}`
    ).join('\n\n');

    const prompt = `Generate a comprehensive interview performance report.

CANDIDATE CONTEXT:
${contextPrompt}

INTERVIEW Q&A:
${qaText}

Return ONLY valid JSON matching this exact structure:
{
  "overallScore": <0-100>,
  "technicalKnowledge": <0-100>,
  "communication": <0-100>,
  "clarity": <0-100>,
  "confidence": <0-100>,
  "relevance": <0-100>,
  "problemSolving": <0-100>,
  "answerStructure": <0-100>,
  "strengths": ["<strength>", ...],
  "weaknesses": ["<weakness>", ...],
  "recommendations": ["<recommendation>", ...],
  "topicsToStudy": ["<topic>", ...]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as InterviewReport;
      }
    } catch {
      // fallback
    }

    return {
      overallScore: 70,
      technicalKnowledge: 70,
      communication: 70,
      clarity: 70,
      confidence: 70,
      relevance: 70,
      problemSolving: 70,
      answerStructure: 70,
      strengths: ['Completed the interview session'],
      weaknesses: ['Continue practicing'],
      recommendations: ['Review technical concepts', 'Practice STAR format answers'],
      topicsToStudy: ['System design', 'Data structures'],
    };
  }

  async generateFollowUp(question: string, answer: string, context?: CandidateContext): Promise<string> {
    if (!this.client) throw new Error('Gemini not initialized.');

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    });

    const prompt = `As a technical interviewer, generate a natural follow-up question based on this exchange.

ORIGINAL QUESTION: "${question}"
CANDIDATE'S ANSWER: "${answer}"

Generate ONE probing follow-up question that either:
- Digs deeper into a specific point they made
- Tests edge case knowledge
- Asks for a concrete example
- Challenges an assumption

Return only the follow-up question:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  detectQuestionType(text: string): QuestionType {
    const lower = text.toLowerCase();

    if (lower.includes('system design') || lower.includes('architecture') || lower.includes('scale')) {
      return 'system-design';
    }
    if (lower.includes('code') || lower.includes('implement') || lower.includes('write a function') || lower.includes('algorithm')) {
      return 'coding';
    }
    if (lower.includes('tell me about a time') || lower.includes('describe a situation') || lower.includes('give me an example')) {
      return 'behavioral';
    }
    if (lower.includes('salary') || lower.includes('why this company') || lower.includes('where do you see yourself') || lower.includes('strengths') || lower.includes('weaknesses')) {
      return 'hr';
    }
    if (lower.includes('how does') || lower.includes('explain') || lower.includes('what is') || lower.includes('difference between') || lower.includes('why would you use')) {
      return 'technical';
    }
    if (lower.includes('follow') || lower.includes('elaborate') || lower.includes('can you clarify')) {
      return 'follow-up';
    }
    return 'general';
  }

  detectIsQuestion(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.endsWith('?')) return true;
    const questionStarters = [
      'can you', 'could you', 'would you', 'how do', 'how did', 'how would',
      'tell me', 'describe', 'explain', 'what is', 'what are', 'why did',
      'have you', 'walk me through', 'give me an example',
    ];
    const lower = trimmed.toLowerCase();
    return questionStarters.some(s => lower.startsWith(s));
  }
}
