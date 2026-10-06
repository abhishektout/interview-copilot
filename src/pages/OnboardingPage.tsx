import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Key, CheckCircle, AlertCircle, ArrowRight, Shield, Cpu } from 'lucide-react';
import { useAppStore } from '../stores';
import { validateGeminiKey } from '../utils/geminiValidator';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { saveSettings, setGeminiConnected } = useAppStore();
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!apiKey.trim()) return;
    setIsValidating(true);
    setStatus('idle');
    setError('');

    try {
      const result = await validateGeminiKey(apiKey.trim());
      if (result.valid) {
        setStatus('valid');
        await saveSettings({ geminiApiKey: apiKey.trim() });
        setGeminiConnected(true);
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setStatus('invalid');
        setError(result.error || 'Invalid API key');
      }
    } catch (err) {
      setStatus('invalid');
      setError(err instanceof Error ? err.message : 'Connection failed. Check your internet connection.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.12) 0%, var(--bg-primary) 60%)',
      padding: 24,
    }}>
      <div style={{ maxWidth: 480, width: '100%', animation: 'fadeIn 0.5s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72,
            height: 72,
            background: 'linear-gradient(135deg, #818cf8, #4338ca)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 40px rgba(129, 140, 248, 0.3)',
          }}>
            <Sparkles size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: 8, color: 'var(--text-primary)' }}>
            Interview Copilot
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            AI-powered interview practice assistant
          </p>
        </div>

        {/* Main card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Key size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Connect Gemini</h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20, lineHeight: 1.7 }}>
            Use your own Gemini API key. <strong style={{ color: 'var(--text-primary)' }}>No subscription required.</strong>{' '}
            Your key is stored locally and never sent to any server.
          </p>

          <div className="input-group">
            <label className="input-label">Gemini API Key</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleValidate()}
                style={{
                  paddingRight: 44,
                  borderColor: status === 'valid' ? 'var(--success)'
                    : status === 'invalid' ? 'var(--error)'
                    : undefined,
                }}
              />
              {status === 'valid' && (
                <CheckCircle
                  size={18}
                  color="var(--success)"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
              )}
              {status === 'invalid' && (
                <AlertCircle
                  size={18}
                  color="var(--error)"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
              )}
            </div>
            {error && (
              <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{error}</p>
            )}
            {status === 'valid' && (
              <p style={{ color: 'var(--success)', fontSize: '0.8rem' }}>
                ✓ Gemini Connected! Redirecting...
              </p>
            )}
          </div>

          <button
            className="btn btn-primary w-full btn-lg"
            onClick={handleValidate}
            disabled={isValidating || !apiKey.trim() || status === 'valid'}
          >
            {isValidating ? (
              <>
                <div className="spinner" />
                Validating...
              </>
            ) : status === 'valid' ? (
              <>
                <CheckCircle size={18} />
                Connected
              </>
            ) : (
              <>
                Validate & Connect
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: Shield, label: 'Key stays local' },
            { icon: Cpu, label: 'BYOK model' },
            { icon: Sparkles, label: 'Gemini 2.0 Flash' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              <item.icon size={12} />
              {item.label}
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Get your API key at{' '}
          <span style={{ color: 'var(--accent-primary)' }}>
            aistudio.google.com
          </span>
        </p>
      </div>
    </div>
  );
}
