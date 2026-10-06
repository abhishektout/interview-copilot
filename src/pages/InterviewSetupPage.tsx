import React, { useState } from 'react';
import { Play, Settings2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore, useSessionStore, useAppStore } from '../stores';

export function InterviewSetupPage() {
  const navigate = useNavigate();
  const { profile, resume, jobDescriptions } = useProfileStore();
  const { createSession } = useSessionStore();
  const { isGeminiConnected } = useAppStore();

  const [config, setConfig] = useState({
    type: 'practice' as 'practice' | 'mock',
    title: '',
    selectedJD: '',
    answerStyle: profile?.preferredStyle || 'normal',
    duration: 30,
    autoGenerate: true,
  });

  const handleStart = async () => {
    if (!isGeminiConnected) return;

    const session = await createSession({
      title: config.title || `${config.type === 'mock' ? 'Mock Interview' : 'Practice Session'} - ${new Date().toLocaleDateString()}`,
      type: config.type,
      status: 'active',
      jobDescriptionId: config.selectedJD || undefined,
      profileId: profile?.id,
    });

    if (session && window.electronAPI) {
      window.electronAPI.window.openInterview();
      window.electronAPI.window.toggleOverlay();
    }
    navigate('/interview');
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Interview Setup</h1>
        <p className="page-subtitle">Configure your practice session</p>
      </div>

      {!isGeminiConnected && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          background: 'rgba(248, 113, 113, 0.08)',
          border: '1px solid rgba(248, 113, 113, 0.2)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 24,
          color: 'var(--error)',
          fontSize: '0.875rem',
        }}>
          <AlertCircle size={18} />
          Gemini API key required. Configure in Settings.
        </div>
      )}

      <div style={{ maxWidth: 640 }}>
        {/* Session type */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Session Type</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              {
                type: 'practice' as const,
                label: 'Practice Session',
                desc: 'AI suggests answers as you go. Type or speak questions.',
                color: 'var(--accent-primary)',
                bg: 'rgba(129, 140, 248, 0.1)',
              },
              {
                type: 'mock' as const,
                label: 'Mock Interview',
                desc: 'Structured full interview. AI asks questions and evaluates.',
                color: 'var(--success)',
                bg: 'rgba(52, 211, 153, 0.1)',
              },
            ].map(option => (
              <button
                key={option.type}
                onClick={() => setConfig(c => ({ ...c, type: option.type }))}
                style={{
                  padding: '16px',
                  textAlign: 'left',
                  background: config.type === option.type ? option.bg : 'var(--bg-tertiary)',
                  border: `1px solid ${config.type === option.type ? option.color : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: config.type === option.type ? option.color : 'var(--text-primary)', marginBottom: 6 }}>
                  {option.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {option.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Settings2 size={18} color="var(--accent-primary)" />
            <h3>Configuration</h3>
          </div>

          <div className="input-group">
            <label className="input-label">Session Title (optional)</label>
            <input
              className="input"
              value={config.title}
              onChange={e => setConfig(c => ({ ...c, title: e.target.value }))}
              placeholder="e.g., Google SWE Practice #1"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Job Description</label>
              <select
                className="select"
                value={config.selectedJD}
                onChange={e => setConfig(c => ({ ...c, selectedJD: e.target.value }))}
              >
                <option value="">General (no JD)</option>
                {jobDescriptions.map(jd => (
                  <option key={jd.id} value={jd.id}>
                    {jd.title} {jd.company ? `@ ${jd.company}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Answer Style</label>
              <select
                className="select"
                value={config.answerStyle}
                onChange={e => setConfig(c => ({ ...c, answerStyle: e.target.value }))}
              >
                <option value="concise">Concise (20-40s)</option>
                <option value="normal">Normal (45-90s)</option>
                <option value="technical">Technical</option>
                <option value="star">STAR Format</option>
                <option value="natural">Natural</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Auto-generate answers</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Automatically detect questions and generate answers
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config.autoGenerate}
                onChange={e => setConfig(c => ({ ...c, autoGenerate: e.target.checked }))}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Context summary */}
        {profile && (
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 20,
          }}>
            {[
              { label: 'Profile', value: profile.name, ok: true },
              { label: 'Resume', value: resume ? 'Loaded' : 'Missing', ok: !!resume },
              { label: 'JD', value: config.selectedJD ? 'Selected' : 'None (general)', ok: true },
            ].map(item => (
              <div key={item.label} style={{
                flex: 1,
                padding: '10px 14px',
                background: item.ok ? 'rgba(52, 211, 153, 0.05)' : 'rgba(251, 191, 36, 0.05)',
                border: `1px solid ${item.ok ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
              }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontWeight: 600, color: item.ok ? 'var(--success)' : 'var(--warning)' }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary btn-lg w-full"
          onClick={handleStart}
          disabled={!isGeminiConnected}
          style={{ justifyContent: 'center' }}
        >
          <Play size={20} />
          {config.type === 'mock' ? 'Start Mock Interview' : 'Start Practice Session'}
        </button>
      </div>
    </div>
  );
}
