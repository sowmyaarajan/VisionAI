// Main app — Phase 1 + Phase 2 (Analyse & Compare) — backed by FastAPI + real UiPath IXP.
import React, { useState, useEffect } from 'react';
import { Icon } from './components/icons.jsx';
import { useToast } from './components/toast.jsx';
import { UploadZone } from './components/upload-zone.jsx';
import { Pipeline } from './components/pipeline.jsx';
import { Results } from './components/results.jsx';
import { AnalysisPanel } from './components/analysis-panel.jsx';
import { CompareTab } from './components/compare.jsx';
import { SettingsModal, DEFAULT_SETTINGS } from './components/settings-modal.jsx';
import { ModelSettingsModal } from './components/model-settings.jsx';
import { MODEL_PROVIDERS, DEFAULT_MODEL_SETTINGS, testLLM } from './api/llm.js';
import { testConnection } from './api/ixp.js';
import {
  TweaksPanel, TweakSection, TweakColor, useTweaks,
} from './tweaks-panel.jsx';

const TWEAK_DEFAULTS = {
  accent: '#FA4616',
};

const ACCENT_PRESETS = {
  '#FA4616': { soft: '#FFEDE5', deep: '#C8340B' },
  '#2A6FDB': { soft: '#E6EEFB', deep: '#1A4FA8' },
  '#1F8A5B': { soft: '#E4F3EC', deep: '#136942' },
  '#7A5AE0': { soft: '#EDE7FB', deep: '#5A3FC0' },
};

