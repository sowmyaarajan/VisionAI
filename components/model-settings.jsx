// Model Settings modal — LLM provider + endpoint + API key
const { useState: useStateMS, useEffect: useEffectMS } = React;

function ModelSettingsModal({ open, settings, onChange, onClose, onTest, testState }) {
  const [showKey, setShowKey] = useStateMS(false);
  const [draft, setDraft] = useStateMS(settings);

  useEffectMS(() => { if (open) setDraft(settings); }, [open, settings]);

  useEffectMS(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const cfg = window.MODEL_PROVIDERS[draft.provider] || window.MODEL_PROVIDERS.custom;
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const setProvider = (p) => {
    const newCfg = window.MODEL_PROVIDERS[p];
    setDraft((d) => ({
      ...d,
      provider: p,
      endpoint: '',
      model: newCfg?.modelDefault || '',
    }));
  };

  const save = () => { onChange(draft); onClose(); };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-hd">
          <div className="mh-text">
            <h2>Model settings</h2>
            <p>Configure the LLM used for document analysis and Q&amp;A. Bring your own.</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="field full">
              <label>Provider</label>
              <select className="select" value={draft.provider} onChange={(e) => setProvider(e.target.value)}>
                {Object.entries(window.MODEL_PROVIDERS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="field full">
              <label>
                Endpoint URL
                <span className="hint">{cfg.endpoint ? `default: ${cfg.endpoint.length > 56 ? cfg.endpoint.slice(0, 56) + '…' : cfg.endpoint}` : 'required'}</span>
              </label>
              <input className="input mono" placeholder={cfg.endpoint || 'https://your-endpoint/...'}
                value={draft.endpoint} onChange={(e) => set('endpoint', e.target.value)} />
            </div>

            <div className="field full">
              <label>
                API key {draft.provider !== 'ollama' && <span className="req">*</span>}
                <span className="hint">{cfg.keyLabel}</span>
              </label>
              <div className="input-wrap has-eye">
                <input className="input mono" type={showKey ? 'text' : 'password'}
                  placeholder={draft.provider === 'ollama' ? 'not required for local Ollama' : 'sk-... / your key'}
                  autoComplete="off"
                  value={draft.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)} />
                <button className="eye" onClick={() => setShowKey((s) => !s)} type="button"
                  aria-label={showKey ? 'Hide key' : 'Show key'}>
                  <Icon name={showKey ? 'eye-off' : 'eye'} size={15} />
                </button>
              </div>
            </div>

            {cfg.needsModel && (
              <div className="field full">
                <label>Model <span className="hint">{cfg.modelHint}</span></label>
                <input className="input mono" placeholder={cfg.modelDefault || 'model-name'}
                  value={draft.model} onChange={(e) => set('model', e.target.value)} />
              </div>
            )}

            <div className="field full">
              <div className={`toggle ${draft.saveLocally ? 'on' : ''}`}
                onClick={() => set('saveLocally', !draft.saveLocally)}
                role="switch" aria-checked={draft.saveLocally} tabIndex={0}>
                <div className="switch"></div>
                <div className="tg-text">
                  <div className="tg-title">Save model settings in this browser</div>
                  <div className="tg-sub">Stored only in localStorage. Never sent off-device.</div>
                </div>
              </div>
            </div>

            <div className="info-note full">
              <Icon name="info" size={14} />
              <div>
                <strong>Browser CORS:</strong> some providers (OpenAI, Anthropic without the dangerous-browser flag, Azure) may block direct browser calls. If you see CORS errors, use a proxy or run from an allowed origin. Ollama works locally; OpenRouter, Anthropic (with header), and Gemini support direct browser calls.
              </div>
            </div>
          </div>
        </div>

        <div className="modal-ft">
          <div>
            {testState === 'testing' && <span className="test-status"><span className="spinner" style={{ borderTopColor: 'var(--text-3)', borderColor: 'rgba(0,0,0,0.1)' }}></span>Pinging model…</span>}
            {testState === 'ok' && <span className="test-status ok"><span className="dot"></span>Model responded</span>}
            {testState && testState !== 'ok' && testState !== 'testing' && (
              <span className="test-status bad" title={testState}>
                <span className="dot"></span>{String(testState).length > 64 ? String(testState).slice(0, 64) + '…' : testState}
              </span>
            )}
            {!testState && <button className="btn btn-sm" onClick={() => onTest(draft)}
              disabled={draft.provider !== 'ollama' && !draft.apiKey}>
              <Icon name="plug" size={13} />Test model
            </button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ModelSettingsModal = ModelSettingsModal;
