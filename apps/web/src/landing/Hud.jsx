import {useEffect, useRef} from 'react';

export const BEATS = [
  {key: 'gate', label: 'Gate', jp: '関門'},
  {key: 'identify', label: 'Identify', jp: '識別'},
  {key: 'decide', label: 'Decide', jp: '審判'},
  {key: 'prove', label: 'Prove', jp: '記録'},
  {key: 'contain', label: 'Contain', jp: '封鎖'},
  {key: 'city', label: 'Corridor', jp: '回廊'},
];

// Tags hang off their 3D anchor at (dx, dy) and are clamped to the scene's side of the screen.
const TAGS = {
  0: [],
  1: [{id: 'card', n: '01', title: 'PASS', text: 'Key · operator · scopes', dx: 40, dy: 170}],
  3: [{id: 'ledger', n: '03', title: 'LEDGER', text: 'Each block seals the last', dx: -40, dy: -150}],
  4: [],
};

/** The fixed layer: canvas, viewfinder corners, readouts, the chapter rail, and tags pinned to 3D anchors. */
export default function Hud({canvasRef, beat, countApi, frameApi, onJump, alert}) {
  const els = useRef({});
  const sizes = useRef({});
  const countEl = useRef(null);
  const tags = TAGS[beat] ?? [];
  useEffect(() => { countApi.current = n => { if (countEl.current) countEl.current.textContent = String(n).padStart(6, '0'); }; return () => { countApi.current = null; }; }, [countApi]);

  useEffect(() => {
    for (const c of tags) { const el = els.current[c.id]?.label; if (el) sizes.current[c.id] = {w: el.offsetWidth, h: el.offsetHeight}; }
    frameApi.current = anchors => {
      const W = innerWidth, H = innerHeight, left = W * 0.5, right = W - 76;
      for (const c of tags) {
        const a = anchors[c.id], e = els.current[c.id], sz = sizes.current[c.id];
        if (!a || !e?.label || !sz) continue;
        const lx = Math.min(Math.max(a.x + c.dx, left), right - sz.w);
        const ly = Math.min(Math.max(a.y + c.dy, 96), H - sz.h - 84);
        const nx = Math.min(Math.max(a.x, lx), lx + sz.w), ny = Math.min(Math.max(a.y, ly), ly + sz.h);
        e.label.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        e.line.setAttribute('x1', nx.toFixed(1)); e.line.setAttribute('y1', ny.toFixed(1)); e.line.setAttribute('x2', a.x.toFixed(1)); e.line.setAttribute('y2', a.y.toFixed(1));
        e.pin.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        const on = a.on ? 1 : 0;
        e.pin.style.opacity = on; e.label.style.opacity = on; e.line.style.opacity = on * 0.8;
      }
    };
    return () => { frameApi.current = null; };
  }, [tags, frameApi]);

  const b = BEATS[Math.min(beat, BEATS.length - 1)];
  return (
    <div className={`hud ${alert ? 'alert' : ''}`}>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      <svg className="leaders" aria-hidden="true">{tags.map(c => <line key={c.id + beat} ref={el => { els.current[c.id] = {...els.current[c.id], line: el}; }} x1="0" y1="0" x2="0" y2="0" />)}</svg>
      {tags.map(c => <i key={c.id + beat} className="pin" aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], pin: el}; }} />)}
      {tags.map(c => (
        <div key={c.id + beat} className="tag" aria-hidden="true" ref={el => { els.current[c.id] = {...els.current[c.id], label: el}; }}><b>{c.n}</b><strong>{c.title}</strong><span>{c.text}</span></div>
      ))}
      <div className="vf" aria-hidden="true"><i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /></div>
      <div className="ro ro-l" aria-hidden="true"><span>第{String(beat + 1).padStart(2, '0')}幕 · SCENE {String(beat + 1).padStart(2, '0')}</span><b key={b.key}><span lang="ja">{b.jp}</span> {b.label.toUpperCase()}</b></div>
      <div className="ro ro-r" aria-hidden="true"><span>判定数 · VERDICTS (SIM)</span><b ref={countEl}>000000</b></div>
      <ol className="rail" aria-label="Story progress" hidden={beat > 4}>
        {BEATS.slice(0, 5).map((x, i) => <li key={x.key}><button type="button" className={i === beat ? 'on' : ''} onClick={() => onJump(i)} aria-label={x.label} aria-current={i === beat}><span lang="ja">{x.jp}</span></button></li>)}
      </ol>
    </div>
  );
}
