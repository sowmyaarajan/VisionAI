# VisionAI IXP

A full-stack web application for document extraction using **UiPath Intelligent Document Processing (IXP)** with built-in LLM analysis. Upload a PDF, watch the 5-step IXP pipeline run in real time, then analyze and compare the extracted data using Claude, OpenAI, Gemini, or any OpenAI-compatible model.

---

## What it does

1. **Upload** a PDF or document image via the drag-and-drop UI.
2. **Extract** structured data through UiPath IXP (5-step pipeline streamed live):
   - Step 1 — Authenticate (OAuth client credentials)
   - Step 2 — Digitize the document
   - Step 3 — Resolve the IXP project
   - Step 4 — Resolve the latest extractor version
   - Step 5 — Run extraction and receive results
3. **Analyze** the extracted fields with an LLM of your choice.
4. **Compare** results across multiple extraction runs or models.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (React + Vite)  — localhost:5173   │
│  src/app.jsx, components/, api/             │
└────────────────┬────────────────────────────┘
                 │  HTTP / Server-Sent Events
┌────────────────▼────────────────────────────┐
│  FastAPI backend          — localhost:8000  │
│  backend/main.py                            │
│  ├── routes/connection.py  POST /api/connection/test  │
│  ├── routes/extract.py     POST /api/extract          │
│  └── routes/llm.py         POST /api/llm/test, /chat  │
│                                             │
│  backend/ixp_service.py  (orchestrates)     │
│  uipath_ixp_extraction.py  (IXP API calls)  │
└────────────────┬────────────────────────────┘
                 │  HTTPS
        UiPath IXP API + LLM providers
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | Backend runtime |
| Node.js | 18+ | Frontend build |
| npm | 9+ | Bundled with Node.js |
| UiPath account | — | With an IXP project published |
| UiPath OAuth app | — | Client credentials grant type |

---

## 1 — Clone and set up credentials

```bash
git clone https://github.com/<your-username>/VisionAI.git
cd VisionAI
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set:

```env
UIPATH_CLIENT_ID=<your-client-id>
UIPATH_CLIENT_SECRET=<your-client-secret>
UIPATH_ORG_NAME=<your-org-name>
UIPATH_TENANT_NAME=<your-tenant-name>
UIPATH_BASE_URL=https://cloud.uipath.com
IXP_PROJECT_NAME=<exact name of your IXP project>
DOCUMENT_PATH=path/to/your/test-document.pdf   # standalone script only
```

> **Where to find credentials:** UiPath Automation Cloud > Admin > External Applications > Add application (machine-to-machine, scope: `Du.Digitization.Api Du.Extraction.Api Du.Classification.Api Du.DocumentManager.Document Du.Validation.Api`)

---

## 2 — Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
cd ..
```

`requirements.txt` installs: `fastapi`, `uvicorn`, `pydantic`, `requests`, `python-dotenv`, `python-multipart`, `httpx`.

---

## 3 — Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Running in development mode

Run the backend and frontend in two separate terminals:

