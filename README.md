# 🎙️ Gemini Interview Copilot

> Production-Grade Desktop AI Interview Practice Assistant with Always-On-Top Overlay, Live Speech Recognition, Question Classification, and Gemini BYOK Integration.

---

## ✨ Features

- 🔑 **Bring Your Own Key (BYOK)**: Secure local storage with zero server dependency. Connect your Google Gemini API key directly.
- 👤 **Candidate Profile Management**: Configure your target role, years of experience, core technical skills, key projects, and preferred answer style.
- 📄 **Resume Parser & AI Analyzer**: Support for PDF and DOCX resume extraction. Gemini automatically analyzes strengths, identifies key talking points, and highlights areas for improvement.
- 💼 **Job Description Alignment**: Upload or paste job descriptions to get role keyword matching, question predictions, and tailored interview advice.
- 🎙️ **Live Audio & Speech-to-Text**: Real-time microphone capture via Web Audio API with visual audio level meter and speech recognition.
- 🧠 **Intelligent Question Detection**: Heuristic and pattern-matching detection of interview questions with automatic categorization (`system-design`, `coding`, `behavioral`, `hr`, `technical`, `follow-up`).
- ⚡ **Real-Time Streaming Answers**: Gemini 2.0 Flash / 1.5 Pro integration with live token streaming and tailored framework modes (STAR method, concise, technical depth, natural conversational).
- 🪟 **Always-on-Top Floating AI Overlay**: Transparent, draggable, minimal desktop overlay with screen capture protection (`setContentProtection(true)`) to stay hidden from meeting apps.
- 💾 **Local SQLite Storage**: Complete offline persistence using `better-sqlite3` with foreign keys and WAL mode for practice history, transcripts, scores, and feedback.
- 📊 **Performance Reports**: Automated Gemini post-interview evaluation report with scores across clarity, relevance, STAR usage, technical depth, and specific actionable recommendations.
- 🧪 **Desktop Capture Lab**: Built-in developer diagnostic lab to inspect screen and window sources via Electron `desktopCapturer`.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Desktop Shell** | Electron 33, Node.js 20+ |
| **Frontend UI** | React 18, TypeScript, Tailwind CSS / Custom Glassmorphism tokens, Lucide Icons |
| **State Management** | Zustand (Global App, Profile, Session, Interview stores) |
| **AI Integration** | Google Generative AI SDK (`@google/generative-ai`), Gemini 2.0 Flash, Gemini 1.5 Pro |
| **Local Database** | `better-sqlite3` (SQLite with WAL mode) |
| **Build & Tooling** | Vite 5, `vite-plugin-electron`, Vitest, Electron Builder |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+
- npm or pnpm
- A Google Gemini API key ([Get one free at Google AI Studio](https://aistudio.google.com/))

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd interview-copilot

# Install dependencies
npm install
```

### Running Locally

```bash
# Start Vite development server + Electron desktop app
npm run dev:electron
```

Or run frontend-only preview in browser:
```bash
npm run dev
```

---

## 🧪 Testing & Verification

```bash
# Run all unit and integration tests
npm run test

# Run TypeScript typecheck
npm run typecheck

# Build for production
npm run build
```

---

## ⌨️ Global Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+I` (or `Cmd+Shift+I`) | Toggle Floating AI Overlay |
| `Ctrl+Shift+Space` | Trigger AI Answer for Current Question |
| `Ctrl+Shift+H` | Hide AI Overlay Immediately |
| `Ctrl+Shift+C` | Copy Suggested Answer to Clipboard |
| `Ctrl+Shift+R` | Regenerate Current Answer |

---

## 📂 Project Architecture

```
interview-copilot/
├── electron/
│   ├── ai/
│   │   └── geminiService.ts         # Gemini SDK client, prompt builder, evaluation engine
│   ├── main/
│   │   ├── index.ts                 # Electron main lifecycle & IPC registration
│   │   ├── shortcutManager.ts       # Global keyboard shortcuts
│   │   └── windowManager.ts         # Main, Overlay, and Interview window management
│   ├── preload/
│   │   └── index.ts                 # Context bridge exposing safe IPC API to renderer
│   └── storage/
│       └── storageService.ts        # SQLite storage (settings, profile, sessions, Q&A)
├── src/
│   ├── components/layout/           # MainLayout & navigation bar
│   ├── pages/
│   │   ├── DashboardPage.tsx        # Quick start, stats, recent sessions
│   │   ├── OnboardingPage.tsx       # First-time BYOK API key setup
│   │   ├── ProfilePage.tsx          # Candidate background & skills
│   │   ├── ResumePage.tsx           # Document upload & Gemini analysis
│   │   ├── JobDescriptionPage.tsx   # JD management & requirements matching
│   │   ├── InterviewSetupPage.tsx   # Session config (type, role, answer style)
│   │   ├── InterviewWindow.tsx      # Full live practice view with STT & streaming AI
│   │   ├── OverlayWindow.tsx        # Compact, always-on-top transparent overlay
│   │   ├── HistoryPage.tsx          # Past sessions, scores & performance reports
│   │   ├── SettingsPage.tsx         # Models, audio devices, shortcuts & privacy
│   │   └── CaptureLabPage.tsx       # Desktop screen & window capture diagnostics
│   ├── stores/
│   │   └── index.ts                 # Zustand stores (app, profile, session, interview)
│   └── types/
│       └── electron.d.ts            # Type definitions for window.electronAPI
└── tests/
    └── unit/
        ├── geminiService.test.ts    # Prompt formatting & style rules
        ├── questionDetection.test.ts# Heuristic regex & classification tests
        ├── storageService.test.ts   # SQLite in-memory operations
        └── stores.test.ts           # State machine & streaming answer tests
```

---

## 🔒 Privacy & Security

- **Direct API Communication**: Your API key and interview audio/data never touch any intermediary server.
- **Local Storage Only**: All session history and profiles are saved exclusively on your local machine in SQLite.
- **Capture Protection**: The overlay window enables Electron's `setContentProtection(true)` so the assistant window does not appear in screen shares or recordings during test calls.
