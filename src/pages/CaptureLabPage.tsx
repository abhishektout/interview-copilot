import React, { useState, useEffect, useRef } from 'react';
import { FlaskConical, Monitor, AppWindow, RefreshCw, Play, Square, Camera, Info } from 'lucide-react';

interface CaptureSource {
  id: string;
  name: string;
  thumbnailUrl: string;
  appIconUrl?: string;
  display_id?: string;
}

interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  rotation: number;
  primary: boolean;
}

export function CaptureLabPage() {
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null);
  const [activeTab, setActiveTab] = useState<'windows' | 'screens'>('screens');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadSources();
    loadDisplays();
  }, []);

  useEffect(() => {
    return () => {
      liveStream?.getTracks().forEach(t => t.stop());
    };
  }, [liveStream]);

  const loadSources = async () => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    try {
      const allSources = await window.electronAPI.capture.getSources(['window', 'screen']);
      setSources(allSources);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDisplays = async () => {
    if (!window.electronAPI) return;
    try {
      const d = await window.electronAPI.capture.getDisplays();
      setDisplays(d);
    } catch (err) {
      console.error('Failed to load displays:', err);
    }
  };

  const handleTakeScreenshot = async () => {
    if (!selectedSource || !window.electronAPI) return;
    const data = await window.electronAPI.capture.takeScreenshot(selectedSource.id);
    setScreenshot(data);
  };

  const handleStartCapture = async () => {
    if (!selectedSource) return;
    setIsCapturing(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-ignore - Electron-specific constraint
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSource.id,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080,
          },
        },
      });

      setLiveStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Capture failed:', err);
      setIsCapturing(false);
    }
  };

  const handleStopCapture = () => {
    liveStream?.getTracks().forEach(t => t.stop());
    setLiveStream(null);
    setIsCapturing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const windowSources = sources.filter(s => !s.id.startsWith('screen:'));
  const screenSources = sources.filter(s => s.id.startsWith('screen:'));
  const displayedSources = activeTab === 'windows' ? windowSources : screenSources;

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>Capture Testing Lab</h1>
              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Dev Tool</span>
            </div>
            <p className="page-subtitle">
              Understand how desktop window capture and recording APIs behave
            </p>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { loadSources(); loadDisplays(); }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Privacy notice */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: 'rgba(96, 165, 250, 0.05)',
        border: '1px solid rgba(96, 165, 250, 0.15)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 24,
        fontSize: '0.82rem',
        color: 'var(--text-muted)',
      }}>
        <Info size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong style={{ color: 'var(--info)' }}>Development / Testing Tool</strong>
          {' — '}
          This page is for understanding desktop capture APIs. Capture preview shows what different APIs can see.
          The AI overlay window has content protection enabled — it will NOT appear in screen capture.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Sources */}
        <div>
          <div className="section-header">
            <h3 className="section-title">Capture Sources</h3>
          </div>

          <div className="tabs" style={{ marginBottom: 16 }}>
            <button
              className={`tab ${activeTab === 'screens' ? 'active' : ''}`}
              onClick={() => setActiveTab('screens')}
            >
              <Monitor size={14} style={{ marginRight: 6 }} />
              Screens ({screenSources.length})
            </button>
            <button
              className={`tab ${activeTab === 'windows' ? 'active' : ''}`}
              onClick={() => setActiveTab('windows')}
            >
              <AppWindow size={14} style={{ marginRight: 6 }} />
              Windows ({windowSources.length})
            </button>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="capture-grid" style={{ maxHeight: 400, overflow: 'auto' }}>
              {displayedSources.map(source => (
                <div
                  key={source.id}
                  className={`capture-source-card ${selectedSource?.id === source.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedSource(source); setScreenshot(null); }}
                >
                  <img
                    src={source.thumbnailUrl}
                    alt={source.name}
                    className="capture-thumbnail"
                  />
                  <div className="capture-source-name" title={source.name}>
                    {source.name}
                  </div>
                </div>
              ))}
              {displayedSources.length === 0 && (
                <div style={{ gridColumn: '1/-1', color: 'var(--text-muted)', textAlign: 'center', padding: 30, fontSize: '0.85rem' }}>
                  No {activeTab} found
                </div>
              )}
            </div>
          )}

          {/* Display info */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Current Displays
            </h4>
            {displays.map(d => (
              <div key={d.id} style={{
                padding: '10px 14px',
                background: 'var(--bg-card)',
                border: `1px solid ${d.primary ? 'rgba(129, 140, 248, 0.3)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                marginBottom: 8,
                fontSize: '0.8rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>
                    {d.label || `Display ${d.id}`}
                  </span>
                  {d.primary && <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Primary</span>}
                </div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {d.bounds.width}×{d.bounds.height} @ {d.scaleFactor}x · {d.rotation}°
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Preview */}
        <div>
          <div className="section-header">
            <h3 className="section-title">Capture Preview</h3>
            {selectedSource && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleTakeScreenshot}>
                  <Camera size={14} /> Screenshot
                </button>
                {!isCapturing ? (
                  <button className="btn btn-primary btn-sm" onClick={handleStartCapture}>
                    <Play size={14} /> Live Capture
                  </button>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={handleStopCapture}>
                    <Square size={14} /> Stop
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Preview area */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            aspectRatio: '16/9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {isCapturing ? (
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                muted
              />
            ) : screenshot ? (
              <img
                src={screenshot}
                alt="Screenshot"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : selectedSource ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                <img
                  src={selectedSource.thumbnailUrl}
                  alt="Preview"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', marginBottom: 12, opacity: 0.7 }}
                />
                <p style={{ fontSize: '0.82rem' }}>
                  Click "Screenshot" or "Live Capture" to preview
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <FlaskConical size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ fontSize: '0.85rem' }}>Select a source to preview</p>
              </div>
            )}
          </div>

          {/* Selected source info */}
          {selectedSource && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedSource.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                ID: {selectedSource.id}
              </div>
            </div>
          )}

          {/* Overlay protection notice */}
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            background: 'rgba(52, 211, 153, 0.05)',
            border: '1px solid rgba(52, 211, 153, 0.15)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--success)' }}>✓ Overlay Protection Active</strong><br />
            The AI assistant overlay uses <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>setContentProtection(true)</code> to prevent it from appearing in screen captures and recordings.
          </div>
        </div>
      </div>
    </div>
  );
}
