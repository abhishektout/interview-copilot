import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, User, FileText, Briefcase, Play, History,
  Settings, FlaskConical, Sparkles, Wifi, WifiOff,
} from 'lucide-react';
import { useAppStore } from '../../stores';

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/resume', icon: FileText, label: 'Resume' },
  { path: '/job-description', icon: Briefcase, label: 'Job Description' },
  { path: '/interview-setup', icon: Play, label: 'Interview Setup' },
  { path: '/history', icon: History, label: 'History' },
];

const BOTTOM_NAV = [
  { path: '/capture-lab', icon: FlaskConical, label: 'Capture Lab' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGeminiConnected } = useAppStore();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Sparkles size={18} color="#fff" />
          </div>
          <div>
            <div className="sidebar-logo-text">Interview AI</div>
            <div className="sidebar-logo-sub">Gemini Copilot</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}

          <div className="nav-section-label">Developer</div>
          {BOTTOM_NAV.map(item => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer status */}
        <div className="sidebar-footer">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            background: isGeminiConnected
              ? 'rgba(52, 211, 153, 0.08)'
              : 'rgba(248, 113, 113, 0.08)',
            border: `1px solid ${isGeminiConnected ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)'}`,
          }}>
            {isGeminiConnected
              ? <Wifi size={14} color="var(--success)" />
              : <WifiOff size={14} color="var(--error)" />
            }
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: isGeminiConnected ? 'var(--success)' : 'var(--error)',
            }}>
              {isGeminiConnected ? 'Gemini Connected' : 'No API Key'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
