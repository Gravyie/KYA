import {useEffect, useLayoutEffect, useRef} from 'react';

export const BEATS = [
  {key: 'assembled', label: 'Overview', caption: 'Sigilant, assembled'},
  {key: 'identify', label: 'Identify', caption: 'Identity · the agent passport'},
  {key: 'decide', label: 'Decide', caption: 'Decision · one verdict per call'},
  {key: 'prove', label: 'Prove', caption: 'Evidence · the hash-linked ledger'},
  {key: 'contain', label: 'Contain', caption: 'Containment · revocation'},
];

// Callouts live in fixed margin slots; leader lines run from the slot to the 3D anchor.
const CALLOUTS = {
  0: [{id: 'card', slot: 'bl', n: '01', title: 'Identity', text: 'Agent passport, ERC-8004'}, {id: 'gate', slot: 'tr', n: '02', title: 'Gate', text: 'One verdict per call'}, {id: 'ledger', slot: 'br', n: '03', title: 'Ledger', text: 'Hash-linked, verifiable'}],
  1: [{id: 'card', slot: 'br', n: '01', title: 'Passport', text: 'Key, operator, scopes, status'}],
  2: [{id: 'gate', slot: 'tr', n: '02', title: 'Verdict', text: 'Allow, ask a human, or deny'}],
  3: [{id: 'ledger', slot: 'tl', n: '03', title: 'Chain', text: 'Each block seals the last'}],
  4: [{id: 'gate', slot: 'tr', n: '04', title: 'Closed', text: 'Every call is denied'}],
};

/**
 * The sticky "figure": a framed viewport for the 3D scene with its own header and
 * footer bars. Callouts, the rail and the ticker are siblings of the canvas inside
 * the frame, so nothing from the page can overlap the scene and the scene can never
 * bleed into the text column.
 */
export default function Figure({canvasRef, beat, tick, frameApi, onJump}) {
  const viewRef = useRef(null);
  const els = useRef({});
  const rects = useRef({});
  const callouts = CALLOUTS[beat] ?? [];

  const measure = () => {
    const v = viewRef.current; if (!v) return;
    const vb = v.getBoundingClientRect();
    for (const c of callouts) {
      const el = els.current[c.id]?.label; if (!el) continue;
      const r = el.getBoundingClientRect();
      rects.current[c.id] = {x: r.left - vb.left, y: r.top - vb.top, w: r.width, h: r.height};
    }
  };
  useLayoutEffect(() => { measure(); }, [beat]);
  useEffect(() => { addEventListener('resize', measure); return () => removeEventListener('resize', measure); });

  useEffect(() => {
    frameApi.current = anchors => {
      for (const c of callouts) {
        const a = anchors[c.id], e = els.current[c.id], r = rects.current[c.id];
        if (!a || !e?.line || !r) continue;
        // connect from the label's nearest side midpoint to the anchor
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const px = a.x < r.x ? r.x : a.x > r.x + r.w ? r.x + r.w : cx;
        const py = a.y < r.y ? r.y : a.y > r.y + r.h ? r.y + r.h : cy;
        const ex = a.x < r.x || a.x > r.x + r.w ? px : cx, ey = a.x < r.x || a.x > r.x + r.w ? cy : py;
        e.line.setAttribute('x1', ex.toFixed(1)); e.line.setAttribute('y1', ey.toFixed(1));
        e.line.setAttribute('x2', a.x.toFixed(1)); e.line.setAttribute('y2', a.y.toFixed(1));
        e.pin.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        e.pin.style.opacity = a.on ? 1 : 0;
      }
    };
    return () => { frameApi.current = null; };
  }, [callouts, frameApi]);

  const b = BEATS[beat];
  return (
    <aside className="fig" data-night={beat === 4 ? '1' : '0'} aria-label={`Figure: ${b.caption}`}>
      <div className="fig-bar top">
        <span className="fig-no">FIG. 0{beat + 1}</span>
        <span className="fig-cap" key={beat}>{b.caption}</span>
        <span className="legend" aria-hidden="true"><i className="a" />allow <i className="k" />ask <i className="d" />deny</span>
      </div>
      <div className="fig-view" ref={viewRef}>
        <canvas ref={canvasRef} className="stage" aria-hidden="true" />
        <svg className="leaders" aria-hidden="true">
          {callouts.map(c => <line key={c.id + beat} ref={el => { els.current[c.id] = {...els.current[c.id], line: el}; }} x1="0" y1="0" x2="0" y2="0" />)}
        </svg>
        {callouts.map(c => <i key={c.id + beat} className="pin" aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], pin: el}; }} />)}
        {callouts.map(c => (
          <div key={c.id + beat} className={`callout slot-${c.slot}`} aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], label: el}; }}>
            <b>{c.n}</b><strong>{c.title}</strong><span>{c.text}</span>
          </div>
        ))}
        <i className="crop tl" /><i className="crop tr" /><i className="crop bl" /><i className="crop br" />
        <ol className="rail" aria-label="Story progress">
          {BEATS.map((x, i) => (
            <li key={x.key}><button type="button" className={i === beat ? 'on' : ''} onClick={() => onJump(i)} aria-label={x.label} aria-current={i === beat}><span>{x.label}</span></button></li>
          ))}
        </ol>
      </div>
      <div className="fig-bar bottom" aria-live="off">
        {tick ? <><span className={`tk-badge ${tick.kind}`}>{tick.kind}</span><code>{tick.text}</code></> : <code className="muted">Waiting for calls…</code>}
        <em>Illustrative stream</em>
      </div>
    </aside>
  );
}
