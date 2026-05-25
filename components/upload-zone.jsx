// Upload zone — drag-and-drop + click to select
const { useState: useStateUZ, useRef: useRefUZ } = React;

function UploadZone({ onFile, disabled }) {
  const [dragging, setDragging] = useStateUZ(false);
  const fileRef = useRefUZ(null);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('File too large (max 50 MB).');
      return;
    }
    onFile(file);
  };

  return (
    <div className="welcome-grid">
      <div
        className={`upload-zone ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          handleFile(f);
        }}
      >
        <div className="uz-icon">
          <Icon name="upload" size={28} stroke={1.8} />
        </div>
        <h2>Drop a document to extract</h2>
        <p>Upload an invoice, statement, or insurance document. Pages, fields and line items will be extracted using your configured IXP project.</p>
        <div className="uz-buttons">
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={disabled}>
            <Icon name="file" size={14} />Choose file
          </button>
          <span className="btn btn-ghost" style={{ pointerEvents: 'none' }}>or drop here</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="uz-formats">
          <span>PDF</span><span>PNG</span><span>JPG</span><span>TIFF</span><span>up to 50 MB</span>
        </div>
      </div>

      <div className="intro-card">
        <h3>How extraction runs</h3>
        <div className="ic-sub">Phase 1 — six-step pipeline mirroring the IXP Python integration.</div>
        <ol className="ic-steps">
          <li><span className="num">1</span>Authenticate</li>
          <li><span className="num">2</span>Digitize document</li>
          <li><span className="num">3</span>Locate IXP project</li>
          <li><span className="num">4</span>Fetch extractor</li>
          <li><span className="num">5</span>Run extraction</li>
          <li><span className="num">6</span>Parse results</li>
        </ol>
      </div>
    </div>
  );
}

window.UploadZone = UploadZone;
