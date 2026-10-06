import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ResumePage } from './pages/ResumePage';
import { JobDescriptionPage } from './pages/JobDescriptionPage';
import { InterviewSetupPage } from './pages/InterviewSetupPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { CaptureLabPage } from './pages/CaptureLabPage';
import { InterviewWindow } from './pages/InterviewWindow';
import { OverlayWindow } from './pages/OverlayWindow';
import { OnboardingPage } from './pages/OnboardingPage';
import { useProfileStore } from './stores';
import './index.css';

function AppRouter() {
  return (
    <Routes>
      <Route path="/overlay" element={<OverlayWindow />} />
      <Route path="/interview" element={<InterviewWindow />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="job-description" element={<JobDescriptionPage />} />
        <Route path="interview-setup" element={<InterviewSetupPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="capture-lab" element={<CaptureLabPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  const { setSettings, setGeminiConnected, setInitialized, isInitialized } = useAppStore();
  const { loadAll } = useProfileStore();

  useEffect(() => {
    async function initialize() {
      try {
        if (!window.electronAPI) {
          // Running in browser (dev/test): load from localStorage
          const stored = localStorage.getItem('interview_copilot_settings');
          if (stored) {
            try {
              const settings = JSON.parse(stored);
              setSettings(settings);
              setGeminiConnected(!!settings.geminiApiKey);
            } catch {}
          }
          await loadAll();
          return;
        }

        const settings = await window.electronAPI.storage.getSettings();
        setSettings(settings);
        setGeminiConnected(!!settings.geminiApiKey);
        await loadAll();
      } catch (err) {
        console.error('Failed to initialize app:', err);
      } finally {
        setInitialized(true);
      }
    }

    initialize();
  }, [setSettings, setGeminiConnected, setInitialized, loadAll]);

  if (!isInitialized) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            background: 'linear-gradient(135deg, #818cf8, #4338ca)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 1.5s infinite',
          }}>
            <span style={{ fontSize: 24 }}>✨</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading Gemini Interview Copilot...</div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <AppRouter />
    </HashRouter>
  );
}

export default App;
