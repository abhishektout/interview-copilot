import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, BookOpen, FileText, Briefcase, TrendingUp,
  Zap, Clock, Target, AlertCircle, Sparkles, CheckCircle, Shield,
} from 'lucide-react';
import { useAppStore, useProfileStore, useSessionStore } from '../stores';
import { format, formatDistanceToNow } from 'date-fns';

export function DashboardPage() {
  const navigate = useNavigate();
  const { isGeminiConnected, settings } = useAppStore();
  const { profile, resume, jobDescriptions } = useProfileStore();
  const { sessions } = useSessionStore();

  // Compute stats
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((acc, s) => acc + (s.score || 0), 0) / completedSessions.length)
    : 0;

  const totalQuestions = completedSessions.length * 5; // approximate

  const quickActions = [
    {
      icon: Play,
      label: 'Start Practice',
      description: 'Quick AI-assisted practice session',
      color: 'var(--accent-primary)',
      bg: 'rgba(129, 140, 248, 0.1)',
      path: '/interview-setup',
    },
    {
      icon: BookOpen,
      label: 'Mock Interview',
      description: 'Full structured mock interview',
      color: 'var(--success)',
      bg: 'rgba(52, 211, 153, 0.1)',
      path: '/interview-setup',
    },
    {
      icon: FileText,
      label: 'Upload Resume',
      description: 'Parse and analyze your resume',
      color: 'var(--info)',
      bg: 'rgba(96, 165, 250, 0.1)',
      path: '/resume',
    },
    {
      icon: Briefcase,
      label: 'Add Job Description',
      description: 'Target a specific role',
      color: 'var(--warning)',
      bg: 'rgba(251, 191, 36, 0.1)',
      path: '/job-description',
    },
  ];

  return (
    <div className="page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">
              {profile ? `Welcome back, ${profile.name.split(' ')[0]}` : 'Interview Copilot'}
            </h1>
            <p className="page-subtitle">Ready for your next practice session?</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (window.electronAPI) {
                  window.electronAPI.window.showOverlay();
                } else {
                  alert('Desktop Stealth Overlay operates in Electron app. Run: npm run dev:electron');
                }
              }}
              title="Launch Screen-Share Invisible Overlay"
            >
              <Shield size={16} color="var(--accent-primary)" />
              Launch Stealth Overlay
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/interview-setup')}
            >
              <Play size={16} />
              Start Session
            </button>
          </div>
        </div>
      </div>

      {/* Stealth Mode Readiness Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)',
        border: '1px solid rgba(129, 140, 248, 0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Shield size={20} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Stealth Live Interview Copilot (Invisible on Screen Share)
              </h2>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Interviewer jab screen share karwayega (Zoom / Google Meet / Teams), to ye overlay box unko <strong>bilkul nahi dikhega</strong>. Top-right ya bottom-right me chhota box rahega aur interviewer ke question ka instant answer candidate ke Resume, Skills aur Job Description ke hisaab se live stream karega.
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.window.showOverlay();
              } else {
                alert('Stealth Overlay requires running the desktop app (npm run dev:electron).');
              }
            }}
          >
            <Sparkles size={16} />
            Open Floating Box (Top/Bottom-Right)
          </button>
        </div>

        {/* 4 Step Setup Checklist */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 18 }}>
          {/* Step 1: Gemini API Key */}
          <div
            onClick={() => navigate('/settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${isGeminiConnected ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
              cursor: 'pointer',
            }}
          >
            {isGeminiConnected ? (
              <CheckCircle size={18} color="var(--success)" />
            ) : (
              <AlertCircle size={18} color="var(--warning)" />
            )}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isGeminiConnected ? 'var(--success)' : 'var(--warning)' }}>
                1. Gemini API Key
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {isGeminiConnected ? 'Connected (gemini-1.5-flash)' : 'Click to enter API key'}
              </div>
            </div>
          </div>

          {/* Step 2: Resume Upload */}
          <div
            onClick={() => navigate('/resume')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${resume ? 'rgba(52, 211, 153, 0.3)' : 'rgba(96, 165, 250, 0.3)'}`,
              cursor: 'pointer',
            }}
          >
            {resume ? (
              <CheckCircle size={18} color="var(--success)" />
            ) : (
              <FileText size={18} color="var(--info)" />
            )}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: resume ? 'var(--success)' : 'var(--text-primary)' }}>
                2. Resume Upload
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {resume ? resume.fileName || 'Resume parsed' : 'Click to upload PDF/DOCX'}
              </div>
            </div>
          </div>

          {/* Step 3: Skills & Profile */}
          <div
            onClick={() => navigate('/profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${profile?.skills?.length ? 'rgba(52, 211, 153, 0.3)' : 'rgba(129, 140, 248, 0.3)'}`,
              cursor: 'pointer',
            }}
          >
            {profile?.skills?.length ? (
              <CheckCircle size={18} color="var(--success)" />
            ) : (
              <Sparkles size={18} color="var(--accent-primary)" />
            )}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: profile?.skills?.length ? 'var(--success)' : 'var(--text-primary)' }}>
                3. Skills & Experience
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {profile?.skills?.length ? `${profile.skills.length} skills added` : 'Click to set role & skills'}
              </div>
            </div>
          </div>

          {/* Step 4: Job Description */}
          <div
            onClick={() => navigate('/job-description')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${jobDescriptions.length ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
              cursor: 'pointer',
            }}
          >
            {jobDescriptions.length ? (
              <CheckCircle size={18} color="var(--success)" />
            ) : (
              <Briefcase size={18} color="var(--warning)" />
            )}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: jobDescriptions.length ? 'var(--success)' : 'var(--text-primary)' }}>
                4. Job Description
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {jobDescriptions.length ? `${jobDescriptions.length} target JD saved` : 'Optional: paste target JD'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        {[
          { label: 'Sessions', value: completedSessions.length, icon: Target, color: 'var(--accent-primary)' },
          { label: 'Avg Score', value: avgScore > 0 ? `${avgScore}%` : '—', icon: TrendingUp, color: 'var(--success)' },
          { label: 'Questions', value: totalQuestions || '—', icon: Zap, color: 'var(--info)' },
          { label: 'JD\'s Saved', value: jobDescriptions.length, icon: Briefcase, color: 'var(--warning)' },
        ].map(stat => (
          <div key={stat.label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="stat-label">{stat.label}</span>
              <stat.icon size={16} color={stat.color} />
            </div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Quick Actions */}
        <div>
          <div className="section-header">
            <h3 className="section-title">Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)',
                  width: '100%',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = action.color;
                  (e.currentTarget as HTMLElement).style.background = action.bg;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
                }}
              >
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: action.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <action.icon size={18} color={action.color} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 2 }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {action.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <div className="section-header">
            <h3 className="section-title">Recent Sessions</h3>
            {sessions.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
                View all
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state" style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
              <Clock size={32} className="empty-state-icon" />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No sessions yet. Start your first practice!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.slice(0, 4).map(session => (
                <div
                  key={session.id}
                  className="card"
                  style={{ padding: '12px 16px', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                  onClick={() => {
                    useSessionStore.getState().setCurrentSession(session);
                    navigate('/interview');
                  }}
                  title="Click to open this practice session"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 3 }}>
                        {session.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {session.score != null && (
                        <div style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: session.score >= 80 ? 'var(--success)' : session.score >= 60 ? 'var(--warning)' : 'var(--error)',
                        }}>
                          {session.score}%
                        </div>
                      )}
                      <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`}
                        style={{ fontSize: '0.65rem' }}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overlay tip */}
      {isGeminiConnected && (
        <div style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'rgba(129, 140, 248, 0.05)',
          border: '1px solid rgba(129, 140, 248, 0.12)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}>
          <Sparkles size={15} color="var(--accent-primary)" />
          <span>
            Press <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>Ctrl+Shift+I</kbd> to toggle the AI overlay anytime
          </span>
        </div>
      )}
    </div>
  );
}
