import React, { useState, useEffect } from 'react';
import {
  Key, Brain, Mic, Layers, Shield, Trash2,
  CheckCircle, AlertCircle, Eye, EyeOff, Save, Download,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../stores';
import type { AppSettings } from '../types/electron';
import { validateGeminiKey } from '../utils/geminiValidator';

type TabId = 'gemini' | 'interview' | 'audio' | 'overlay' | 'privacy';

export function SettingsPage() {
  const { settings, saveSettings, setGeminiConnected, isGeminiConnected } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState('');
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setApiKey(settings.geminiApiKey ? '••••••••••••••••••••' : '');
    }
  }, [settings]);

  const handleValidateKey = async () => {
    const realKey = apiKey.startsWith('•') ? (settings?.geminiApiKey || '') : apiKey;
    if (!realKey.trim()) return;
    setIsValidating(true);
    setValidationStatus('idle');
    setValidationError('');
    try {
      const result = await validateGeminiKey(realKey.trim());
      if (result.valid) {
        setValidationStatus('valid');
        const chosenModel = result.model || localSettings.geminiModel || 'gemini-1.5-flash';
        await saveSettings({
          geminiApiKey: realKey.trim(),
          geminiModel: chosenModel,
        });
        setLocalSettings(s => ({ ...s, geminiApiKey: realKey.trim(), geminiModel: chosenModel }));
        setGeminiConnected(true);
      } else {
        setValidationStatus('invalid');
        setValidationError(result.error || 'Invalid API key');
      }
    } catch (err) {
      setValidationStatus('invalid');
      setValidationError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisconnect = async () => {
    await saveSettings({ geminiApiKey: undefined });
    setGeminiConnected(false);
    setApiKey('');
    setValidationStatus('idle');
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await saveSettings(localSettings);
      if (localSettings.alwaysOnTop !== undefined && window.electronAPI) {
        await window.electronAPI.window.setOverlayAlwaysOnTop(!!localSettings.alwaysOnTop);
      }
      if (localSettings.overlayOpacity !== undefined && window.electronAPI) {
        await window.electronAPI.window.setOverlayOpacity(localSettings.overlayOpacity as number);
      }
      if (localSettings.contentProtection !== undefined && window.electronAPI) {
        await window.electronAPI.window.setOverlayContentProtection(!!localSettings.contentProtection);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    const data = await window.electronAPI.storage.exportData();
    const result = await window.electronAPI.files.saveFileDialog({
      defaultPath: `interview-copilot-export-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      await window.electronAPI.files.writeFile(result.filePath, data);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('This will delete all local data including sessions and profile. Continue?')) {
      await window.electronAPI.storage.clearAllData();
      window.location.reload();
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
    { id: 'gemini', label: 'Gemini', icon: Brain },
    { id: 'interview', label: 'Interview', icon: Key },
    { id: 'audio', label: 'Audio', icon: Mic },
    { id: 'overlay', label: 'Overlay', icon: Layers },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ];

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your interview copilot</p>
      </div>

      <div style={{ display: 'flex', gap: 24, maxWidth: 880 }}>
        {/* Tab sidebar */}
        <div style={{
          width: 160,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {activeTab === 'gemini' && (
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Gemini API Configuration</h3>

              {/* Connection status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: isGeminiConnected ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                border: `1px solid ${isGeminiConnected ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`,
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
              }}>
                {isGeminiConnected
                  ? <CheckCircle size={18} color="var(--success)" />
                  : <AlertCircle size={18} color="var(--error)" />
                }
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isGeminiConnected ? 'var(--success)' : 'var(--error)' }}>
                  {isGeminiConnected ? 'Gemini Connected' : 'Not Connected'}
                </span>
              </div>

              <div className="input-group">
                <label className="input-label">API Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      className="input"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="AIza..."
                      style={{
                        paddingRight: 44,
                        borderColor: validationStatus === 'valid' ? 'var(--success)'
                          : validationStatus === 'invalid' ? 'var(--error)'
                          : undefined,
                      }}
                    />
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => setShowKey(s => !s)}
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}
                    >
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleValidateKey}
                    disabled={isValidating || !apiKey.trim()}
                  >
                    {isValidating ? <div className="spinner" /> : 'Validate'}
                  </button>
                </div>
                {validationError && <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{validationError}</p>}
              </div>

              {isGeminiConnected && (
                <button className="btn btn-danger btn-sm" onClick={handleDisconnect}>
                  Disconnect Gemini
                </button>
              )}

              <div className="divider" />

              <div className="input-group">
                <label className="input-label">Model</label>
                <select
                  className="select"
                  value={localSettings.geminiModel || 'gemini-1.5-flash'}
                  onChange={e => setLocalSettings(s => ({ ...s, geminiModel: e.target.value }))}
                >
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Recommended)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Temperature: {localSettings.temperature ?? 0.7}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localSettings.temperature ?? 0.7}
                  onChange={e => setLocalSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Precise</span><span>Creative</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interview' && (
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Interview Settings</h3>

              <div className="input-group">
                <label className="input-label">Default Answer Style</label>
                <select
                  className="select"
                  value={localSettings.answerStyle || 'normal'}
                  onChange={e => setLocalSettings(s => ({ ...s, answerStyle: e.target.value }))}
                >
                  <option value="concise">Concise (20-40s)</option>
                  <option value="normal">Normal (45-90s)</option>
                  <option value="technical">Technical</option>
                  <option value="star">STAR Format</option>
                  <option value="natural">Natural</option>
                </select>
              </div>

              {[
                { key: 'autoGenerate', label: 'Auto-generate answers', desc: 'Automatically generate answers when a question is detected' },
                { key: 'questionDetection', label: 'Question detection', desc: 'Automatically detect interview questions from transcript' },
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!(localSettings as Record<string, unknown>)[item.key]}
                      onChange={e => setLocalSettings(s => ({ ...s, [item.key]: e.target.checked }))}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Audio Settings</h3>
              <div className="input-group">
                <label className="input-label">Speech Recognition Language</label>
                <select
                  className="select"
                  value={localSettings.language || 'en-US'}
                  onChange={e => setLocalSettings(s => ({ ...s, language: e.target.value }))}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="zh-CN">Chinese (Simplified)</option>
                </select>
              </div>
              <div style={{ padding: '14px', background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.15)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Speech recognition uses the browser's Web Speech API built into Electron. Microphone permission will be requested when you start recording.
              </div>
            </div>
          )}

          {activeTab === 'overlay' && (
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>AI Overlay Settings</h3>

              <div className="input-group">
                <label className="input-label">Opacity: {Math.round((localSettings.overlayOpacity ?? 0.95) * 100)}%</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={localSettings.overlayOpacity ?? 0.95}
                  onChange={e => setLocalSettings(s => ({ ...s, overlayOpacity: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Font Size: {localSettings.overlayFontSize ?? 14}px</label>
                <input
                  type="range"
                  min="11"
                  max="18"
                  step="1"
                  value={localSettings.overlayFontSize ?? 14}
                  onChange={e => setLocalSettings(s => ({ ...s, overlayFontSize: parseInt(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              {[
                { key: 'alwaysOnTop', label: 'Always on top', desc: 'Keep overlay above all other windows' },
                { key: 'contentProtection', label: 'Screen capture protection', desc: 'Hide overlay from screen recording and sharing (invisible to others in screen share)' },
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!(localSettings as Record<string, unknown>)[item.key]}
                      onChange={e => setLocalSettings(s => ({ ...s, [item.key]: e.target.checked }))}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Privacy & Data</h3>
              <div style={{
                padding: '14px 16px',
                background: 'rgba(52, 211, 153, 0.05)',
                border: '1px solid rgba(52, 211, 153, 0.15)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}>
                <strong style={{ color: 'var(--success)' }}>✓ Privacy-first architecture</strong><br />
                All data stays on your device. Your resume, API key, and session data are never sent to any third-party server. The only external connection is to Google's Gemini API using your own key.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn btn-secondary" onClick={handleExport} style={{ justifyContent: 'flex-start' }}>
                  <Download size={16} />
                  Export All Data
                </button>
                <button className="btn btn-danger" onClick={handleClearData} style={{ justifyContent: 'flex-start' }}>
                  <Trash2 size={16} />
                  Clear All Local Data
                </button>
              </div>
            </div>
          )}

          {/* Save button */}
          {activeTab !== 'privacy' && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? <><div className="spinner" /> Saving...</>
                  : saved ? <><CheckCircle size={16} /> Saved!</>
                  : <><Save size={16} /> Save Settings</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
