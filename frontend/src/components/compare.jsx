// Compare tab — upload two docs, run real IXP on both, LLM diffs the structured fields
import React, { useState, useRef } from 'react';
import { Icon } from './icons.jsx';
import { extractDocument } from '../api/ixp.js';
import { callLLM, extractJsonFromText } from '../api/llm.js';

const SLOT_TITLES = { a: 'Document A', b: 'Document B' };

export function CompareTab({ ixpSettings, modelSettings, onConfigureModel, onConfigureIxp, toast }) {
  const [slots, setSlots] = useState({
    a: { file: null, results: null, status: 'idle', step: null, error: null },
    b: { file: null, results: null, status: 'idle', step: null, error: null },
  });
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [compareError, setCompareError] = useState(null);

  const ixpConnected = !!(ixpSettings.clientId && ixpSettings.clientSecret && ixpSettings.tenant && ixpSettings.project);
  const modelConnected = !!(modelSettings.provider && (modelSettings.provider === 'ollama' || modelSettings.apiKey));

  const updateSlot = (slot, patch) => setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...patch } }));

  const acceptFile = async (slot, file) => {
    if (!file) return;
    if (!ixpConnected) {
      toast.push({ kind: 'bad', title: 'Configure IXP connection first', ttl: 3200 });
      onConfigureIxp();
      return;
    }
    updateSlot(slot, { file, results: null, status: 'processing', step: null, error: null });
    toast.push({ kind: 'info', title: `${SLOT_TITLES[slot]} received`, sub: file.name, ttl: 2200 });

    try {
      await extractDocument(file, ixpSettings, (evt) => {
        if (evt.kind === 'step') {
          updateSlot(slot, { step: evt.data.step });
        } else if (evt.kind === 'result') {
          updateSlot(slot, { results: evt.data, status: 'done', step: null });
          toast.push({ kind: 'ok', title: `${SLOT_TITLES[slot]} extracted`, sub: `${evt.data.fields.length} fields`, ttl: 2200 });
        } else if (evt.kind === 'error') {
          updateSlot(slot, { status: 'error', error: evt.data?.message || 'Extraction failed' });
          toast.push({ kind: 'bad', title: `${SLOT_TITLES[slot]} failed`, sub: String(evt.data?.message || '').slice(0, 220), ttl: 5000 });
        }
      });
    } catch (err) {
      updateSlot(slot, { status: 'error', error: String(err.message || err) });
      toast.push({ kind: 'bad', title: 'Backend unreachable', sub: String(err.message || err).slice(0, 220), ttl: 5000 });
    }
  };

  const bothReady = slots.a.status === 'done' && slots.b.status === 'done';

  const runCompare = async () => {
    if (!bothReady) return;
    if (!modelConnected) {
      toast.push({ kind: 'bad', title: 'Configure model first', sub: 'Open Model settings.', ttl: 3200 });
      onConfigureModel();
      return;
    }
    setComparing(true);
    setComparison(null);
    setCompareError(null);

    const ctxA = compactCtx(slots.a.results);
    const ctxB = compactCtx(slots.b.results);

    const system = `You are an expert document comparison analyst. Two documents have been extracted via UiPath IXP. Produce a side-by-side comparison.

Return a JSON object EXACTLY in this shape — no markdown, no commentary:
{
  "summary": "3-5 sentence executive summary of how the two documents compare",
  "verdict": "match | minor-differences | significant-differences | mismatch",
  "verdictReason": "1 sentence explaining the verdict",
  "fieldDiff": [
    { "label": "field name", "a": "value in A or null", "b": "value in B or null", "status": "same | changed | only-in-a | only-in-b", "note": "optional 1 line note" }
  ],
  "commonalities": ["bullet 1", "bullet 2"],
  "differences": ["bullet 1", "bullet 2"],
  "recommendation": "1-2 sentence action / next step"
}

Match fields by label. Include EVERY field from A and B. status = "same" if values equal (whitespace-insensitive), "changed" if both present but differ, "only-in-a"/"only-in-b" if one is missing.

DOCUMENT_A:
${JSON.stringify(ctxA, null, 2)}

DOCUMENT_B:
${JSON.stringify(ctxB, null, 2)}`;

    try {
      const reply = await callLLM({
        provider: modelSettings.provider,
        endpoint: modelSettings.endpoint,
        apiKey: modelSettings.apiKey,
        model: modelSettings.model,
        system,
        messages: [{ role: 'user', content: 'Compare the two documents and return the JSON object as specified.' }],
        maxTokens: 3072,
        expectJson: true,
      });
      const parsed = extractJsonFromText(reply);
      if (!parsed) throw new Error('Model did not return valid JSON. Raw: ' + reply.slice(0, 200));
      setComparison(parsed);
      toast.push({ kind: 'ok', title: 'Comparison ready', sub: parsed.verdict, ttl: 2400 });
    } catch (err) {
      setCompareError(String(err.message || err));
      toast.push({ kind: 'bad', title: 'Comparison failed', sub: String(err.message || err).slice(0, 120), ttl: 4200 });
    } finally {
      setComparing(false);
    }
  };

  const reset = () => {
    setSlots({
      a: { file: null, results: null, status: 'idle', step: null, error: null },
      b: { file: null, results: null, status: 'idle', step: null, error: null },
    });
    setComparison(null);
    setCompareError(null);
  };

  return (
    <div>
      <div className="compare-banner">
        <div className="db-icon"><Icon name="info" size={14} /></div>
        <div className="db-text">
          <strong>Compare two documents</strong>
          <span>Upload Doc A and Doc B. Both run through IXP, then your configured model produces a side-by-side diff with a verdict.</span>
        </div>
      </div>

      <div className="compare-grid">
        <DropSlot slot="a" data={slots.a} onFile={(f) => acceptFile('a', f)} />
        <CompareDivider />
        <DropSlot slot="b" data={slots.b} onFile={(f) => acceptFile('b', f)} />
      </div>

      <div className="compare-actions">
        <button className="btn" onClick={reset} disabled={!slots.a.file && !slots.b.file}>
          <Icon name="reset" size={13} />Clear
        </button>
        <button className="btn btn-primary" onClick={runCompare} disabled={!bothReady || comparing}>
          {comparing ? <><span className="spinner"></span>Comparing…</> : <><Icon name="sparkle" size={13} />Compare documents</>}
        </button>
      </div>

      {compareError && (
        <div className="analyse-error" style={{ marginTop: 16 }}>
          <Icon name="alert" size={18} />
          <div>
            <strong>Comparison failed</strong>
            <pre>{compareError}</pre>
          </div>
        </div>
      )}

      {comparison && (
        <CompareResults a={slots.a.results} b={slots.b.results} comparison={comparison} toast={toast} />
      )}
    </div>
  );
}

