import {useEffect, useRef} from 'react';

export const BEATS = [
  {key: 'assembled', label: 'Overview', sector: 'GATEHOUSE'},
  {key: 'identify', label: 'Identify', sector: 'IDENTITY'},
  {key: 'decide', label: 'Decide', sector: 'DECISION'},
  {key: 'prove', label: 'Prove', sector: 'EVIDENCE'},
  {key: 'contain', label: 'Contain', sector: 'CONTAINMENT'},
  {key: 'flight', label: 'Explore', sector: 'CORRIDOR'},
];

// Tags hang off their 3D anchor at (dx, dy) and are clamped into the free side of the screen.
const TAGS = {
  0: [],
  1: [{id: 'card', n: '01', title: 'PASSPORT', text: 'Key, operator, scopes', dx: 20, dy: 190}],
  2: [{id: 'gate', n: '02', title: 'VERDICT', text: 'Allow, ask a human, or deny', dx: 30, dy: -210}],
  3: [{id: 'ledger', n: '03', title: 'CHAIN', text: 'Each block seals the last', dx: -20, dy: -150}],
  4: [{id: 'gate', n: '04', title: 'CLOSED', text: 'Every call is denied', dx: 30, dy: -210}],
  5: [],
};

/**
 * The fixed layer: the WebGL canvas, a HUD frame, a status bar, a sector rail, and tags pinned to 3D anchors.
 * Copy lives above it in the page; the canvas never receives pointer events.
 */
export default function Hud({canvasRef, beat, countApi, frameApi, onJump, revoked}) {
  const els = useRef({});
  const countEl = useRef(null);
  useEffect(() => { countApi.current = n => { if (countEl.current) countEl.current.textContent = String(n).padStart(5, '0'); }; return () => { countApi.current = null; }; }, [countApi]);
  const sizes = useRef({});
  const tags = TAGS[beat] ?? [];

  useEffect(() => {
    for (const c of tags) { const el = els.current[c.id]?.label; if (el) sizes.current[c.id] = {w: el.offsetWidth, h: el.offsetHeight}; }
    frameApi.current = anchors => {
      const W = innerWidth, H = innerHeight;
      const left = beat === 0 ? 24 : W * 0.46, right = W - 70;
      for (const c of tags) {
        const a = anchors[c.id], e = els.current[c.id], sz = sizes.current[c.id];
        if (!a || !e?.label || !sz) continue;
        const lx = Math.min(Math.max(a.x + c.dx, left), right - sz.w);
        const ly = Math.min(Math.max(a.y + c.dy, 96), H - sz.h - 70);
        const nx = Math.min(Math.max(a.x, lx), lx + sz.w), ny = Math.min(Math.max(a.y, ly), ly + sz.h);
        e.label.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        e.line.setAttribute('x1', nx.toFixed(1)); e.line.setAttribute('y1', ny.toFixed(1)); e.line.setAttribute('x2', a.x.toFixed(1)); e.line.setAttribute('y2', a.y.toFixed(1));
        e.pin.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        const on = a.on && lx > -50 ? 1 : 0;
        e.pin.style.opacity = on; e.label.style.opacity = on; e.line.style.opacity = on * 0.7;
      }
    };
    return () => { frameApi.current = null; };
  }, [tags, frameApi, beat]);

  const b = BEATS[Math.min(beat, BEATS.length - 1)];
  return (
    <div className="hud" aria-hidden="false">
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <svg className="leaders" aria-hidden="true">{tags.map(c => <line key={c.id + beat} ref={el => { els.current[c.id] = {...els.current[c.id], line: el}; }} x1="0" y1="0" x2="0" y2="0" />)}</svg>
      {tags.map(c => <i key={c.id + beat} className="pin" aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], pin: el}; }} />)}
      {tags.map(c => (
        <div key={c.id + beat} className="tag" aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], label: el}; }}><b>{c.n}</b><strong>{c.title}</strong><span>{c.text}</span></div>
      ))}
      <div className="frame" aria-hidden="true"><i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /></div>
      <div className="readout bl" aria-hidden="true"><span>SECTOR {String(beat).padStart(2, '0')}</span><b key={b.key}>{b.sector}</b></div>
      <div className={`readout br ${revoked ? 'red' : ''}`} aria-hidden="true"><span>SIM VERDICTS</span><b ref={countEl}>00000</b></div>
      <ol className="rail" aria-label="Story progress" hidden={beat > 4}>
        {BEATS.slice(0, 5).map((x, i) => <li key={x.key}><button type="button" className={i === beat ? 'on' : ''} onClick={() => onJump(i)} aria-label={x.label} aria-current={i === beat}><span>{x.label}</span></button></li>)}
      </ol>
    </div>
  );
}
