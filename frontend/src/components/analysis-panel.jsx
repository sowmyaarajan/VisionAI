// Analysis panel — sits below extraction results.
// Has: chat with suggested chips, "Run full analysis" button → popup
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { callLLM, extractJsonFromText, MODEL_PROVIDERS } from '../api/llm.js';

const SUGGESTED_QUESTIONS = {
  invoice: [
    'What is the total amount due?',
    'List all line items grouped by category.',
    'Are there any unusual or unexpected charges?',
    'When is payment due and what are the terms?'],

  statement: [
    'What is the net change for this period?',
    'Identify the largest debit and credit.',
    'Are there any recurring payments?',
    'Any suspicious transactions?'],

  insurance: [
    'What perils are covered and excluded?',
    'When does the policy expire and how do I renew?',
    'What is the total annual premium and deductible?',
    'List endorsements or special conditions.'],

  generic: [
    'Give me a one-paragraph summary.',
    'What are the most important numbers?',
    'Who are the parties involved?',
    'Are there dates I should remember?']
};

function suggestedFor(docType) {
  const t = (docType || '').toLowerCase();
  if (t.includes('invoice')) return SUGGESTED_QUESTIONS.invoice;
  if (t.includes('statement')) return SUGGESTED_QUESTIONS.statement;
  if (t.includes('insurance') || t.includes('policy')) return SUGGESTED_QUESTIONS.insurance;
  return SUGGESTED_QUESTIONS.generic;
}

function buildDocContext(results) {
  return {
    docType: results.docType,
    document: results.documentMeta,
    fields: results.fields.map((f) => ({ label: f.label, value: f.value, page: f.page, confidence: f.confidence })),
    lineItems: results.lineItems.map((l) => ({ sku: l.sku, description: l.description, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, total: l.total, page: l.page })),
    lineItemTotals: results.lineItemTotals,
    tables: results.tables || [],
  };
}

