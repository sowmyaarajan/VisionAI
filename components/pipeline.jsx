// 6-step pipeline timeline — animated progress
const { useState: useStatePL, useEffect: useEffectPL, useRef: useRefPL } = React;

const PIPELINE_STEPS = [
  { key: 'auth',     title: 'Authenticate with UiPath Cloud',  meta: 'POST /identity_/connect/token',                duration: 720,  iconName: 'lock' },
  { key: 'digitize', title: 'Upload & digitize document',       meta: 'POST /du_/api/framework/projects/.../digitization', duration: 1400, iconName: 'scan' },
  { key: 'project',  title: 'Locate IXP project',                meta: 'GET  /du_/api/framework/projects',              duration: 480,  iconName: 'folder' },
  { key: 'extractor',title: 'Fetch latest extractor',            meta: 'GET  /du_/api/framework/projects/.../extractors',duration: 540,  iconName: 'cpu' },
  { key: 'extract',  title: 'Run extraction',                     meta: 'POST /du_/api/framework/projects/.../extraction',duration: 2200, iconName: 'brain' },
  { key: 'parse',    title: 'Parse & structure results',          meta: 'Mapping fields, line items, confidence',         duration: 460,  iconName: 'sparkle' },
];

function Pipeline({ file, settings, onDone, onCancel, toast }) {
  const [current, setCurrent] = useStatePL(0);
  const [stepStart, setStepStart] = useStatePL(0);
  const [elapsed, setElapsed] = useStatePL(0);
  const [stepDurations, setStepDurations] = useStatePL({});
  const startedAt = useRefPL(Date.now());
  const cancelled = useRefPL(false);

  useEffectPL(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  useEffectPL(() => {
    if (current >= PIPELINE_STEPS.length) return;
    const step = PIPELINE_STEPS[current];
    const sStart = Date.now();
    setStepStart(sStart);

    toast.push({ kind: 'info', title: step.title, sub: step.meta, ttl: 2200 });

    const t = setTimeout(() => {
      if (cancelled.current) return;
      const took = Date.now() - sStart;
      setStepDurations((d) => ({ ...d, [step.key]: took }));
      if (current === PIPELINE_STEPS.length - 1) {
        toast.push({ kind: 'ok', title: 'Extraction complete', sub: `${Date.now() - startedAt.current} ms · ${PIPELINE_STEPS.length} steps`, ttl: 3200 });
        onDone();
      } else {
        setCurrent((c) => c + 1);
      }
    }, step.duration);

    return () => clearTimeout(t);
  }, [current]);

  // tick for elapsed display
  useEffectPL(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 60);
    return () => clearInterval(id);
  }, []);

  const totalPlanned = PIPELINE_STEPS.reduce((s, st) => s + st.duration, 0);

  return (
    <div className="pipeline">
      <div className="pipeline-hd">
        <div>
          <h2>Extracting document</h2>
          <p>Running the IXP pipeline. This usually takes a few seconds per page.</p>
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
          const state = idx < current ? 'done' : idx === current ? 'active' : 'pending';
          const took = stepDurations[step.key];
          return (
            <div key={step.key} className={`tl-step ${state}`}>
              <div className="tl-dot">
                {state === 'done' && <Icon name="check" size={16} stroke={2.5} />}
                {state === 'active' && <span className="spinner"></span>}
                {state === 'pending' && (idx + 1)}
              </div>
              <div className="tl-body">
                <div className="tl-title">{step.title}</div>
                <div className="tl-meta">{step.meta}</div>
              </div>
              <div className="tl-time">
                {took ? `${took} ms` : state === 'active' ? `${Date.now() - stepStart} ms` : '—'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pipeline-ft">
        <div className="progress-meta">
          {current >= PIPELINE_STEPS.length
            ? `done · ${elapsed} ms`
            : `step ${Math.min(current + 1, PIPELINE_STEPS.length)} / ${PIPELINE_STEPS.length} · ${elapsed} ms elapsed`}
        </div>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

window.Pipeline = Pipeline;
