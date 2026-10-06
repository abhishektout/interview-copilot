import React, { useEffect } from 'react';
import { useSessionStore } from '../stores';
import { History, Trash2, Trophy, Clock, BarChart2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export function HistoryPage() {
  const { sessions, loadSessions, deleteSession } = useSessionStore();

  useEffect(() => { loadSessions(); }, []);

  const completed = sessions.filter(s => s.status === 'completed');

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Practice History</h1>
        <p className="page-subtitle">{sessions.length} total sessions</p>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state card" style={{ padding: 60 }}>
          <History size={48} className="empty-state-icon" />
          <h3>No sessions yet</h3>
          <p style={{ fontSize: '0.875rem' }}>Start your first practice session to see results here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 800 }}>
          {sessions.map(session => (
            <div key={session.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: session.type === 'mock' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(129, 140, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {session.type === 'mock' ? <Trophy size={20} color="var(--success)" /> : <History size={20} color="var(--accent-primary)" />}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{session.title}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                  </span>
                  {session.duration && (
                    <span>{Math.floor(session.duration / 60)}m {session.duration % 60}s</span>
                  )}
                  <span className={`badge ${session.type === 'mock' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.65rem' }}>
                    {session.type}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {session.score != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: session.score >= 80 ? 'var(--success)' : session.score >= 60 ? 'var(--warning)' : 'var(--error)',
                    }}>
                      {session.score}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>score</div>
                  </div>
                )}
                <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                  {session.status}
                </span>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => deleteSession(session.id)}
                  style={{ opacity: 0.5 }}
                >
                  <Trash2 size={14} color="var(--error)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