function DropSlot({ slot, data, onFile }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  if (data.status === 'idle') {
    return (
      <div
        className={`drop-slot ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0]); }}
        onClick={() => fileRef.current?.click()}
      >
        <div className="ds-letter">{slot.toUpperCase()}</div>
        <div className="ds-icon"><Icon name="upload" size={20} /></div>
        <div className="ds-title">{SLOT_TITLES[slot]}</div>
        <div className="ds-sub">Drop PDF here or click to choose</div>
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" style={{ display: 'none' }}
          onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    );
  }

  return (
    <div className="drop-slot drop-slot-filled">
      <div className="ds-letter">{slot.toUpperCase()}</div>
      <div className="ds-thumb">
        <div className="dst-page"></div>
      </div>
      <div className="ds-name" title={data.file.name}>{data.file.name}</div>
      {data.status === 'processing' && (
        <div className="ds-status">
          <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--accent)' }}></span>
          <span>{data.step ? `Step: ${data.step}…` : 'Extracting…'}</span>
        </div>
      )}
      {data.status === 'error' && (
        <div className="ds-status" style={{ color: 'var(--bad)' }}>
          <Icon name="alert" size={14} />
          <span>{(data.error || 'Failed').slice(0, 60)}</span>
        </div>
      )}
      {data.status === 'done' && (
        <div className="ds-status ok">
          <Icon name="check-circle" size={14} />
          <span>{data.results.fields.length} fields · {data.results.lineItems.length} items · {data.results.documentMeta.pages}p</span>
        </div>
      )}
    </div>
  );
}

function CompareDivider() {
  return (
    <div className="compare-divider">
      <div className="cd-line"></div>
      <div className="cd-circle">VS</div>
      <div className="cd-line"></div>
    </div>
  );
}

const VERDICT_STYLE = {
  'match': { label: 'Documents match', color: 'var(--ok)', soft: 'var(--ok-soft)' },
  'minor-differences': { label: 'Minor differences', color: 'oklch(60% 0.13 75)', soft: 'var(--warn-soft)' },
  'significant-differences': { label: 'Significant differences', color: 'var(--bad)', soft: 'var(--bad-soft)' },
  'mismatch': { label: 'Mismatch', color: 'var(--bad)', soft: 'var(--bad-soft)' },
};

function CompareResults({ a, b, comparison, toast }) {
  const v = VERDICT_STYLE[comparison.verdict] || VERDICT_STYLE['minor-differences'];

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ comparison, docA: a.documentMeta, docB: b.documentMeta }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comparison-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast.push({ kind: 'ok', title: 'Comparison downloaded', ttl: 2200 });
  };

  return (
    <div className="compare-results">
      <div className="cr-verdict-card" style={{ background: v.soft, borderColor: v.color }}>
        <div className="cr-verdict-left">
          <div className="cr-verdict-pill" style={{ background: v.color }}>{v.label}</div>
          <h3>Comparison summary</h3>
          <p>{comparison.summary}</p>
          {comparison.verdictReason && <div className="cr-reason"><strong>Why:</strong> {comparison.verdictReason}</div>}
        </div>
        <div className="cr-verdict-actions">
          <button className="btn btn-sm" onClick={downloadJson}><Icon name="download" size={13} />Download</button>
          <button className="btn btn-sm" onClick={() => {
            navigator.clipboard?.writeText(JSON.stringify(comparison, null, 2));
            toast.push({ kind: 'ok', title: 'JSON copied', ttl: 2000 });
          }}><Icon name="copy" size={13} />Copy</button>
        </div>
      </div>

      <div className="cr-twocol">
        <CrPanel title="In common" items={comparison.commonalities} kind="ok" />
        <CrPanel title="Differences" items={comparison.differences} kind="warn" />
      </div>

      {comparison.fieldDiff && comparison.fieldDiff.length > 0 && (
        <div className="results-card" style={{ marginTop: 16 }}>
          <div className="results-card-hd">
            <h3><Icon name="table" size={14} />Field-by-field diff</h3>
            <div className="count-pill">{comparison.fieldDiff.length} fields</div>
          </div>
          <div className="lineitems-wrap">
            <table className="lineitems diff-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Doc A</th>
                  <th>Doc B</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {comparison.fieldDiff.map((row, i) => (
                  <tr key={i} className={`diff-row diff-${row.status}`}>
                    <td className="li-desc">{row.label}</td>
                    <td className="mono">{row.a ?? <span className="dim">—</span>}</td>
                    <td className="mono">{row.b ?? <span className="dim">—</span>}</td>
                    <td><DiffBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {comparison.recommendation && (
        <div className="cr-reco">
          <Icon name="info" size={16} />
          <div><strong>Recommendation:</strong> {comparison.recommendation}</div>
        </div>
      )}
    </div>
  );
}

function CrPanel({ title, items, kind }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="cr-panel">
      <div className={`cr-panel-hd ${kind}`}>{title}</div>
      <ul className="cr-list">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function DiffBadge({ status }) {
  const map = {
    'same':       { label: 'same',       cls: 'diff-same' },
    'changed':    { label: 'changed',    cls: 'diff-changed' },
    'only-in-a':  { label: 'only in A',  cls: 'diff-only-a' },
    'only-in-b':  { label: 'only in B',  cls: 'diff-only-b' },
  };
  const m = map[status] || { label: status, cls: '' };
  return <span className={`diff-badge ${m.cls}`}>{m.label}</span>;
}

function compactCtx(results) {
  return {
    docType: results.docType,
    document: results.documentMeta,
    fields: results.fields.map((f) => ({ label: f.label, value: f.value, page: f.page })),
    lineItems: results.lineItems.map((l) => ({ sku: l.sku, description: l.description, qty: l.qty, unitPrice: l.unitPrice, total: l.total })),
    totals: results.lineItemTotals,
  };
}
