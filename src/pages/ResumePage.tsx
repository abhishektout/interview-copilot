import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, Loader, Trash2, Brain, AlertCircle, Edit3 } from 'lucide-react';
import { useProfileStore } from '../stores';
import { extractTextFromFile, analyzeResumeWithGemini } from '../utils/documentExtractor';

export function ResumePage() {
  const { resume, saveResume } = useProfileStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [analysisView, setAnalysisView] = useState<'raw' | 'analysis'>('analysis');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['pdf', 'docx', 'txt', 'md'];
    if (!validExts.includes(ext || '')) {
      setError('Supported formats: PDF, DOCX, TXT, MD');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.');
      return;
    }

    setError('');
    setIsProcessing(true);

    try {
      const extracted = await extractTextFromFile(file);
      const text = extracted.text;

      if (!text.trim()) {
        setError('Could not extract text from file. Please try pasting the text directly.');
        return;
      }

      // Use analysis from Gemini multimodal or run text analysis
      const analysis = extracted.analysis || (await analyzeResumeWithGemini(text));

      await saveResume({ fileName: file.name, text, analysis });
    } catch (err) {
      setError(`Failed to process file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBrowse = async () => {
    if (!window.electronAPI?.files) {
      fileInputRef.current?.click();
      return;
    }

    const result = await window.electronAPI.files.openFileDialog({
      filters: [
        { name: 'Resume Files', extensions: ['pdf', 'docx', 'txt', 'md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePaths[0]) {
      const filePath = result.filePaths[0];
      const ext = filePath.split('.').pop()?.toLowerCase();
      let text = '';
      setIsProcessing(true);
      setError('');
      try {
        if (ext === 'pdf') {
          const r = await window.electronAPI.files.readPDF(filePath);
          if (!r.success) throw new Error(r.error);
          text = r.text || '';
        } else if (ext === 'docx') {
          const r = await window.electronAPI.files.readDOCX(filePath);
          if (!r.success) throw new Error(r.error);
          text = r.text || '';
        }

        let analysis = '';
        try {
          analysis = await window.electronAPI.gemini.analyzeResume(text);
        } catch {
          analysis = 'Analysis completed. Resume stored.';
        }

        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'resume';
        await saveResume({ fileName, text, analysis });
      } catch (err) {
        setError(`Failed to process file: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSavePastedText = async () => {
    if (!pastedText.trim()) return;
    setIsProcessing(true);
    setError('');
    try {
      const analysis = await analyzeResumeWithGemini(pastedText.trim());
      await saveResume({
        fileName: 'Pasted Resume',
        text: pastedText.trim(),
        analysis,
      });
      setShowPasteModal(false);
      setPastedText('');
    } catch (err) {
      setError(`Failed to save resume: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Resume</h1>
        <p className="page-subtitle">Upload or paste your resume to personalize AI-generated answers</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      {!resume ? (
        /* Upload area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="card"
            style={{
              border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-xl)',
              background: isDragging ? 'rgba(129, 140, 248, 0.05)' : 'var(--bg-card)',
              padding: 48,
              textAlign: 'center',
              transition: 'all var(--transition-fast)',
              cursor: 'pointer',
            }}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileSelect(file);
            }}
            onClick={handleBrowse}
          >
            {isProcessing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 64,
                  height: 64,
                  border: '3px solid var(--bg-elevated)',
                  borderTopColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Processing Resume...</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Extracting text and analyzing with Gemini</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  width: 72,
                  height: 72,
                  background: 'rgba(129, 140, 248, 0.1)',
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Upload size={32} color="var(--accent-primary)" />
                </div>
                <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Drop your resume here</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.875rem' }}>
                  Supports PDF, DOCX, TXT, or MD files up to 10MB
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); handleBrowse(); }}>
                    <FileText size={16} />
                    Browse Files
                  </button>
                  <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); setShowPasteModal(true); }}>
                    <Edit3 size={16} />
                    Paste Text
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Paste modal */}
          {showPasteModal && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Paste Resume Text</h3>
              <textarea
                className="input"
                rows={8}
                placeholder="Paste the text of your resume here..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                style={{ width: '100%', marginBottom: 16, fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setShowPasteModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSavePastedText} disabled={!pastedText.trim() || isProcessing}>
                  Save Resume
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Resume loaded */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* File card */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'rgba(52, 211, 153, 0.1)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FileText size={24} color="#34d399" />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {resume.fileName}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Uploaded {new Date(resume.uploadedAt).toLocaleDateString()} · {resume.text.length.toLocaleString()} characters
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-ghost"
                onClick={() => saveResume({ fileName: '', text: '', analysis: '' })}
                style={{ color: '#f87171' }}
              >
                <Trash2 size={16} />
                Remove
              </button>
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-default)', paddingBottom: 12 }}>
            <button
              className={`btn btn-sm ${analysisView === 'analysis' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAnalysisView('analysis')}
            >
              <Brain size={14} />
              AI Analysis & Strengths
            </button>
            <button
              className={`btn btn-sm ${analysisView === 'raw' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAnalysisView('raw')}
            >
              <FileText size={14} />
              Extracted Text ({resume.text.length.toLocaleString()} chars)
            </button>
          </div>

          {/* Content */}
          {analysisView === 'analysis' ? (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain size={18} color="var(--accent-primary)" />
                Gemini Resume Analysis
              </h3>
              <div style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
              }}>
                {resume.analysis || 'Analysis is processing or unavailable. Your resume text is stored and ready for interview answers.'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 24 }}>
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                maxHeight: 400,
                overflowY: 'auto',
                lineHeight: 1.6,
              }}>
                {resume.text}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: '#f87171',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
