import {useEffect, useRef} from 'react';

export const BEATS = [
  {key: 'assembled', label: 'Overview', ghost: 'Sigilant', caption: 'Sigilant, assembled'},
  {key: 'identify', label: 'Identify', ghost: 'Passport', caption: 'Identity'},
  {key: 'decide', label: 'Decide', ghost: 'Verdict', caption: 'Decision'},
  {key: 'prove', label: 'Prove', ghost: 'Ledger', caption: 'Evidence'},
  {key: 'contain', label: 'Contain', ghost: 'Revoked', caption: 'Containment'},
];

// Labels hang off their 3D anchor at (dx, dy) and are clamped into the subject zone, so they can never reach the copy column.
const CALLOUTS = {
  0: [{id: 'gate', n: '02', title: 'Gate', text: 'One verdict per call', dx: 70, dy: -120}, {id: 'card', n: '01', title: 'Identity', text: 'Agent passport, ERC-8004', dx: -30, dy: 120}, {id: 'ledger', n: '03', title: 'Ledger', text: 'Hash-linked, verifiable', dx: 20, dy: 100}],
  1: [{id: 'card', n: '01', title: 'Passport', text: 'Key, operator, scopes, status', dx: -10, dy: 215}],
  2: [{id: 'gate', n: '02', title: 'Verdict', text: 'Allow, ask a human, or deny', dx: 20, dy: -235}],
  3: [{id: 'ledger', n: '03', title: 'Chain', text: 'Each block seals the last', dx: -20, dy: -130}],
  4: [{id: 'gate', n: '04', title: 'Closed', text: 'Every call is denied', dx: 20, dy: -235}],
};

/**
 * Everything that lives behind the copy: aurora light, ghost type, the 3D canvas, and the
 * annotations pinned to it. It is full-bleed and fixed; the copy sits above it. Tier rules:
 * ambient layers (aurora, ghost word, hairlines, dust) may sit under anything; the subject
 * is composed inside its own zone, and callouts are clamped to that zone.
 */
export default function Stage({canvasRef, beat, visible, frameApi, zoneApi, onJump}) {
  const els = useRef({});
  const sizes = useRef({});
  const callouts = CALLOUTS[beat] ?? [];

  useEffect(() => {
    const measure = () => { for (const c of callouts) { const el = els.current[c.id]?.label; if (el) sizes.current[c.id] = {w: el.offsetWidth, h: el.offsetHeight}; } };
    measure();
    frameApi.current = anchors => {
      const W = innerWidth, H = innerHeight, z = zoneApi.current ?? {cx: 0.7, w: 0.44};
      const left = W * (z.cx - z.w / 2) - 10;
      for (const c of callouts) {
        const a = anchors[c.id], e = els.current[c.id], sz = sizes.current[c.id];
        if (!a || !e?.label || !sz) continue;
        const lx = Math.min(Math.max(a.x + c.dx, left), W - sz.w - 28);
        const ly = Math.min(Math.max(a.y + c.dy, 84), H - sz.h - 44);
        // leader: from the anchor to the closest point on the label's box
        const nx = Math.min(Math.max(a.x, lx), lx + sz.w), ny = Math.min(Math.max(a.y, ly), ly + sz.h);
        e.label.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        e.line.setAttribute('x1', nx.toFixed(1)); e.line.setAttribute('y1', ny.toFixed(1));
        e.line.setAttribute('x2', a.x.toFixed(1)); e.line.setAttribute('y2', a.y.toFixed(1));
        e.pin.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        const on = a.on ? 1 : 0;
        e.pin.style.opacity = on; e.label.style.opacity = on; e.line.style.opacity = on * 0.5;
      }
    };
    return () => { frameApi.current = null; };
  }, [callouts, frameApi, zoneApi]);

  return (
    <div className={`world ${visible ? 'on' : ''}`}>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="ghosts" aria-hidden="true">{BEATS.map((b, i) => <span key={b.key} className={i === beat ? 'on' : ''}>{b.ghost}</span>)}</div>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      <svg className="leaders" aria-hidden="true">
        {callouts.map(c => <line key={c.id + beat} ref={el => { els.current[c.id] = {...els.current[c.id], line: el}; }} x1="0" y1="0" x2="0" y2="0" />)}
      </svg>
      {callouts.map(c => <i key={c.id + beat} className="pin" aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], pin: el}; }} />)}
      {callouts.map(c => (
        <div key={c.id + beat} className="callout" aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], label: el}; }}>
          <b>{c.n}</b><strong>{c.title}</strong><span>{c.text}</span>
        </div>
      ))}
      <ol className="rail" aria-label="Story progress">
        {BEATS.map((x, i) => (
          <li key={x.key}><button type="button" className={i === beat ? 'on' : ''} onClick={() => onJump(i)} aria-label={x.label} aria-current={i === beat}><span>{x.label}</span></button></li>
        ))}
      </ol>
    </div>
  );
}
