// Results view — header fields + line items + page-aware inspector
import React, { useState, useMemo } from 'react';
import { Icon } from './icons.jsx';

const confidenceLevel = (c) => c >= 0.9 ? 'high' : c >= 0.75 ? 'med' : 'low';
const confLabel = (c) => `${Math.round(c * 100)}%`;

function ConfBadge({ value }) {
  const lvl = confidenceLevel(value);
  return <span className={`conf ${lvl}`}>{confLabel(value)}</span>;
}

function FieldCard({ field, selected, onSelect }) {
  return (
    <button className={`field-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(field)}>
      <div className="fc-label">{field.label}</div>
      <div className={`fc-value ${/^[\$\-\d,\.]+$|^[A-Z0-9\-\*]+$/.test(field.value) || field.label.toLowerCase().includes('id') || field.label.toLowerCase().includes('number') || field.label.toLowerCase().includes('account') ? 'mono' : ''}`}>
        {field.value}
      </div>
      <div className="fc-meta">
        <ConfBadge value={field.confidence} />
        <span className="page-ref">p.{field.page}</span>
      </div>
    </button>
  );
}

function Inspector({ field, results }) {
  if (!field) {
    return (
      <div className="inspector">
        <div className="inspector-hd">
          <h3>Field inspector</h3>
          <p>Tap any field or line item to inspect its source.</p>
        </div>
        <div className="insp-empty">
          <div className="ie-icon"><Icon name="pin" size={18} /></div>
          <p>Nothing selected yet.</p>
        </div>
      </div>
    );
  }

  const snippetWithMark = field.snippet ? field.snippet.replace(/\[([^\]]+)\]/g, '$1') : '';

  return (
    <div className="inspector">
      <div className="inspector-hd">
        <h3>{field.label}</h3>
        <p>Extracted from page {field.page} · {field.docType ? 'line item detail' : 'header field'}</p>
      </div>
      <div className="inspector-body">
        <div className="insp-block">
          <div className="insp-label">Extracted value</div>
          <div className="insp-value">{field.value}</div>
        </div>

        <div className="insp-block">
          <div className="insp-label">Source context</div>
          <div className="snippet">
            {snippetWithMark.split(/([^]+)/g).map((part, i) => {
              if (part.startsWith('')) {
                return <mark key={i}>{part.slice(1, -1)}</mark>;
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        </div>

        <div className="insp-block">
          <div className="insp-label">Metadata</div>
          <div className="insp-row"><span className="ir-key">Page</span><span className="ir-val">{field.page} / {results.documentMeta.pages}</span></div>
          <div className="insp-row"><span className="ir-key">Bounding box</span><span className="ir-val">{field.bbox || '—'}</span></div>
          <div className="insp-row"><span className="ir-key">Confidence</span><span className="ir-val">{(field.confidence * 100).toFixed(1)}%</span></div>
          <div className="insp-row"><span className="ir-key">Field ID</span><span className="ir-val">{field.id}</span></div>
        </div>
      </div>
    </div>
  );
}

function LineItemsTable({ items, docType, onSelectItem, selectedId, pageFilter }) {
  const filtered = pageFilter ? items.filter((i) => i.page === pageFilter) : items;
  const isStatement = docType === 'Bank Statement';
  const isInsurance = docType === 'Insurance Policy';

  if (items.length === 0) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
      No line items in this document.
    </div>;
  }
  if (filtered.length === 0) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
      No line items on page {pageFilter}.
    </div>;
  }

  const fmtMoney = (n) => `$${Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sumTotal = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  return (
    <div className="lineitems-wrap">
      <table className="lineitems">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>{isStatement ? 'Date' : isInsurance ? 'Code' : 'SKU'}</th>
            <th>Description</th>
            {!isStatement && !isInsurance && <th className="num">Qty</th>}
            {!isStatement && !isInsurance && <th>Unit</th>}
            <th className="num">{isStatement ? 'Amount' : 'Unit price'}</th>
            {!isStatement && <th className="num">Total</th>}
            <th>Page</th>
            <th>Conf.</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((it, idx) =>
            <tr key={it.id}
              onClick={() => onSelectItem(it)}
              style={{ cursor: 'pointer', background: selectedId === it.id ? 'var(--accent-soft)' : undefined }}>
              <td className="num" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
              <td className="mono">{it.sku}</td>
              <td className="li-desc">
                {it.description}
                {it.subDesc && <div className="li-sub">{it.subDesc}</div>}
              </td>
              {!isStatement && !isInsurance && <td className="num">{it.qty}</td>}
              {!isStatement && !isInsurance && <td className="mono" style={{ color: 'var(--text-3)' }}>{it.unit}</td>}
              <td className="num" style={{ color: (Number(it.unitPrice) || 0) < 0 ? 'var(--bad)' : undefined }}>
                {(Number(it.unitPrice) || 0) < 0 ? '-' : ''}{fmtMoney(it.unitPrice)}
              </td>
              {!isStatement && <td className="num">{fmtMoney(it.total)}</td>}
              <td className="mono" style={{ color: 'var(--text-3)', fontSize: 11.5 }}>p.{it.page}</td>
              <td><ConfBadge value={it.confidence} /></td>
            </tr>
          )}
        </tbody>
        {!pageFilter &&
          <tfoot>
            <tr>
              <td colSpan={isStatement ? 3 : isInsurance ? 3 : 5}>
                {isStatement ? 'Net change' : isInsurance ? 'Aggregate coverage' : 'Subtotal'}
              </td>
              {isStatement && <td className="num" style={{ color: sumTotal < 0 ? 'var(--bad)' : undefined }}>
                {sumTotal < 0 ? '-' : ''}{fmtMoney(sumTotal)}
              </td>}
              {!isStatement && <td className="num"></td>}
              {!isStatement && <td className="num">{fmtMoney(sumTotal)}</td>}
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        }
      </table>
    </div>
  );
}

export function Results({ results, file, onReset, toast }) {
  const [tab, setTab] = useState('fields');
  const [selectedField, setSelectedField] = useState(results.fields[0] || null);
  const [pageFilter, setPageFilter] = useState(null);

  const pagesWithData = useMemo(() => {
    const all = new Set();
    results.fields.forEach((f) => all.add(f.page));
    results.lineItems.forEach((l) => all.add(l.page));
    return all;
  }, [results]);
  const pages = useMemo(() => Array.from({ length: results.documentMeta.pages }, (_, i) => i + 1), [results.documentMeta.pages]);

  const visibleFields = pageFilter ? results.fields.filter((f) => f.page === pageFilter) : results.fields;

  const copyJson = () => {
    const payload = { documentMeta: results.documentMeta, docType: results.docType, fields: results.fields, lineItems: results.lineItems };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    toast.push({ kind: 'ok', title: 'JSON copied', sub: `${results.fields.length + results.lineItems.length} entries`, ttl: 2200 });
  };

  const downloadJson = () => {
    const payload = { documentMeta: results.documentMeta, docType: results.docType, fields: results.fields, lineItems: results.lineItems };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${results.documentMeta.filename.replace(/\.[^.]+$/, '')}-extraction.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.push({ kind: 'ok', title: 'JSON downloaded', sub: a.download, ttl: 2400 });
  };

  const downloadCsv = () => {
    const headers = ['#', 'sku/date', 'description', 'qty', 'unit', 'unit_price', 'total', 'page', 'confidence'];
    const rows = results.lineItems.map((it, i) => [i + 1, it.sku, `"${it.description}${it.subDesc ? ' — ' + it.subDesc : ''}"`, it.qty, it.unit, it.unitPrice, it.total, it.page, it.confidence]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${results.documentMeta.filename.replace(/\.[^.]+$/, '')}-lineitems.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.push({ kind: 'ok', title: 'CSV downloaded', sub: a.download, ttl: 2400 });
  };

  const avgConf = results.fields.length
    ? Math.round(results.fields.reduce((s, f) => s + f.confidence, 0) / results.fields.length * 100)
    : 0;

  return (
    <div>
      <div className="results-hd">
        <div className="rh-text">
          <h2>{results.docType} · extracted</h2>
          <p>{file?.name || results.documentMeta.filename} processed in {results.documentMeta.processedMs} ms</p>
        </div>
        <div className="rh-actions">
          <button className="btn" onClick={copyJson}><Icon name="copy" size={13} />Copy JSON</button>
          <button className="btn" onClick={downloadCsv}><Icon name="download" size={13} />CSV</button>
          <button className="btn" onClick={downloadJson}><Icon name="download" size={13} />JSON</button>
          <button className="btn" onClick={onReset}><Icon name="reset" size={13} />New document</button>
        </div>
      </div>

      <div className="doc-meta-strip">
        <div className="dms-cell">
          <div className="dms-label">Document</div>
          <div className="dms-value mono">{results.documentMeta.filename}</div>
        </div>
        <div className="dms-cell">
          <div className="dms-label">Pages</div>
          <div className="dms-value">{results.documentMeta.pages}</div>
        </div>
        <div className="dms-cell">
          <div className="dms-label">Fields</div>
          <div className="dms-value">{results.fields.length} <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 12 }}>extracted</span></div>
        </div>
        <div className="dms-cell">
          <div className="dms-label">Line items</div>
          <div className="dms-value">{results.lineItems.length} <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 12 }}>parsed</span></div>
        </div>
        <div className="dms-cell">
          <div className="dms-label">Avg confidence</div>
          <div className="dms-value">{avgConf}%</div>
        </div>
      </div>

      <div className="results-grid">
        <div className="results-card">
          <div className="results-card-hd">
            <div className="tabs">
              <button className={tab === 'fields' ? 'active' : ''} onClick={() => setTab('fields')}>
                <Icon name="list" size={13} />Fields <span className="tab-count">{results.fields.length}</span>
              </button>
              <button className={tab === 'items' ? 'active' : ''} onClick={() => setTab('items')}>
                <Icon name="table" size={13} />Line items <span className="tab-count">{results.lineItems.length}</span>
              </button>
              <button className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>
                <Icon name="code" size={13} />JSON
              </button>
            </div>
            {tab !== 'json' &&
              <div className="count-pill">
                {pageFilter ? `page ${pageFilter}` : `${results.documentMeta.pages} pages`}
              </div>
            }
          </div>

          {tab !== 'json' &&
            <div className="page-chips">
              <span className="pc-label">Pages</span>
              <button className={`page-chip ${pageFilter === null ? 'active' : ''}`} onClick={() => setPageFilter(null)}>All {results.documentMeta.pages}</button>
              {pages.map((p) => {
                const hasData = pagesWithData.has(p);
                return (
                  <button key={p}
                    className={`page-chip ${pageFilter === p ? 'active' : ''} ${!hasData ? 'is-empty' : ''}`}
                    onClick={() => setPageFilter(p)}
                    title={hasData ? `Page ${p}` : `Page ${p} · no fields extracted`}>
                    p.{p}{!hasData && <span className="pc-empty-dot">·</span>}
                  </button>
                );
              })}
            </div>
          }

          {tab === 'fields' &&
            <div className="fields-list">
              {visibleFields.length === 0 ?
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, gridColumn: '1/-1' }}>
                  No header fields {pageFilter ? `on page ${pageFilter}` : 'extracted'}.
                </div> :
                visibleFields.map((f) =>
                  <FieldCard key={f.id} field={f} selected={selectedField?.id === f.id} onSelect={setSelectedField} />
                )}
            </div>
          }

          {tab === 'items' &&
            <LineItemsTable
              items={results.lineItems}
              docType={results.docType}
              pageFilter={pageFilter}
              onSelectItem={(it) => setSelectedField({
                ...it,
                label: it.description,
                value: `${it.qty || ''} ${it.unit || ''} · $${Math.abs(Number(it.unitPrice) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`.trim(),
                snippet: `${it.sku}  [${it.description}]\n${it.subDesc || ''}\nPage ${it.page}`,
                bbox: `row · p.${it.page}`,
                docType: 'lineitem',
              })}
              selectedId={selectedField?.id} />
          }

          {tab === 'json' &&
            <pre style={{
              margin: 0,
              padding: '18px 20px',
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              lineHeight: 1.55,
              color: 'var(--text-2)',
              background: 'var(--surface-2)',
              maxHeight: 560,
              overflow: 'auto'
            }}>
{JSON.stringify({ documentMeta: results.documentMeta, docType: results.docType, fields: results.fields, lineItems: results.lineItems }, null, 2)}
            </pre>
          }
        </div>

        <Inspector field={selectedField} results={results} />
      </div>
    </div>
  );
}
