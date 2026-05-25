// 6-step pipeline timeline — driven by real SSE events from /api/extract
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';
import { extractDocument } from '../api/ixp.js';

const PIPELINE_STEPS = [
  { key: 'auth',     title: 'Authenticate with UiPath Cloud',  meta: 'POST /identity_/connect/token' },
  { key: 'digitize', title: 'Upload & digitize document',       meta: 'POST /du_/api/framework/projects/.../digitization' },
  { key: 'project',  title: 'Locate IXP project',                meta: 'GET  /du_/api/framework/projects' },
  { key: 'extractor',title: 'Fetch latest extractor',            meta: 'GET  /du_/api/framework/projects/.../extractors' },
  { key: 'extract',  title: 'Run extraction',                     meta: 'POST /du_/api/framework/projects/.../extraction' },
  { key: 'parse',    title: 'Parse & structure results',          meta: 'Mapping fields, line items, confidence' },
];

const STEP_INDEX = Object.fromEntries(PIPELINE_STEPS.map((s, i) => [s.key, i]));

export function Pipeline({ file, settings, onDone, onCancel, toast }) {
  const [current, setCurrent] = useState(0);
  const [stepStart, setStepStart] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [stepDurations, setStepDurations] = useState({});
  const [stepDetail, setStepDetail] = useState({});
  const [errorStep, setErrorStep] = useState(null);
  const startedAt = useRef(Date.now());
  const cancelled = useRef(false);
  const lastToastedStep = useRef(null);

  useEffect(() => {
    cancelled.current = false;

    (async () => {
      try {
        await extractDocument(file, settings, (evt) => {
          if (cancelled.current) return;

          if (evt.kind === 'step') {
            const { step, status, detail, ms } = evt.data;
            const idx = STEP_INDEX[step] ?? 0;

            if (status === 'active') {
              setCurrent(idx);
              setStepStart(Date.now());
              setStepDetail((d) => ({ ...d, [step]: detail }));
              const s = PIPELINE_STEPS[idx];
              if (lastToastedStep.current !== step) {
                lastToastedStep.current = step;
                toast.push({ kind: 'info', title: s.title, sub: detail || s.meta, ttl: 2200 });
              }
            } else if (status === 'done') {
              setStepDurations((d) => ({ ...d, [step]: ms }));
              setStepDetail((d) => ({ ...d, [step]: detail || d[step] }));
            } else if (status === 'error') {
              setErrorStep({ step, detail, ms });
              toast.push({ kind: 'bad', title: `Step "${step}" failed`, sub: String(detail || '').slice(0, 220), ttl: 5200 });
            }
          } else if (evt.kind === 'result') {
            onDone(evt.data);
          } else if (evt.kind === 'error') {
            setErrorStep({ step: 'pipeline', detail: evt.data?.message || 'Pipeline failed' });
            toast.push({ kind: 'bad', title: 'Extraction failed', sub: String(evt.data?.message || '').slice(0, 220), ttl: 5200 });
          } else if (evt.kind === 'done') {
            const total = evt.data?.ms ?? (Date.now() - startedAt.current);
            toast.push({ kind: 'ok', title: 'Extraction complete', sub: `${total} ms · 6 steps`, ttl: 3000 });
          }
        });
      } catch (err) {
        if (cancelled.current) return;
        setErrorStep({ step: 'network', detail: String(err.message || err) });
        toast.push({ kind: 'bad', title: 'Backend unreachable', sub: String(err.message || err).slice(0, 220), ttl: 5400 });
      }
    })();

    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pipeline">
      <div className="pipeline-hd">
        <div>
          <h2>Extracting document</h2>
          <p>Running the IXP pipeline against UiPath. This usually takes a few seconds per page.</p>
        </div>
        <div className="doc-chip" title={file.name}>
          <div className="dc-thumb"></div>
          <div className="dc-meta">
            <div className="dc-name" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
            <div className="dc-info">{(file.size / 1024).toFixed(0)} KB · {file.type.split('/')[1]?.toUpperCase() || 'PDF'}</div>
          </div>
        </div>
      </div>

      <div className="timeline">
        {PIPELINE_STEPS.map((step, idx) => {
          const isError = errorStep && errorStep.step === step.key;
          const state = isError ? 'error' : (idx < current ? 'done' : idx === current ? 'active' : 'pending');
          const took = stepDurations[step.key];
          return (
            <div key={step.key} className={`tl-step ${state}`}>
              <div className="tl-dot">
                {state === 'done' && <Icon name="check" size={16} stroke={2.5} />}
                {state === 'active' && <span className="spinner"></span>}
                {state === 'pending' && (idx + 1)}
                {state === 'error' && <Icon name="alert" size={14} />}
              </div>
              <div className="tl-body">
                <div className="tl-title">{step.title}</div>
                <div className="tl-meta">{stepDetail[step.key] || step.meta}</div>
              </div>
              <div className="tl-time">
                {took != null ? `${took} ms` : state === 'active' ? `${Date.now() - stepStart} ms` : '—'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pipeline-ft">
        <div className="progress-meta">
          {errorStep
            ? `failed at ${errorStep.step} · ${elapsed} ms`
            : `step ${Math.min(current + 1, PIPELINE_STEPS.length)} / ${PIPELINE_STEPS.length} · ${elapsed} ms elapsed`}
        </div>
        <button className="btn" onClick={onCancel}>{errorStep ? 'Back' : 'Cancel'}</button>
      </div>
    </div>
  );
}
