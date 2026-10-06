import React, { useState } from 'react';
import { Briefcase, Plus, Trash2, Brain, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useProfileStore } from '../stores';
import { formatDistanceToNow } from 'date-fns';

export function JobDescriptionPage() {
  const { jobDescriptions, addJobDescription, deleteJobDescription } = useProfileStore();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [form, setForm] = useState({ title: '', company: '', text: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!form.text.trim()) return;
    setIsProcessing(true);
    setError('');
    try {
      let analysis = '';
      try {
        analysis = await window.electronAPI.gemini.analyzeJobDescription(form.text);
      } catch {
        analysis = 'Analysis unavailable (configure Gemini API key)';
      }
      await addJobDescription({ ...form, analysis });
      setForm({ title: '', company: '', text: '' });
      setMode('list');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadJD = async () => {
    const result = await window.electronAPI.files.openFileDialog({
      filters: [
        { name: 'Text Files', extensions: ['txt', 'pdf', 'docx'] },
      ],
    });
    if (!result.canceled && result.filePaths[0]) {
      const filePath = result.filePaths[0];
      const ext = filePath.split('.').pop()?.toLowerCase();
      let text = '';
      try {
        if (ext === 'pdf') {
          const r = await window.electronAPI.files.readPDF(filePath);
          text = r.text || '';
        } else if (ext === 'docx') {
          const r = await window.electronAPI.files.readDOCX(filePath);
          text = r.text || '';
        }
        setForm(f => ({ ...f, text }));
        setMode('add');
      } catch (err) {
        setError(String(err));
      }
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Job Descriptions</h1>
            <p className="page-subtitle">Add JDs to get role-specific interview answers</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {mode === 'list' && (
              <>
                <button className="btn btn-secondary" onClick={handleUploadJD}>
                  Upload JD
                </button>
                <button className="btn btn-primary" onClick={() => setMode('add')}>
                  <Plus size={16} />
                  Add JD
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {mode === 'add' ? (
        <div style={{ maxWidth: 680 }}>
          <div className="card">
            <h3 style={{ marginBottom: 20 }}>Add Job Description</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="input-group">
                <label className="input-label">Job Title</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Senior Software Engineer"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Company</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Corp"
                />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Job Description Text</label>
              <textarea
                className="textarea"
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                placeholder="Paste the full job description here..."
                rows={12}
              />
            </div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)', fontSize: '0.85rem', marginBottom: 12 }}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleAdd} disabled={isProcessing || !form.text.trim()}>
                {isProcessing ? <><div className="spinner" /> Analyzing...</> : <><Brain size={16} /> Analyze & Save</>}
              </button>
              <button className="btn btn-ghost" onClick={() => setMode('list')}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {jobDescriptions.length === 0 ? (
            <div className="empty-state card">
              <Briefcase size={40} className="empty-state-icon" />
              <h3>No job descriptions yet</h3>
              <p style={{ fontSize: '0.875rem' }}>Add a JD to get targeted interview preparation</p>
              <button className="btn btn-primary" onClick={() => setMode('add')}>
                <Plus size={16} /> Add Job Description
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
              {jobDescriptions.map(jd => (
                <div key={jd.id} className="card">
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === jd.id ? null : jd.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <Briefcase size={16} color="var(--warning)" />
                        <span style={{ fontWeight: 600 }}>{jd.title || 'Untitled Role'}</span>
                        {jd.company && (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{jd.company}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Added {formatDistanceToNow(new Date(jd.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={e => { e.stopPropagation(); deleteJobDescription(jd.id); }}
                      >
                        <Trash2 size={15} color="var(--error)" />
                      </button>
                      {expanded === jd.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  {expanded === jd.id && jd.analysis && (
                    <div style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: '1px solid var(--border-subtle)',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      userSelect: 'text',
                    }}>
                      {jd.analysis}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
