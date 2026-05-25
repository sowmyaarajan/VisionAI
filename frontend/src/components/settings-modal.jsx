// Settings modal — UiPath credentials, environment, project, scopes
import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';

export const DEFAULT_SETTINGS = {
  clientId: '',
  clientSecret: '',
  tenant: '',
  folder: 'Shared',
  environment: 'production',
  customUrl: '',
  project: '',
  scopes: 'Du.Digitization.Api Du.Extraction.Api Du.Classification.Api Du.DocumentManager.Document Du.Validation.Api',
  saveLocally: true,
};

export function SettingsModal({ open, settings, onChange, onClose, onTest, testState }) {
  const [showSecret, setShowSecret] = useState(false);
  const [draft, setDraft] = useState(settings);

  useEffect(() => { if (open) setDraft(settings); }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const save = () => { onChange(draft); onClose(); };

  const testStatus = testState && typeof testState === 'object' ? testState : null;
  const testStr = typeof testState === 'string' ? testState : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-hd">
          <div className="mh-text">
            <h2>Connection settings</h2>
            <p>UiPath Cloud credentials and IXP project routing.</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="field full">
              <label>Environment</label>
              <div className="env-segmented">
                {[
                  { id: 'staging', label: 'Staging' },
                  { id: 'production', label: 'Production' },
                  { id: 'custom', label: 'Custom URL' },
                ].map((opt) => (
                  <button key={opt.id}
                    className={draft.environment === opt.id ? 'active' : ''}
                    onClick={() => set('environment', opt.id)}>{opt.label}</button>
                ))}
              </div>
            </div>

            {draft.environment === 'custom' && (
              <div className="field full">
                <label>Custom base URL <span className="hint">https://...</span></label>
                <input className="input mono" placeholder="https://cloud.uipath.com"
                  value={draft.customUrl} onChange={(e) => set('customUrl', e.target.value)} />
              </div>
            )}

            <div className="field">
              <label>Client ID <span className="req">*</span></label>
              <input className="input mono" placeholder="3f8b1c2e-..." autoComplete="off"
                value={draft.clientId} onChange={(e) => set('clientId', e.target.value)} />
            </div>

            <div className="field">
              <label>Client Secret <span className="req">*</span></label>
              <div className="input-wrap has-eye">
                <input className="input mono" type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••••••••••" autoComplete="off"
                  value={draft.clientSecret} onChange={(e) => set('clientSecret', e.target.value)} />
                <button className="eye" onClick={() => setShowSecret((s) => !s)} type="button"
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}>
                  <Icon name={showSecret ? 'eye-off' : 'eye'} size={15} />
                </button>
              </div>
            </div>

            <div className="field">
              <label>Tenant / Org <span className="req">*</span> <span className="hint">org/tenant — e.g. ps_india/DU_test</span></label>
              <input className="input mono" placeholder="ps_india/DU_test"
                value={draft.tenant} onChange={(e) => set('tenant', e.target.value)} />
            </div>

            <div className="field">
              <label>Folder</label>
              <input className="input" placeholder="Shared"
                value={draft.folder} onChange={(e) => set('folder', e.target.value)} />
            </div>

            <div className="field full">
              <label>IXP project name <span className="req">*</span></label>
              <input className="input" placeholder="TableExtraction_IXP"
                value={draft.project} onChange={(e) => set('project', e.target.value)} />
            </div>

            <div className="field full">
              <label>Scopes <span className="hint">space-separated</span></label>
              <input className="input mono" placeholder="Du.Digitization.Api Du.Extraction.Api ..."
                value={draft.scopes} onChange={(e) => set('scopes', e.target.value)} />
            </div>

            <div className="field full">
              <div className={`toggle ${draft.saveLocally ? 'on' : ''}`}
                onClick={() => set('saveLocally', !draft.saveLocally)}
                role="switch" aria-checked={draft.saveLocally} tabIndex={0}>
                <div className="switch"></div>
                <div className="tg-text">
                  <div className="tg-title">Save credentials in this browser</div>
                  <div className="tg-sub">Stored only in localStorage. Never sent off-device.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-ft">
          <div>
            {testStr === 'testing' && <span className="test-status"><span className="spinner" style={{ borderTopColor: 'var(--text-3)', borderColor: 'rgba(0,0,0,0.1)' }}></span>Testing connection…</span>}
            {testStatus?.ok && <span className="test-status ok"><span className="dot"></span>{testStatus.projectId ? `Verified · project + extractor found` : 'Token acquired'}</span>}
            {testStatus && !testStatus.ok && <span className="test-status bad" title={testStatus.error}><span className="dot"></span>{(testStatus.error || 'Authentication failed').slice(0, 80)}</span>}
            {!testState && <button className="btn btn-sm" onClick={() => onTest(draft)} disabled={!draft.clientId || !draft.clientSecret || !draft.tenant}>
              <Icon name="plug" size={13} />Test connection
            </button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save settings</button>
          </div>
        </div>

        {testStatus?.availableProjects && testStatus.availableProjects.length > 0 && (
          <div style={{ padding: '8px 22px 16px', fontSize: 12.5, color: 'var(--text-3)' }}>
            <strong style={{ color: 'var(--text-2)' }}>Available IXP projects:</strong>{' '}
            {testStatus.availableProjects.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