export function AnalysisPanel({ results, modelSettings, onConfigureModel, toast }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyseOpen, setAnalyseOpen] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const modelConfigured = !!(modelSettings.provider && (modelSettings.provider === 'ollama' || modelSettings.apiKey));

  const ask = async (question) => {
    if (!modelConfigured) {
      toast.push({ kind: 'bad', title: 'Configure model first', sub: 'Open Model settings to add your endpoint and API key.', ttl: 3600 });
      onConfigureModel();
      return;
    }
    if (!question.trim()) return;
    const userMsg = { role: 'user', content: question };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setBusy(true);

    const ctx = buildDocContext(results);
    const system = `You are an expert document analyst. The user has uploaded a ${results.docType} and the structured extraction is provided below as JSON. Answer the user's question accurately and concisely, citing field values and page numbers when relevant. If the answer is not in the data, say so.

DOCUMENT_DATA:
${JSON.stringify(ctx, null, 2)}`;

    try {
      const reply = await callLLM({
        provider: modelSettings.provider,
        endpoint: modelSettings.endpoint,
        apiKey: modelSettings.apiKey,
        model: modelSettings.model,
        system,
        messages: history,
        maxTokens: 1024,
      });
      setMessages([...history, { role: 'assistant', content: reply || '(no response)' }]);
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: '', error: String(err.message || err) }]);
      toast.push({ kind: 'bad', title: 'Model call failed', sub: String(err.message || err).slice(0, 120), ttl: 4200 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="analysis-panel">
      <div className="ap-hd">
        <div className="ap-hd-icon"><Icon name="brain" size={18} /></div>
        <div className="ap-hd-text">
          <h3>Ask &amp; Analyse</h3>
          <p>Bring your own model — Claude, GPT, OpenRouter, Gemini, Ollama, or any OpenAI-compatible endpoint.</p>
        </div>
        <div className="ap-hd-actions">
          <button className="btn btn-sm" onClick={onConfigureModel}>
            <Icon name="settings" size={13} />
            {modelConfigured ? 'Model: ' + (MODEL_PROVIDERS[modelSettings.provider]?.label.split(' ')[0] || 'configured') : 'Configure model'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setAnalyseOpen(true)} disabled={!modelConfigured}>
            <Icon name="sparkle" size={13} />Run full analysis
          </button>
        </div>
      </div>

      <div className="ap-body">
        <div className="chat-thread" ref={scrollRef}>
          {messages.length === 0 &&
            <div className="chat-empty">
              <Icon name="sparkle" size={20} />
              <div>
                <div className="ce-title">Ask anything about this {results.docType.toLowerCase()}</div>
                <div className="ce-sub">Your conversation runs against the structured fields shown above, sent to your configured model.</div>
              </div>
            </div>
          }
          {messages.map((m, i) =>
            <div key={i} className={`chat-msg ${m.role}`}>
              <div className="cm-avatar">
                {m.role === 'user' ? <Icon name="upload" size={13} stroke={2} style={{ transform: 'rotate(180deg)' }} /> : <Icon name="brain" size={13} />}
              </div>
              <div className="cm-bubble">
                {m.error ?
                  <div className="cm-error"><Icon name="alert" size={13} />{m.error.slice(0, 360)}</div> :
                  <div className="cm-text">{m.content}</div>}
              </div>
            </div>
          )}
          {busy &&
            <div className="chat-msg assistant">
              <div className="cm-avatar"><Icon name="brain" size={13} /></div>
              <div className="cm-bubble">
                <div className="typing"><span></span><span></span><span></span></div>
              </div>
            </div>
          }
        </div>

        <div className="chip-rail">
          {suggestedFor(results.docType).map((q, i) =>
            <button key={i} className="chip" onClick={() => ask(q)} disabled={busy}>{q}</button>
          )}
        </div>

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <input
            className="input"
            placeholder={modelConfigured ? `Ask about this ${results.docType.toLowerCase()}…` : 'Configure model to start asking questions'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy} />

          <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
            <Icon name="upload" size={13} stroke={2} style={{ transform: 'rotate(90deg)' }} />Send
          </button>
        </form>
      </div>

      {analyseOpen &&
        <AnalysePopup
          results={results}
          modelSettings={modelSettings}
          onClose={() => setAnalyseOpen(false)}
          toast={toast} />
      }
    </div>
  );
}

// ─── Analyse popup ───
const ANALYSIS_SECTIONS = [
  { key: 'summary', label: 'Main points / Summary', icon: 'sparkle' },
  { key: 'signatures', label: 'Signatures present', icon: 'pin' },
  { key: 'stamps', label: 'Stamps & seals detected', icon: 'check-circle' },
  { key: 'language', label: 'Language & document type', icon: 'doc' },
  { key: 'sensitive', label: 'Sensitive info (PII, SSN…)', icon: 'lock' },
  { key: 'anomalies', label: 'Anomalies & red flags', icon: 'alert' },
  { key: 'tables', label: 'Tables & charts inventory', icon: 'table' },
  { key: 'handwriting', label: 'Pages with images / handwriting', icon: 'scan' },
  { key: 'sentiment', label: 'Sentiment / tone', icon: 'brain' }
];

