// Frontend API client for the FastAPI backend.
//
// Two flows:
//   - testConnection(config)  → POST /api/connection/test  (json)
//   - extractDocument(file, config, onEvent) → multipart upload + SSE stream
//     onEvent({ kind: 'step'|'result'|'done'|'error', data })

export async function testConnection(config) {
  const res = await fetch('/api/connection/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Server error ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

export async function extractDocument(file, config, onEvent) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('config', JSON.stringify(config));

  const res = await fetch('/api/extract', { method: 'POST', body: fd });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Server error ${res.status}: ${txt.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sepIdx;
    while ((sepIdx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sepIdx);
      buf = buf.slice(sepIdx + 2);
      const lines = frame.split('\n');
      let event = 'message';
      let dataLines = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      let parsed;
      try { parsed = JSON.parse(dataLines.join('\n')); }
      catch { parsed = dataLines.join('\n'); }
      onEvent({ kind: event, data: parsed });
      if (event === 'error') return;
      if (event === 'done') return;
    }
  }
}
