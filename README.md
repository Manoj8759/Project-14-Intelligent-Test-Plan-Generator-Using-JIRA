# 🚀 Intelligent Test Plan Generator

A full-stack web application that automates test plan creation by integrating JIRA ticket data with LLM-powered analysis using customizable templates.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🔌 JIRA Integration**: Fetch ticket details directly from JIRA REST API v3
- **🤖 Dual LLM Support**: Use either Groq Cloud API or local Ollama models
- **📄 Template Management**: Upload PDF templates to structure your test plans
- **⚡ Real-time Generation**: Stream responses for faster feedback (optional)
- **🔐 Secure Storage**: API keys stored securely using OS keychain or encryption
- **📱 Responsive UI**: Clean, professional interface built with React + Tailwind
- **⌨️ Keyboard Shortcuts**: `Ctrl+Enter` to generate, quick actions for power users

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │  External APIs  │
│  (React/Vite)   │────▶│  (Express.js)   │────▶│   JIRA REST     │
│   Port: 5173    │     │   Port: 3001    │     │   Groq API      │
└─────────────────┘     └─────────────────┘     │   Ollama        │
                                                └─────────────────┘
                                                         │
                                                ┌─────────────────┐
                                                │   SQLite DB     │
                                                │  (local data)   │
                                                └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- (Optional) Ollama for local LLM support
