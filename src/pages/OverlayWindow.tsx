import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Copy, RefreshCw, ChevronDown, ChevronUp, Minus, X,
  MessageSquare, Zap, Brain, CheckCircle, AlertCircle,
  Settings, ChevronRight, Type, Star,
} from 'lucide-react';

interface OverlayState {
  question: string;
  questionType: string;
  answer: string;
  streamingAnswer: string;
  isGenerating: boolean;
  error: string;
  isMinimized: boolean;
  fontSize: number;
}

export function OverlayWindow() {
  const [state, setState] = useState<OverlayState>({
    question: '',
    questionType: 'general',
    answer: '',
    streamingAnswer: '',
    isGenerating: false,
    error: '',
    isMinimized: false,
    fontSize: 14,
  });
  const [copied, setCopied] = useState(false);
  const [manualQ, setManualQ] = useState('');
  const [showManual, setShowManual] = useState(false);

  const displayAnswer = state.streamingAnswer || state.answer;

  // Listen to IPC events from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.on('overlay:answerReady', (data: unknown) => {
      const payload = data as { question: string; answer: string; questionType: string };
      setState(s => ({
        ...s,
        question: payload.question,
        questionType: payload.questionType,
        answer: payload.answer,
        streamingAnswer: '',
        isGenerating: false,
        error: '',
      }));
    });

    window.electronAPI.on('shortcut:copy', () => {
      const text = state.answer || state.streamingAnswer;
      if (text) {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });

    window.electronAPI.on('shortcut:regenerate', () => {
      if (state.question) handleRegenerate();
    });

    const unsubChunk = window.electronAPI.gemini.onStreamChunk((chunk) => {
      setState(s => ({
        ...s,
        streamingAnswer: s.streamingAnswer + chunk,
        isGenerating: true,
        answer: '',
      }));
    });

    const unsubEnd = window.electronAPI.gemini.onStreamEnd(() => {
      setState(s => ({
        ...s,
        answer: s.streamingAnswer,
        streamingAnswer: '',
        isGenerating: false,
      }));
    });

    const unsubError = window.electronAPI.gemini.onStreamError((error) => {
      setState(s => ({
        ...s,
        isGenerating: false,
        error: error,
      }));
    });

    return () => {
      unsubChunk();
      unsubEnd();
      unsubError();
      window.electronAPI?.off('overlay:answerReady');
      window.electronAPI?.off('shortcut:copy');
      window.electronAPI?.off('shortcut:regenerate');
    };
  }, [state.question, state.answer, state.streamingAnswer]);

  const handleCopy = () => {
    const text = displayAnswer;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    if (!state.question || state.isGenerating || !window.electronAPI) return;
    setState(s => ({ ...s, isGenerating: true, streamingAnswer: '', answer: '', error: '' }));
    try {
      const settings = await window.electronAPI.storage.getSettings();
      const profile = await window.electronAPI.storage.getProfile();
      const resume = await window.electronAPI.storage.getResume();
      const ctx: Record<string, unknown> = {};
      if (profile) ctx.profile = {
        name: profile.name,
        targetRole: profile.targetRole,
        experience: profile.experience,
        skills: profile.skills,
        projects: profile.projects,
      };
      if (resume?.analysis) ctx.resumeSummary = resume.analysis;

      await window.electronAPI.gemini.generateAnswer({
        question: state.question,
        context: ctx,
        style: settings.answerStyle || 'normal',
        sessionId: '',
      });
    } catch (err) {
      setState(s => ({ ...s, isGenerating: false, error: String(err) }));
    }
  };

  const handleManualGenerate = async () => {
    if (!manualQ.trim() || state.isGenerating || !window.electronAPI) return;
    setState(s => ({
      ...s,
      question: manualQ,
      isGenerating: true,
      streamingAnswer: '',
      answer: '',
      error: '',
    }));
    try {
      const settings = await window.electronAPI.storage.getSettings();
      const profile = await window.electronAPI.storage.getProfile();
      const ctx: Record<string, unknown> = {};
      if (profile) ctx.profile = {
        name: profile.name,
        targetRole: profile.targetRole,
        experience: profile.experience,
        skills: profile.skills,
        projects: profile.projects,
      };

      await window.electronAPI.gemini.generateAnswer({
        question: manualQ,
        context: ctx,
        style: settings.answerStyle || 'normal',
        sessionId: '',
      });
      setShowManual(false);
    } catch (err) {
      setState(s => ({ ...s, isGenerating: false, error: String(err) }));
    }
  };

  const getQuestionTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'technical': return { bg: 'rgba(96, 165, 250, 0.15)', color: 'var(--info)' };
      case 'behavioral': return { bg: 'rgba(52, 211, 153, 0.15)', color: 'var(--success)' };
      case 'system-design': return { bg: 'rgba(251, 191, 36, 0.15)', color: 'var(--warning)' };
      case 'coding': return { bg: 'rgba(248, 113, 113, 0.15)', color: 'var(--error)' };
      case 'hr': return { bg: 'rgba(129, 140, 248, 0.15)', color: 'var(--accent-primary)' };
      default: return { bg: 'rgba(96, 96, 160, 0.15)', color: 'var(--text-muted)' };
    }
  };

  return (
    <div className="overlay-window" style={{ fontSize: `${state.fontSize}px` }}>
      {/* Header */}
      <div className="overlay-header">
        <div className="overlay-title">
          <Sparkles size={14} />
          ✨ AI ASSISTANT
          {state.isGenerating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-primary)', fontSize: '0.7rem' }}>
              <div className="spinner" style={{ width: 10, height: 10 }} />
              Generating...
            </div>
          )}
        </div>
        <div className="overlay-controls">
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 22, height: 22, padding: 0, fontSize: '0.7rem' }}
            title="Snap to Top-Right corner"
            onClick={() => window.electronAPI?.window.snapOverlay('top-right')}
          >
            ↗
          </button>
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 22, height: 22, padding: 0, fontSize: '0.7rem' }}
            title="Snap to Bottom-Right corner"
            onClick={() => window.electronAPI?.window.snapOverlay('bottom-right')}
          >
            ↘
          </button>
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 24, height: 24, padding: 0 }}
            onClick={() => setState(s => ({ ...s, isMinimized: !s.isMinimized }))}
            title={state.isMinimized ? 'Expand' : 'Minimize'}
          >
            {state.isMinimized ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 24, height: 24, padding: 0 }}
            onClick={() => window.electronAPI?.window.hideOverlay()}
            title="Hide Overlay"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {!state.isMinimized && (
        <>
          {/* Body */}
          <div className="overlay-body">
            {/* Question */}
            {state.question && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                  }}>
                    Question
                  </span>
                  {state.questionType && state.questionType !== 'general' && (
                    <span style={{
                      ...getQuestionTypeBadgeColor(state.questionType),
                      padding: '1px 8px',
                      borderRadius: 999,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      {state.questionType.replace('-', ' ')}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  userSelect: 'text',
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {state.question}
                </div>
              </div>
            )}

            {/* Suggested Answer */}
            <div>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}>
                Suggested Answer
              </div>

              {state.error ? (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'rgba(248, 113, 113, 0.08)',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--error)',
                  fontSize: '0.8rem',
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{state.error}</span>
                </div>
              ) : state.isGenerating && !displayAnswer ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '20px',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                }}>
                  <div className="spinner" />
                  AI is generating...
                </div>
              ) : displayAnswer ? (
                <div style={{
                  fontSize: `${state.fontSize}px`,
                  lineHeight: 1.75,
                  color: 'var(--text-primary)',
                  userSelect: 'text',
                  whiteSpace: 'pre-wrap',
                }}>
                  {displayAnswer}
                  {state.isGenerating && <span className="answer-cursor" />}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  padding: '20px',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                  textAlign: 'center',
                }}>
                  <Brain size={24} style={{ opacity: 0.3 }} />
                  <span>Ready for your next question</span>
                  <span style={{ fontSize: '0.72rem' }}>Press Ctrl+Shift+Space to generate</span>
                </div>
              )}
            </div>

            {/* Manual input */}
            {showManual && (
              <div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    style={{ fontSize: '0.82rem', padding: '7px 10px' }}
                    value={manualQ}
                    onChange={e => setManualQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualGenerate()}
                    placeholder="Type or paste question..."
                    autoFocus
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleManualGenerate}
                    disabled={state.isGenerating || !manualQ.trim()}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {displayAnswer && (
            <div className="overlay-actions">
              <button className="btn btn-ghost btn-sm" onClick={handleCopy} style={{ fontSize: '0.75rem' }}>
                {copied ? <CheckCircle size={12} color="var(--success)" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleRegenerate}
                disabled={state.isGenerating}
                style={{ fontSize: '0.75rem' }}
              >
                <RefreshCw size={12} /> Regenerate
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowManual(s => !s)}
                style={{ fontSize: '0.75rem', marginLeft: 'auto' }}
              >
                <Type size={12} /> Manual
              </button>
            </div>
          )}

          {!displayAnswer && !state.isGenerating && (
            <div className="overlay-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowManual(s => !s)}
                style={{ fontSize: '0.75rem' }}
              >
                <Type size={12} /> {showManual ? 'Hide' : 'Type Question'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setState(s => ({ ...s, fontSize: Math.max(11, s.fontSize - 1) }))}
                style={{ fontSize: '0.75rem', marginLeft: 'auto' }}
              >A-</button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setState(s => ({ ...s, fontSize: Math.min(18, s.fontSize + 1) }))}
                style={{ fontSize: '0.75rem' }}
              >A+</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
