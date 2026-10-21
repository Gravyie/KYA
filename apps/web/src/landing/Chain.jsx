import {useCallback, useEffect, useState} from 'react';

/*
 * A real hash chain, computed in your browser with SHA-256. Each block hashes its contents plus the previous
 * block's hash. Edit one, and its hash no longer matches what was recorded, and every later link breaks.
 */

const GENESIS = '0'.repeat(64);
const SEED = [
  {kind: 'allowed', text: 'read_file repo/src/app.ts'},
  {kind: 'denied', text: 'read_file repo/.env.local'},
  {kind: 'pending', text: 'git.push origin/main'},
  {kind: 'approved', text: 'git.push origin/main · by Acme'},
  {kind: 'allowed', text: 'web.search "benchmarks"'},
];
const TAMPER = {denied: 'allowed', allowed: 'denied', pending: 'approved', approved: 'denied'};

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function seal(events) {
  let prev = GENESIS; const out = [];
  for (const [i, e] of events.entries()) { const hash = await sha(JSON.stringify({seq: i + 1, ...e, prev})); out.push({...e, seq: i + 1, prev, hash}); prev = hash; }
  return out;
}

export default function Chain() {
  const [blocks, setBlocks] = useState([]);
  const [checks, setChecks] = useState([]);
  const reset = useCallback(() => { seal(SEED).then(b => { setBlocks(b); setChecks(b.map(() => true)); }); }, []);
  useEffect(() => { if (crypto?.subtle) reset(); }, [reset]);

  async function verify(list) {
    let prev = GENESIS; const ok = []; let broken = false;
    for (const b of list) {
      const recomputed = await sha(JSON.stringify({seq: b.seq, kind: b.kind, text: b.text, prev}));
      const good = !broken && b.prev === prev && recomputed === b.hash;
      if (!good) broken = true;
      ok.push(good); prev = b.hash;
    }
    setChecks(ok);
  }
  function tamper(i) {
    const next = blocks.map((b, j) => (j === i ? {...b, kind: TAMPER[b.kind] ?? 'allowed', edited: true} : b));
    setBlocks(next); verify(next);
  }

  if (!blocks.length) return <div className="chain-demo empty">Hash chain needs a secure context.</div>;
  const brokenAt = checks.indexOf(false);
  return (
    <div className="chain-demo">
      <div className="chain-head">
        <span className={`chain-state ${brokenAt === -1 ? 'ok' : 'bad'}`}><i />{brokenAt === -1 ? 'CHAIN INTACT' : `BROKEN AT #${brokenAt + 1}`}</span>
        <span className="hint">Click a block to rewrite history.</span>
        {brokenAt !== -1 && <button className="btn sm ghost" onClick={reset}>Restore</button>}
      </div>
      <ol className="chain-row">
        {blocks.map((b, i) => (
          <li key={b.seq} className={`blk ${checks[i] ? '' : 'bad'} ${b.edited ? 'edited' : ''}`}>
            <button type="button" onClick={() => tamper(i)} aria-label={`Tamper with block ${b.seq}`}>
              <span className="blk-seq">#{b.seq}</span>
              <span className={`blk-kind ${b.kind}`}>{b.kind}</span>
              <span className="blk-text">{b.text}</span>
              <span className="blk-hash"><em>prev</em>{b.prev.slice(0, 8)}</span>
              <span className="blk-hash"><em>hash</em>{b.hash.slice(0, 8)}</span>
              <span className="blk-flag">{checks[i] ? '✓ sealed' : '✕ mismatch'}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