**Terminal 1 — Backend**
```bash
python -m uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

> On Windows you can also double-click `start.bat` to launch both servers.

---

## Running in production mode (single server)

Build the frontend, then serve everything from the FastAPI backend:

```bash
cd frontend
npm run build
cd ..
python -m uvicorn backend.main:app --port 8000
```

Open **http://localhost:8000** — the backend serves the built React app from `frontend/dist/`.

---

## Using the standalone extraction script

`uipath_ixp_extraction.py` is a self-contained script that runs the same 5-step IXP flow from the command line (no web UI needed).

**Setup:**
```bash
pip install requests python-dotenv
cp .env.example .env   # fill in values including DOCUMENT_PATH
```

**Run:**
```bash
python uipath_ixp_extraction.py
```

It prints step-by-step progress and saves full results to `extraction_results.json`.

---

## LLM provider configuration

The app proxies LLM calls through the backend to avoid CORS issues. Configure your preferred provider in the **Model Settings** panel of the UI:

| Provider | Model examples | API key source |
|---|---|---|
| Claude (Anthropic) | `claude-sonnet-4-5`, `claude-opus-4-7` | console.anthropic.com |
| OpenAI | `gpt-4o`, `gpt-4o-mini` | platform.openai.com |
| Google Gemini | `gemini-2.0-flash`, `gemini-1.5-pro` | aistudio.google.com |
| OpenRouter | `deepseek/deepseek-chat-v3.1` | openrouter.ai |
| Azure OpenAI | your deployment name | Azure portal |
| Ollama (local) | `llama3.1`, `mistral` | No key needed |
| Custom | any OpenAI-compatible | your endpoint |

API keys are sent per-request from the browser and are never stored on disk.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/connection/test` | Validate UiPath credentials and resolve project/extractor IDs |
| `POST` | `/api/extract` | Upload a document and stream 5-step extraction progress (SSE) |
| `POST` | `/api/llm/test` | Ping an LLM provider to verify connectivity |
| `POST` | `/api/llm/chat` | Send a chat message to the configured LLM |
| `GET` | `/api/health` | Health check — returns `{"ok": true}` |

---

## Project structure

```
VisionAI/
├── backend/
│   ├── main.py              # FastAPI app, CORS, static file serving
│   ├── ixp_service.py       # 5-step IXP orchestration (used by the web UI)
│   ├── adapters.py          # UiPath response → UI-friendly format
│   ├── schemas.py           # Pydantic request/response models
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Credential template for backend
│   └── routes/
│       ├── connection.py    # POST /api/connection/test
│       ├── extract.py       # POST /api/extract (SSE streaming)
│       └── llm.py           # POST /api/llm/test, /api/llm/chat
│
├── frontend/
│   ├── src/
│   │   ├── app.jsx          # Root React component, state management
│   │   ├── main.jsx         # ReactDOM entry point
│   │   ├── styles.css       # Global styles
│   │   ├── tweaks-panel.jsx # Live color/theme tweaker
│   │   ├── api/
│   │   │   ├── ixp.js       # Calls /api/connection/test and /api/extract
│   │   │   └── llm.js       # Calls /api/llm/test and /api/llm/chat
│   │   └── components/
│   │       ├── analysis-panel.jsx   # LLM analysis results
│   │       ├── compare.jsx          # Side-by-side extraction comparison
│   │       ├── model-settings.jsx   # LLM provider/model selector
│   │       ├── pipeline.jsx         # Live step-progress visualization
│   │       ├── results.jsx          # Extraction field display
│   │       ├── settings-modal.jsx   # UiPath credential form
│   │       ├── upload-zone.jsx      # Drag-and-drop file upload
│   │       ├── toast.jsx            # Toast notifications
│   │       └── icons.jsx            # SVG icon components
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── uipath_ixp_extraction.py  # Standalone 5-step extraction script
├── data/mock-results.js      # Mock extraction data for UI development
├── .env.example              # Credential template (copy to .env)
├── .gitignore
├── start.bat                 # Windows: launches both dev servers
└── README.md
```

---

## Troubleshooting

**`Missing credentials` error on startup**
→ Ensure you copied `.env.example` to `.env` and filled in `UIPATH_CLIENT_ID` and `UIPATH_CLIENT_SECRET`.

**`Project 'X' not found`**
→ The `IXP_PROJECT_NAME` (or value entered in the UI) must exactly match the project name in UiPath — case-sensitive. The UI will list available IXP projects on a failed connection test.

**Frontend shows `Frontend not built`**
→ Run `cd frontend && npm install && npm run dev` for dev mode, or `npm run build` for production mode.

**CORS errors in browser console**
→ Make sure the frontend dev server is on port 5173 (default). The backend allows `localhost:5173` and `127.0.0.1:5173` by default.

**Ollama connection refused**
→ Start Ollama with `ollama serve` and pull your model: `ollama pull llama3.1`.