- (Optional) JIRA API token
- (Optional) Groq API key

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd "AI Testplan Generator - JIRA"
   ```

2. **Install root dependencies:**
   ```bash
   npm install
   ```

3. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Initialize the database:**
   ```bash
   cd backend
   npm run db:init
   cd ..
   ```

6. **Configure environment variables (optional):**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

7. **Start the development servers:**
   ```bash
   npm run dev
   ```

   This starts:
   - Backend: http://localhost:3001
   - Frontend: http://localhost:5173

## 📖 Usage Guide

### 1. Configure JIRA

1. Go to **Settings** → **JIRA**
2. Enter your JIRA Base URL (e.g., `https://company.atlassian.net`)
3. Enter your username/email
4. Generate an API token from [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
5. Click **Test Connection** to verify
6. Click **Save Configuration**

### 2. Configure LLM Provider

#### Option A: Groq Cloud (Recommended)
1. Get your API key from [Groq Console](https://console.groq.com)
2. Go to **Settings** → **LLM**
3. Ensure "Use Local LLM" is **OFF**
4. Enter your Groq API key
5. Select a model from the available options:
   | Model | Description |
   |-------|-------------|
   | `llama-3.3-70b-versatile` | **Recommended** - Best quality |
   | `llama-3.1-70b-versatile` | Alternative 70B model |
   | `llama-3.1-8b-instant` | **Fastest** - Good for quick drafts |
   | `mixtral-8x7b-32768` | Mixture of Experts model |
   | `gemma-7b-it` | Google's Gemma model |
6. Adjust temperature if needed (0.7 is default)
7. Test and save

#### Option B: Ollama (Local)
1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull a model: `ollama pull llama3`
3. Go to **Settings** → **LLM**
4. Toggle "Use Local LLM" to **ON**
5. Click refresh to load available models
6. Select your model
7. Test and save

### 3. Upload Template (Optional)

1. Go to **Settings** → **Templates**
2. Upload a PDF file containing your test plan structure
3. The system will extract the structure and use it for generation

### 4. Generate Test Plans

1. Go to **Generate** page
2. Enter a JIRA ticket ID (e.g., `SCRUM-5`)
3. Click **Fetch** to retrieve ticket details
4. Select a template
5. Click **Generate Test Plan** (or press `Ctrl+Enter`)
6. View, copy, or download the generated markdown

## 🛠️ Development

### Project Structure

```
├── backend/
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic (JIRA, LLM, PDF)
│   │   ├── utils/         # Database, encryption, validators
│   │   └── types/         # TypeScript types
│   ├── data/              # SQLite database (auto-created)
│   └── templates/         # Uploaded PDF storage
├── frontend/
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   └── services/      # API client
│   └── public/
└── template/              # Sample test plan PDF
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build` | Build for production |
| `npm run start` | Start production server |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings/jira` | GET/POST | JIRA configuration |
| `/api/settings/llm` | GET/POST | LLM configuration |
| `/api/settings/llm/models` | GET | List Ollama models |
| `/api/jira/fetch` | POST | Fetch JIRA ticket |
| `/api/jira/recent` | GET | Recent tickets |
| `/api/templates` | GET | List templates |
| `/api/templates/upload` | POST | Upload PDF |
| `/api/testplan/generate` | POST | Generate test plan |
| `/api/testplan/history` | GET | Generation history |

## 🔒 Security

- API keys never stored in localStorage
- Credentials encrypted at rest using AES-256-GCM
- CORS restricted to localhost only
- Input validation for JIRA IDs and URLs
- PDF file size limited to 5MB

## 🚀 Deployment

### Deploy to Render (Recommended - Free)

This app is configured for easy deployment to [Render](https://render.com) with full backend + frontend + SQLite support.

#### Option 1: Deploy via Blueprint (render.yaml) - Recommended

This method uses Infrastructure as Code for consistent deployments:

1. **Push `render.yaml` to your GitHub repo** (already included)

2. **Go to Render Dashboard**
   - Click **New +** → **Blueprint**
   - Connect your GitHub repository
   - Render will automatically read the `render.yaml` configuration

3. **Deploy!** 🎉
   - Render will create the web service with:
     - Proper build/start commands
     - Persistent disk for SQLite
     - Auto-generated encryption key
     - Health checks configured

#### Option 2: One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bhaumikgohel/Intelligent-Test-Plan-Generator-Using-JIRA)

#### Option 3: Manual Deploy

1. **Fork/Connect GitHub Repo**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **New +** → **Web Service**
   - Connect your GitHub repo: `bhaumikgohel/Intelligent-Test-Plan-Generator-Using-JIRA`

2. **Configure Service**
   | Setting | Value |
   |---------|-------|
   | Name | `intelligent-test-plan-generator` |
   | Runtime | Node |
   | Build Command | `npm install && cd backend && npm install && cd ../frontend && npm install && npm run build` |
   | Start Command | `cd backend && npm start` |

3. **Add Environment Variables**
   - `NODE_ENV`: `production`
   - `ENCRYPTION_KEY`: (Generate a random string)

4. **Create Disk** (For SQLite persistence)
   - Name: `data`
   - Mount Path: `/opt/render/project/src/backend/data`
   - Size: 1 GB

5. **Deploy!** 🎉

Your app will be live at `https://intelligent-test-plan-generator.onrender.com`

### Deploy to Vercel (Frontend Only)

⚠️ **Limitation**: Vercel doesn't support persistent SQLite databases. Use this only if you plan to:
- Connect to an external database (Supabase, PostgreSQL)
- Run backend separately on another platform

```bash
# Deploy frontend only
npm i -g vercel
vercel --prod
```

## 🐛 Troubleshooting

### Backend Not Starting

**Error: `multer is not a function`**
- Fixed in latest version - imports updated to ES module syntax
- If still occurs, reinstall: `cd backend && rm -rf node_modules && npm install`

**Error: `ECONNREFUSED` when testing connections**
- Backend server is not running
- Start backend manually: `cd backend && npm run dev`
- Then start frontend in a new terminal: `cd frontend && npm run dev`

### JIRA Connection Failed

- Verify your JIRA base URL format (should be `https://domain.atlassian.net`)
- Ensure API token has correct permissions (read access to projects)
- Check if JIRA instance is accessible from your network
- Verify email address matches your Atlassian account

### Groq Connection Failed

**Error: `model has been decommissioned`**
- Some older models (like `llama3-70b-8192`) are deprecated
- Use updated models: `llama-3.3-70b-versatile` or `llama-3.1-70b-versatile`
- Select from dropdown in Settings → LLM

**Other errors:**
- Verify API key is valid at [Groq Console](https://console.groq.com)
- Check Groq service status
- Ensure model name matches exactly

### Ollama Connection Failed

- Ensure Ollama is running: `ollama serve` or check system tray
- Verify Ollama is accessible at `http://localhost:11434`
- Check if model is downloaded: `ollama list`
- Download a model: `ollama pull llama3.1`

### Frontend Proxy Errors

**Error: `http proxy error: /api/...`**
- Backend is not running on port 3001
- Check if another app is using port 3001
- Start backend manually before frontend

## 📝 Changelog

### v1.0.0 (2026-02-14)
- Initial release
- JIRA REST API v3 integration
- Groq Cloud LLM support with multiple models
- Ollama local LLM support
- PDF template upload and parsing
- Secure credential storage
- Markdown export (copy/download)

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Groq](https://groq.com/) for fast LLM inference
- [Ollama](https://ollama.com/) for local LLM support
- [Atlassian](https://www.atlassian.com/) for JIRA API
