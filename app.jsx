// Main app — Phase 1 + Phase 2 (Analyse & Compare)
// Orchestrates: tabs (Extract | Compare), upload → pipeline → results,
// settings modal, model settings modal, tweaks
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#FA4616",
  "mockDocType": "invoice"
}/*EDITMODE-END*/;

const ACCENT_PRESETS = {
  '#FA4616': { soft: '#FFEDE5', deep: '#C8340B' },  // UiPath orange
  '#2A6FDB': { soft: '#E6EEFB', deep: '#1A4FA8' },  // Cobalt
  '#1F8A5B': { soft: '#E4F3EC', deep: '#136942' },  // Forest
  '#7A5AE0': { soft: '#EDE7FB', deep: '#5A3FC0' },  // Plum
};

function applyAccent(hex) {
  const preset = ACCENT_PRESETS[hex] || ACCENT_PRESETS['#FA4616'];
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-soft', preset.soft);
  document.documentElement.style.setProperty('--accent-deep', preset.deep);
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const toast = useToast();

  const [tab, setTab] = useStateApp('extract'); // extract | compare

  const [stage, setStage] = useStateApp('idle'); // idle | processing | results
  const [file, setFile] = useStateApp(null);
  const [results, setResults] = useStateApp(null);
  const [realPages, setRealPages] = useStateApp(null);

  // ── IXP settings ──
  const [settings, setSettings] = useStateApp(() => {
    try {
      const saved = localStorage.getItem('ixp-settings');
      return saved ? { ...window.DEFAULT_SETTINGS, ...JSON.parse(saved) } : window.DEFAULT_SETTINGS;
    } catch { return window.DEFAULT_SETTINGS; }
  });
  const [settingsOpen, setSettingsOpen] = useStateApp(false);
  const [testState, setTestState] = useStateApp(null);

  // ── Model settings ──
  const [modelSettings, setModelSettings] = useStateApp(() => {
    try {
      const saved = localStorage.getItem('ixp-model-settings');
      return saved ? { ...window.DEFAULT_MODEL_SETTINGS, ...JSON.parse(saved) } : window.DEFAULT_MODEL_SETTINGS;
    } catch { return window.DEFAULT_MODEL_SETTINGS; }
  });
  const [modelSettingsOpen, setModelSettingsOpen] = useStateApp(false);
  const [modelTestState, setModelTestState] = useStateApp(null);

  useEffectApp(() => { applyAccent(t.accent); }, [t.accent]);

  const connected = !!(settings.clientId && settings.clientSecret && settings.tenant && settings.project);
  const modelConnected = !!(modelSettings.provider && (modelSettings.provider === 'ollama' || modelSettings.apiKey));

  const handleFile = async (f) => {
    if (!connected) {
      toast.push({ kind: 'bad', title: 'Configure connection first', sub: 'Add Client ID, Secret, Tenant and Project name in Settings.', ttl: 3600 });
      setSettingsOpen(true);
      return;
    }
    setFile(f);
    setRealPages(null);
    setStage('processing');
    toast.push({ kind: 'info', title: 'Document received', sub: f.name, ttl: 2200 });
    // Read real page count in parallel with pipeline animation
    const pages = await window.getRealPageCount(f);
    setRealPages(pages);
    toast.push({ kind: 'info', title: `${pages} page${pages === 1 ? '' : 's'} detected`, sub: `${(f.size / 1024).toFixed(0)} KB`, ttl: 1800 });
  };

  const handleProcessingDone = () => {
    const base = MOCK_RESULTS[t.mockDocType] || MOCK_RESULTS.invoice;
    const adapted = file && realPages
      ? window.adaptResultsToFile(base, file, realPages)
      : base;
    setResults(adapted);
    setStage('results');
  };

  const handleReset = () => {
    setStage('idle');
    setFile(null);
    setResults(null);
    setRealPages(null);
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

  const testConnection = (draft) => {
    setTestState('testing');
    setTimeout(() => {
      const ok = draft.clientId.length > 4 && draft.clientSecret.length > 4 && draft.tenant.length > 1;
      setTestState(ok ? 'ok' : 'bad');
      setTimeout(() => setTestState(null), 3000);
    }, 1100);
  };

  const saveModelSettings = (next) => {
    setModelSettings(next);
    if (next.saveLocally) {
      try { localStorage.setItem('ixp-model-settings', JSON.stringify(next)); } catch {}
    } else {
      try { localStorage.removeItem('ixp-model-settings'); } catch {}
    }
    setModelTestState(null);
    toast.push({ kind: 'ok', title: 'Model saved', sub: window.MODEL_PROVIDERS[next.provider]?.label, ttl: 2200 });
  };

  const testModel = async (draft) => {
    setModelTestState('testing');
    try {
      const reply = await window.callLLM({
        provider: draft.provider,
        endpoint: draft.endpoint,
        apiKey: draft.apiKey,
        model: draft.model,
        messages: [{ role: 'user', content: 'Reply with exactly the word: OK' }],
        maxTokens: 16,
        temperature: 0,
      });
      if (reply && reply.trim().length > 0) {
        setModelTestState('ok');
        setTimeout(() => setModelTestState(null), 2400);
      } else {
        setModelTestState('Empty response from model');
        setTimeout(() => setModelTestState(null), 4000);
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
            ? <span>{window.MODEL_PROVIDERS[modelSettings.provider]?.label.split(' ')[0]}</span>
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
            mockDocType={t.mockDocType}
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
        onTest={testConnection}
        testState={testState}
      />

      <ModelSettingsModal
        open={modelSettingsOpen}
        settings={modelSettings}
        onChange={saveModelSettings}
        onClose={() => { setModelSettingsOpen(false); setModelTestState(null); }}
        onTest={testModel}
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
        <TweakSection label="Demo content" />
        <TweakRadio
          label="Mock document"
          value={t.mockDocType}
          options={[
            { value: 'invoice', label: 'Invoice' },
            { value: 'statement', label: 'Statement' },
            { value: 'insurance', label: 'Policy' },
          ]}
          onChange={(v) => {
            setTweak('mockDocType', v);
            if (stage === 'results') {
              const base = MOCK_RESULTS[v] || MOCK_RESULTS.invoice;
              const adapted = file && realPages
                ? window.adaptResultsToFile(base, file, realPages)
                : base;
              setResults(adapted);
            }
          }}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider><App /></ToastProvider>
);