function AnalysePopup({ results, modelSettings, onClose, toast }) {
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { runAnalysis(); /* eslint-disable-next-line */ }, []);

  const runAnalysis = async () => {
    setBusy(true);
    setError(null);
    setAnalysis(null);

    const ctx = buildDocContext(results);
    const system = `You are an expert document analyst examining a ${results.docType}. The structured extraction is provided below.

Return a JSON object with EXACTLY these keys (no markdown, no explanation outside the JSON):
{
  "summary": "2–4 sentence executive summary",
  "signatures": [{ "who": "name or role", "page": number, "location": "where on page" }],
  "stamps": [{ "kind": "stamp/seal description", "page": number }],
  "language": { "primary": "English / etc", "docType": "confirmed type", "confidence": "high/medium/low" },
  "sensitive": [{ "kind": "SSN/account/PII/etc", "value": "redacted or location", "page": number }],
  "anomalies": [{ "issue": "what's odd", "severity": "low/med/high", "page": number }],
  "tables": [{ "name": "table description", "page": number, "rows": number }],
  "handwriting": [{ "kind": "handwriting/image/chart", "page": number, "note": "what it is" }],
  "sentiment": { "tone": "neutral/formal/urgent/etc", "notes": "1 sentence" }
}

If a section is empty or N/A, return an empty array [] or "N/A". Always return valid JSON.

DOCUMENT_DATA:
${JSON.stringify(ctx, null, 2)}`;

    try {
      const reply = await callLLM({
        provider: modelSettings.provider,
        endpoint: modelSettings.endpoint,
        apiKey: modelSettings.apiKey,
        model: modelSettings.model,
        system,
        messages: [{ role: 'user', content: 'Analyse the document and return the JSON object as specified.' }],
        maxTokens: 2048,
        expectJson: true,
      });
      const parsed = extractJsonFromText(reply);
      if (!parsed) throw new Error('Model did not return valid JSON. Raw response: ' + reply.slice(0, 200));
      setAnalysis(parsed);
    } catch (err) {
      setError(String(err.message || err));
      toast.push({ kind: 'bad', title: 'Analysis failed', sub: String(err.message || err).slice(0, 120), ttl: 4200 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-hd">
          <div className="mh-text">
            <h2>Document analysis</h2>
            <p>{results.documentMeta.filename} · {results.documentMeta.pages} pages · model {MODEL_PROVIDERS[modelSettings.provider]?.label}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={runAnalysis} disabled={busy}>
              <Icon name="reset" size={13} />Re-run
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body analyse-body">
          {busy &&
            <div className="analyse-loading">
              <div className="al-spinner"></div>
              <div>
                <div className="al-title">Analysing document with {MODEL_PROVIDERS[modelSettings.provider]?.label}…</div>
                <div className="al-sub">Looking for signatures, anomalies, PII, structure and tone.</div>
              </div>
            </div>
          }

          {error &&
            <div className="analyse-error">
              <Icon name="alert" size={18} />
              <div>
                <strong>Analysis failed</strong>
                <pre>{error}</pre>
              </div>
            </div>
          }

          {analysis &&
            <div className="analysis-grid">
              {ANALYSIS_SECTIONS.map((s) => {
                const v = analysis[s.key];
                return (
                  <div key={s.key} className="an-card">
                    <div className="an-card-hd">
                      <Icon name={s.icon} size={14} />
                      <span>{s.label}</span>
                    </div>
                    <div className="an-card-body">
                      <AnalysisSection sectionKey={s.key} value={v} totalPages={results.documentMeta.pages} />
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>

        {analysis &&
          <div className="modal-ft">
            <div className="test-status"><Icon name="check-circle" size={13} />Analysis complete</div>
            <button className="btn btn-sm" onClick={() => {
              navigator.clipboard?.writeText(JSON.stringify(analysis, null, 2));
              toast.push({ kind: 'ok', title: 'Analysis JSON copied', ttl: 2200 });
            }}><Icon name="copy" size={13} />Copy JSON</button>
          </div>
        }
      </div>
    </div>
  );
}

function AnalysisSection({ sectionKey, value, totalPages }) {
  if (value === null || value === undefined || value === 'N/A' || (Array.isArray(value) && value.length === 0)) {
    return <div className="an-empty">None detected</div>;
  }

  if (sectionKey === 'summary') {
    return <div className="an-prose">{value}</div>;
  }

  if (sectionKey === 'tables' && Array.isArray(value) && value.length > 0) {
    return <TablesChart tables={value} totalPages={totalPages} />;
  }

  if (sectionKey === 'language') {
    return (
      <div className="an-list">
        <div className="an-row"><span className="ar-k">Primary</span><span className="ar-v">{value.primary || '—'}</span></div>
        <div className="an-row"><span className="ar-k">Type</span><span className="ar-v">{value.docType || '—'}</span></div>
        <div className="an-row"><span className="ar-k">Confidence</span><span className="ar-v">{value.confidence || '—'}</span></div>
      </div>
    );
  }

  if (sectionKey === 'sentiment') {
    return (
      <div>
        <div className="an-pill">{value.tone || 'neutral'}</div>
        {value.notes && <div className="an-note">{value.notes}</div>}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="an-list">
        {value.map((item, i) =>
          <div key={i} className="an-item">
            <ItemLine sectionKey={sectionKey} item={item} />
          </div>
        )}
      </div>
    );
  }

  return <div className="an-prose">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</div>;
}

function ItemLine({ sectionKey, item }) {
  if (sectionKey === 'signatures') {
    return <>
      <div className="il-main">{item.who || 'Signature'}</div>
      <div className="il-meta">p.{item.page ?? '?'} · {item.location || '—'}</div>
    </>;
  }
  if (sectionKey === 'stamps') {
    return <>
      <div className="il-main">{item.kind || 'Stamp'}</div>
      <div className="il-meta">p.{item.page ?? '?'}</div>
    </>;
  }
  if (sectionKey === 'sensitive') {
    return <>
      <div className="il-main">{item.kind}</div>
      <div className="il-meta mono">{item.value || '—'} · p.{item.page ?? '?'}</div>
    </>;
  }
  if (sectionKey === 'anomalies') {
    return <>
      <div className="il-main">
        <span className={`an-severity sev-${item.severity || 'low'}`}>{item.severity || 'low'}</span>
        {item.issue}
      </div>
      <div className="il-meta">p.{item.page ?? '?'}</div>
    </>;
  }
  if (sectionKey === 'tables') {
    return <>
      <div className="il-main">{item.name || 'Table'}</div>
      <div className="il-meta">p.{item.page ?? '?'} · {item.rows ?? '?'} rows</div>
    </>;
  }
  if (sectionKey === 'handwriting') {
    return <>
      <div className="il-main">{item.kind || 'Marking'}</div>
      <div className="il-meta">p.{item.page ?? '?'} · {item.note || '—'}</div>
    </>;
  }
  return <div className="il-main">{JSON.stringify(item)}</div>;
}

// ─── Graphical tables view ───
function TablesChart({ tables, totalPages }) {
  const [view, setView] = useState('graphs');

  const maxRows = Math.max(...tables.map((t) => Number(t.rows) || 1), 1);
  const totalRows = tables.reduce((s, t) => s + (Number(t.rows) || 0), 0);
  const pagesWithTables = new Set(tables.map((t) => t.page).filter(Boolean));

  return (
    <div className="tables-chart">
      <div className="tc-toggle">
        <button className={view === 'graphs' ? 'active' : ''} onClick={() => setView('graphs')}>
          <Icon name="sparkle" size={11} />Graphs
        </button>
        <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
          <Icon name="table" size={11} />Table
        </button>
      </div>

      <div className="tc-summary">
        <div className="tc-stat">
          <div className="tc-stat-v">{tables.length}</div>
          <div className="tc-stat-l">tables</div>
        </div>
        <div className="tc-stat">
          <div className="tc-stat-v">{totalRows || '—'}</div>
          <div className="tc-stat-l">total rows</div>
        </div>
        <div className="tc-stat">
          <div className="tc-stat-v">{pagesWithTables.size}</div>
          <div className="tc-stat-l">pages</div>
        </div>
      </div>

      {view === 'graphs' && (
        <>
          <div className="tc-section">
            <div className="tc-section-hd">Rows per table</div>
            <div className="tc-bars">
              {tables.map((t, i) => {
                const rows = Number(t.rows) || 0;
                const pct = rows > 0 ? Math.max(rows / maxRows * 100, 6) : 6;
                return (
                  <div key={i} className="tc-bar-row">
                    <div className="tc-bar-label" title={t.name}>
                      <div className="tc-bar-name">{t.name || `Table ${i + 1}`}</div>
                      <div className="tc-bar-page">p.{t.page ?? '?'}</div>
                    </div>
                    <div className="tc-bar-wrap">
                      <div className="tc-bar-fill" style={{ width: pct + '%' }}></div>
                      <div className="tc-bar-count">{rows > 0 ? `${rows} rows` : '— rows'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalRows > 0 && tables.length > 1 && (
            <div className="tc-section tc-twocol">
              <div className="tc-subcard">
                <div className="tc-section-hd">Share of rows</div>
                <TablesDonut tables={tables} total={totalRows} />
              </div>
              <div className="tc-subcard">
                <div className="tc-section-hd">Distribution by page</div>
                <PageDistChart tables={tables} totalPages={totalPages} />
              </div>
            </div>
          )}
        </>
      )}

      {view === 'table' && (
        <div className="tc-section">
          <table className="tc-data-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Table</th>
                <th style={{ width: 60 }}>Page</th>
                <th style={{ width: 70, textAlign: 'right' }}>Rows</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t, i) => (
                <tr key={i}>
                  <td className="dim mono">{i + 1}</td>
                  <td>{t.name || `Table ${i + 1}`}</td>
                  <td className="mono dim">p.{t.page ?? '?'}</td>
                  <td className="num mono">{Number(t.rows) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TablesDonut({ tables, total }) {
  if (!total) return null;
  const palette = [
    'var(--accent)',
    'oklch(60% 0.13 150)',
    'oklch(60% 0.14 220)',
    'oklch(60% 0.13 280)',
    'oklch(68% 0.14 60)',
    'oklch(60% 0.16 350)',
    'oklch(55% 0.12 195)',
  ];
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = tables.map((t, i) => {
    const rows = Number(t.rows) || 0;
    const share = rows / total;
    const seg = c * share;
    const node = (
      <circle key={i} cx="50" cy="50" r={r} fill="none"
        stroke={palette[i % palette.length]}
        strokeWidth="14"
        strokeDasharray={`${seg.toFixed(2)} ${(c - seg).toFixed(2)}`}
        strokeDashoffset={(-offset).toFixed(2)}
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 0.4s ease' }} />
    );
    offset += seg;
    return node;
  });
  return (
    <div className="tc-donut-wrap">
      <svg viewBox="0 0 100 100" className="tc-donut">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
        {segments}
        <text x="50" y="49" textAnchor="middle" className="tc-donut-num">{total}</text>
        <text x="50" y="61" textAnchor="middle" className="tc-donut-lbl">rows</text>
      </svg>
      <div className="tc-legend">
        {tables.map((t, i) => (
          <div key={i} className="tc-legend-row">
            <span className="tc-legend-sw" style={{ background: palette[i % palette.length] }}></span>
            <span className="tc-legend-name">{t.name || `Table ${i + 1}`}</span>
            <span className="tc-legend-val">{Math.round(((Number(t.rows) || 0) / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageDistChart({ tables, totalPages }) {
  const counts = {};
  tables.forEach((t) => { if (t.page) counts[t.page] = (counts[t.page] || 0) + 1; });
  const maxP = totalPages || Math.max(...Object.keys(counts).map((k) => +k), 1);
  const maxCount = Math.max(...Object.values(counts), 1);
  const pages = Array.from({ length: maxP }, (_, i) => i + 1);
  return (
    <div className="tc-pagedist">
      <div className="tc-pagedist-bars">
        {pages.map((p) => {
          const ct = counts[p] || 0;
          const h = ct > 0 ? Math.max((ct / maxCount) * 100, 18) : 6;
          return (
            <div key={p} className={`tc-pdbar ${ct > 0 ? 'active' : ''}`} title={`Page ${p} · ${ct} table${ct === 1 ? '' : 's'}`}>
              <div className="tc-pdbar-fill" style={{ height: h + '%' }}>
                {ct > 0 && <span className="tc-pdbar-num">{ct}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="tc-pagedist-axis">
        <span>1</span>
        <span style={{ flex: 1 }}></span>
        <span>{maxP}</span>
      </div>
    </div>
  );
}