function applyAccent(hex) {
  const preset = ACCENT_PRESETS[hex] || ACCENT_PRESETS['#FA4616'];
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-soft', preset.soft);
  document.documentElement.style.setProperty('--accent-deep', preset.deep);
}

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const toast = useToast();

  const [tab, setTab] = useState('extract');

  const [stage, setStage] = useState('idle'); // idle | processing | results
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);

  // ── IXP settings ──
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('ixp-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testState, setTestState] = useState(null); // null | 'testing' | {ok, ...}

  // ── Model settings ──
  const [modelSettings, setModelSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('ixp-model-settings');
      return saved ? { ...DEFAULT_MODEL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_MODEL_SETTINGS;
    } catch { return DEFAULT_MODEL_SETTINGS; }
  });
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [modelTestState, setModelTestState] = useState(null);

  useEffect(() => { applyAccent(t.accent); }, [t.accent]);

  const connected = !!(settings.clientId && settings.clientSecret && settings.tenant && settings.project);
  const modelConnected = !!(modelSettings.provider && (modelSettings.provider === 'ollama' || modelSettings.apiKey));

  const handleFile = (f) => {
    if (!connected) {
      toast.push({ kind: 'bad', title: 'Configure connection first', sub: 'Add Client ID, Secret, Tenant and Project name in Settings.', ttl: 3600 });
      setSettingsOpen(true);
      return;
    }
    setFile(f);
    setStage('processing');
    toast.push({ kind: 'info', title: 'Document received', sub: f.name, ttl: 2200 });
  };

  const handleProcessingDone = (uiResults) => {
    setResults(uiResults);
    setStage('results');
  };

  const handleReset = () => {
    setStage('idle');
    setFile(null);
    setResults(null);
  };

  const saveSettings = (next) => {
    setSettings(next);
    if (next.saveLocally) {
      try { localStorage.setItem('ixp-settings', JSON.stringify(next)); } catch {}
    } else {
      try { localStorage.removeItem('ixp-settings'); } catch {}
    }
    setTestState(null);
    toast.push({ kind: 'ok', title: 'Settings saved', sub: next.environment === 'custom' ? next.customUrl : next.environment, ttl: 2200 });
  };

  const handleTestConnection = async (draft) => {
    setTestState('testing');
    try {
      const res = await testConnection(draft);
      setTestState(res);
      if (res.ok) {
        toast.push({ kind: 'ok', title: 'Connection verified', sub: res.projectId ? `Project found · ${res.projectId.slice(0, 8)}…` : 'Token acquired', ttl: 2800 });
      } else {
        toast.push({ kind: 'bad', title: 'Test failed', sub: (res.error || '').slice(0, 160), ttl: 4200 });
      }
      setTimeout(() => setTestState(null), 6000);
    } catch (err) {
      setTestState({ ok: false, error: String(err.message || err) });
      toast.push({ kind: 'bad', title: 'Test failed', sub: String(err.message || err).slice(0, 160), ttl: 4200 });
      setTimeout(() => setTestState(null), 6000);
    }
  };

  const saveModelSettings = (next) => {
    setModelSettings(next);
    if (next.saveLocally) {
      try { localStorage.setItem('ixp-model-settings', JSON.stringify(next)); } catch {}
    } else {
      try { localStorage.removeItem('ixp-model-settings'); } catch {}
    }
    setModelTestState(null);
    toast.push({ kind: 'ok', title: 'Model saved', sub: MODEL_PROVIDERS[next.provider]?.label, ttl: 2200 });
  };

  const handleTestModel = async (draft) => {
    setModelTestState('testing');
    try {
      const res = await testLLM({
        provider: draft.provider,
        endpoint: draft.endpoint,
        apiKey: draft.apiKey,
        model: draft.model,
      });
      if (res.ok) {
        setModelTestState('ok');
        setTimeout(() => setModelTestState(null), 2800);
      } else {
        setModelTestState(res.error || 'Empty response');
        setTimeout(() => setModelTestState(null), 5000);
      }
    } catch (err) {
      setModelTestState(String(err.message || err));
      setTimeout(() => setModelTestState(null), 5000);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-mark">VA</div>
          <div className="topbar-title">
            <span className="t1">VisionAI · IXP</span>
            <span className="t2">Document → Structured Data + Analysis</span>
          </div>
        </div>
        <div className="topbar-spacer"></div>

        <div className={`topbar-status ${modelConnected ? 'connected' : ''}`} title="Model configured" style={{ marginRight: 4 }}>
          <span className="dot"></span>
          {modelConnected
            ? <span>{MODEL_PROVIDERS[modelSettings.provider]?.label.split(' ')[0]}</span>
            : <span>No model</span>}
        </div>

        <div className={`topbar-status ${connected ? 'connected' : 'error'}`}>
          <span className="dot"></span>
          {connected
            ? <span>{settings.tenant || 'tenant'} · {settings.environment === 'custom' ? 'custom' : settings.environment}</span>
            : <span>Not configured</span>}
        </div>

        <button className="btn btn-icon" onClick={() => setModelSettingsOpen(true)} aria-label="Model settings" title="Model settings">
          <Icon name="brain" size={17} />
        </button>
        <button className="btn btn-icon" onClick={() => setSettingsOpen(true)} aria-label="UiPath settings" title="UiPath settings">
          <Icon name="settings" size={17} />
        </button>
      </header>

      <main className="main">
        <nav className="app-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'extract'} className={tab === 'extract' ? 'active' : ''} onClick={() => setTab('extract')}>
            <Icon name="scan" size={14} />Extract
          </button>
          <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'active' : ''} onClick={() => setTab('compare')}>
            <Icon name="table" size={14} />Compare
          </button>
        </nav>

        {tab === 'extract' && (
          <>
            {stage === 'idle' && <UploadZone onFile={handleFile} />}
            {stage === 'processing' && <Pipeline file={file} settings={settings} onDone={handleProcessingDone} onCancel={handleReset} toast={toast} />}
            {stage === 'results' && results && (
              <>
                <Results results={results} file={file} onReset={handleReset} toast={toast} />
                <AnalysisPanel
                  results={results}
                  modelSettings={modelSettings}
                  onConfigureModel={() => setModelSettingsOpen(true)}
                  toast={toast}
                />
              </>
            )}
          </>
        )}

        {tab === 'compare' && (
          <CompareTab
            ixpSettings={settings}
            modelSettings={modelSettings}
            onConfigureModel={() => setModelSettingsOpen(true)}
            onConfigureIxp={() => setSettingsOpen(true)}
            toast={toast}
          />
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={saveSettings}
        onClose={() => { setSettingsOpen(false); setTestState(null); }}
        onTest={handleTestConnection}
        testState={testState}
      />

      <ModelSettingsModal
        open={modelSettingsOpen}
        settings={modelSettings}
        onChange={saveModelSettings}
        onClose={() => { setModelSettingsOpen(false); setModelTestState(null); }}
        onTest={handleTestModel}
        testState={modelTestState}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakColor
          label="Accent color"
          value={t.accent}
          options={['#FA4616', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
          onChange={(v) => setTweak('accent', v)}
        />
      </TweaksPanel>
    </div>
  );
}
