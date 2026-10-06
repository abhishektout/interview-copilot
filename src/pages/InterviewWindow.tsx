import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Square, Play, Pause, Sparkles, Copy, Send,
  Timer, MessageSquare, Zap, Brain, AlertCircle, CheckCircle,
  RefreshCw, ChevronRight, EyeOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInterviewStore, useAppStore, useProfileStore, useSessionStore } from '../stores';

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

declare const webkitSpeechRecognition: new () => SpeechRecognitionInstance;
declare const SpeechRecognition: new () => SpeechRecognitionInstance;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function InterviewWindow() {
  const {
    isRunning, isPaused,
    transcript, currentQuestion, currentQuestionType,
    suggestedAnswer, isGenerating, streamingAnswer,
    elapsedSeconds,
    startInterview, pauseInterview, stopInterview,
    setTranscript, setCurrentQuestion, appendStreamChunk, finalizeStreamAnswer,
    setIsGenerating, addToHistory, incrementTimer, resetTimer,
  } = useInterviewStore();

  const { settings } = useAppStore();
  const { profile, resume, jobDescriptions } = useProfileStore();
  const { currentSession, endSession } = useSessionStore();

  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState('');
  const [manualQuestion, setManualQuestion] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'manual'>('live');
  const [copied, setCopied] = useState(false);
  const [displayAnswer, setDisplayAnswer] = useState('');
  /** True when the main process has detected a screen capture and hidden the overlay. */
  const [stealthMode, setStealthMode] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef('');

  // Timer
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(() => incrementTimer(), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, isPaused, incrementTimer]);

  // Streaming answer display
  useEffect(() => {
    setDisplayAnswer(streamingAnswer || suggestedAnswer);
  }, [streamingAnswer, suggestedAnswer]);

  // Setup IPC event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubChunk = window.electronAPI.gemini.onStreamChunk((chunk) => {
      appendStreamChunk(chunk);
    });
    const unsubEnd = window.electronAPI.gemini.onStreamEnd(() => {
      finalizeStreamAnswer();
    });
    const unsubError = window.electronAPI.gemini.onStreamError((error) => {
      setIsGenerating(false);
      console.error('Stream error:', error);
    });
    window.electronAPI.on('shortcut:generate', () => {
      if (currentQuestion) generateAnswer(currentQuestion);
    });
    window.electronAPI.on('screen-share:capture-started', () => setStealthMode(true));
    window.electronAPI.on('screen-share:capture-ended', () => setStealthMode(false));

    return () => {
      unsubChunk();
      unsubEnd();
      unsubError();
      if (window.electronAPI) {
        window.electronAPI.off('shortcut:generate');
        window.electronAPI.off('screen-share:capture-started');
        window.electronAPI.off('screen-share:capture-ended');
      }
    };
  }, [currentQuestion]);

  const buildContext = useCallback(() => {
    const ctx: Record<string, unknown> = {};
    if (profile) {
      ctx.profile = {
        name: profile.name,
        targetRole: profile.targetRole,
        experience: profile.experience,
        skills: profile.skills,
        projects: profile.projects,
      };
    }
    if (resume?.analysis) ctx.resumeSummary = resume.analysis;
    if (currentSession?.jobDescriptionId) {
      const jd = jobDescriptions.find(j => j.id === currentSession.jobDescriptionId);
      if (jd) ctx.jobDescription = jd.text.substring(0, 800);
    }
    if (transcriptRef.current) {
      ctx.recentTranscript = transcriptRef.current.slice(-500);
    }
    return ctx;
  }, [profile, resume, jobDescriptions, currentSession]);

  const navigate = useNavigate();

  const generateAnswer = useCallback(async (question: string) => {
    if (!question.trim() || isGenerating) return;

    if (!window.electronAPI) {
      // Browser preview mode: direct Gemini API call
      const key = settings?.geminiApiKey || (typeof localStorage !== 'undefined' && JSON.parse(localStorage.getItem('interview_copilot_settings') || '{}')?.geminiApiKey);
      if (!key) {
        appendStreamChunk('Please connect your Gemini API key in Settings.');
        finalizeStreamAnswer();
        return;
      }

      setIsGenerating(true);
      try {
        const prompt = `You are an expert technical interview coach.
Provide a high-quality interview answer for the following question for a candidate applying as ${profile?.targetRole || 'Software Engineer'}.
Candidate skills: ${profile?.skills?.join(', ') || 'Full stack'}.
Resume highlights: ${resume?.text?.substring(0, 1000) || 'Experienced developer'}.

Question: "${question}"
Answer style: ${settings?.answerStyle || 'STAR method (Situation, Task, Action, Result) with bullet points and speaking points'}.

Direct interview answer:`;

        const modelToUse = (settings?.geminiModel && !settings.geminiModel.includes('3.8')) ? settings.geminiModel : 'gemini-1.5-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        const data = await res.json();
        const ans = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer generated.';
        appendStreamChunk(ans);
        finalizeStreamAnswer();
        addToHistory({ question, answer: ans });
      } catch (err) {
        appendStreamChunk(`Error generating answer: ${err instanceof Error ? err.message : String(err)}`);
        finalizeStreamAnswer();
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    setIsGenerating(true);
    try {
      await window.electronAPI.gemini.generateAnswer({
        question,
        context: buildContext(),
        style: settings?.answerStyle || 'normal',
        sessionId: currentSession?.id || '',
      });
    } catch (err) {
      setIsGenerating(false);
      console.error('Generate error:', err);
    }
  }, [isGenerating, settings, currentSession, buildContext, setIsGenerating, appendStreamChunk, finalizeStreamAnswer, addToHistory, profile, resume]);

  // Speech recognition
  const startRecording = useCallback(() => {
    const SpeechRecognitionAPI = typeof SpeechRecognition !== 'undefined'
      ? SpeechRecognition
      : (typeof webkitSpeechRecognition !== 'undefined' ? webkitSpeechRecognition : null);

    if (!SpeechRecognitionAPI) {
      setMicError('Speech recognition not supported in this context. Use manual input.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings?.language || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = transcriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += text + ' ';
        } else {
          interimTranscript += text;
        }
      }

      transcriptRef.current = finalTranscript;
      setTranscript(finalTranscript + interimTranscript);

      // Question detection
      if (settings?.questionDetection !== false) {
        const lastSentence = finalTranscript.trim().split(/[.!?]/).pop()?.trim() || '';
        if (lastSentence.endsWith('?') || lastSentence.length > 20) {
          const isQ = lastSentence.endsWith('?') ||
            /^(can you|could you|tell me|explain|what|how|why|describe)/i.test(lastSentence);
          if (isQ && lastSentence !== currentQuestion) {
            setCurrentQuestion(lastSentence, 'general');
            if (settings?.autoGenerate) {
              generateAnswer(lastSentence);
            }
          }
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'not-allowed') {
        setMicError('Microphone permission denied. Please allow microphone access.');
      } else if (event.error === 'no-speech') {
        // Ignore - just no speech detected
      } else if (event.error === 'network') {
        setMicError('Speech-to-text service is unavailable on this Linux setup. Use the "Manual Input" tab or Ctrl+Shift+Space.');
      } else {
        setMicError(`Speech recognition: ${event.error}. Use "Manual Input" tab.`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Auto-restart if still supposed to be recording
      if (isRunning && !isPaused) {
        setTimeout(() => {
          if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch { /* already started */ }
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
      setMicError('');
    } catch (err) {
      setMicError(`Could not start recording: ${err}`);
    }
  }, [settings, currentQuestion, isRunning, isPaused, setTranscript, setCurrentQuestion, generateAnswer]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const handleStartSession = () => {
    startInterview();
    resetTimer();
    startRecording();
  };

  const handleStopSession = async () => {
    stopRecording();
    stopInterview();
    if (currentSession) {
      await endSession();
    }
  };

  const handleGenerateManual = () => {
    if (manualQuestion.trim()) {
      setCurrentQuestion(manualQuestion, 'general');
      generateAnswer(manualQuestion);
    }
  };

  const handleCopy = () => {
    const text = suggestedAnswer || streamingAnswer;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      height: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/dashboard')}
            style={{ fontSize: '0.82rem', padding: '4px 10px' }}
          >
            ← Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {currentSession?.title || 'Interview Session'}
            </span>
          </div>

          {isRunning && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              background: 'rgba(52, 211, 153, 0.1)',
              border: '1px solid rgba(52, 211, 153, 0.2)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--success)',
            }}>
              <div className="recording-dot" />
              LIVE · {formatTime(elapsedSeconds)}
            </div>
          )}

          {/* Stealth Mode Badge — visible only to YOU, not on the shared screen */}
          {stealthMode && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              background: 'rgba(129, 140, 248, 0.15)',
              border: '1px solid rgba(129, 140, 248, 0.35)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--accent-primary)',
              letterSpacing: '0.04em',
              animation: 'pulse-glow 2s ease-in-out infinite',
            }}>
              <EyeOff size={12} />
              STEALTH · Overlay hidden from interviewer
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.window.showOverlay();
              } else {
                alert('Stealth Overlay is available in the desktop app (npm run dev:electron).');
              }
            }}
            title="Open Screen-Share Protected Floating Assistant"
          >
            <Sparkles size={14} color="var(--accent-primary)" />
            Stealth Overlay ↗
          </button>
          {!isRunning ? (
            <button className="btn btn-success" onClick={handleStartSession}>
              <Play size={16} /> Start Session
            </button>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={pauseInterview}>
                {isPaused ? <Play size={15} /> : <Pause size={15} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleStopSession}>
                <Square size={15} /> End Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, overflow: 'hidden' }}>
        {/* Left: Transcript + Controls */}
        <div style={{
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            {[
              { id: 'live', label: 'Live Transcript', icon: Mic },
              { id: 'manual', label: 'Manual Input', icon: MessageSquare },
              { id: 'history', label: 'History', icon: Timer },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'live' | 'history' | 'manual')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  border: 'none',
                  background: activeTab === tab.id ? 'rgba(129, 140, 248, 0.08)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeTab === 'live' && (
              <>
                {/* Mic controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!isRunning || isPaused}
                    style={{ minWidth: 120 }}
                  >
                    {isRecording ? (
                      <><MicOff size={16} /> Stop Recording</>
                    ) : (
                      <><Mic size={16} /> Start Recording</>
                    )}
                  </button>
                  {isRecording && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', fontSize: '0.82rem' }}>
                      <div className="recording-dot" />
                      Listening...
                    </div>
                  )}
                </div>

                {micError && (
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    padding: '10px 14px',
                    background: 'rgba(248, 113, 113, 0.08)',
                    border: '1px solid rgba(248, 113, 113, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--error)',
                    fontSize: '0.82rem',
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    {micError}
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Live Transcript
                    </label>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setTranscript(''); transcriptRef.current = ''; }}>
                      Clear
                    </button>
                  </div>
                  <div className="transcript-box" style={{ minHeight: 120, maxHeight: 200, overflow: 'auto' }}>
                    {transcript || (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {isRunning ? 'Start recording to capture speech...' : 'Start the session first'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Detected question */}
                {currentQuestion && (
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                      Detected Question
                    </label>
                    <div style={{
                      padding: '12px 16px',
                      background: 'rgba(129, 140, 248, 0.06)',
                      border: '1px solid rgba(129, 140, 248, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.9rem',
                      lineHeight: 1.6,
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}>
                      <MessageSquare size={16} color="var(--accent-primary)" style={{ marginTop: 3, flexShrink: 0 }} />
                      <span style={{ userSelect: 'text' }}>{currentQuestion}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => generateAnswer(currentQuestion)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <><div className="spinner" /> Generating...</> : <><Zap size={14} /> Generate Answer</>}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Type or paste a question to generate an AI answer, even without microphone.
                </p>
                <div className="input-group">
                  <label className="input-label">Question</label>
                  <textarea
                    className="textarea"
                    value={manualQuestion}
                    onChange={e => setManualQuestion(e.target.value)}
                    placeholder="Type or paste interview question..."
                    rows={4}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleGenerateManual();
                      }
                    }}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateManual}
                  disabled={isGenerating || !manualQuestion.trim()}
                >
                  {isGenerating ? <><div className="spinner" /> Generating...</> : <><Send size={16} /> Generate Answer</>}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tip: Press Ctrl+Enter to generate
                </p>
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                {useInterviewStore.getState().qaHistory.length === 0 ? (
                  <div className="empty-state">
                    <Timer size={32} className="empty-state-icon" />
                    <p>No Q&A history yet</p>
                  </div>
                ) : (
                  useInterviewStore.getState().qaHistory.map((qa, i) => (
                    <div key={i} style={{
                      marginBottom: 12,
                      padding: '12px 14px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 6 }}>
                        Q: {qa.question}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {qa.answer.substring(0, 200)}...
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Answer */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <Brain size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>AI Suggested Answer</span>
            {isGenerating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)', fontSize: '0.8rem', marginLeft: 'auto' }}>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                Generating...
              </div>
            )}
          </div>

          <div style={{ flex: 1, padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Answer */}
            {displayAnswer ? (
              <div className="answer-box">
                {displayAnswer}
                {isGenerating && <span className="answer-cursor" />}
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 40,
              }}>
                <Sparkles size={40} style={{ opacity: 0.2 }} />
                <div style={{ fontSize: '0.9rem' }}>
                  {isRunning
                    ? 'AI will generate answers as questions are detected'
                    : 'Start a session to begin'}
                </div>
              </div>
            )}

            {/* Actions */}
            {displayAnswer && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                  {copied ? <CheckCircle size={14} color="var(--success)" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => generateAnswer(currentQuestion)}
                  disabled={isGenerating || !currentQuestion}
                >
                  <RefreshCw size={14} /> Regenerate
                </button>
              </div>
            )}

            {/* Keyboard shortcut hints */}
            <div style={{
              marginTop: 'auto',
              padding: '12px 14px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Ctrl+Shift+I', 'Toggle AI overlay'],
                  ['Ctrl+Shift+Space', 'Generate answer'],
                  ['Ctrl+Shift+H', 'Hide overlay'],
                ].map(([key, desc]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
                      {key}
                    </kbd>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
