import {useMemo} from 'react';

/** A pseudo-QR: a deterministic grid that reads as a machine-readable seal. Decorative. */
function Seal() {
  const cells = useMemo(() => {
    const out = []; let s = 8113;
    const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
      const finder = (x < 5 && y < 5) || (x > 11 && y < 5) || (x < 5 && y > 11);
      if (finder ? (x % 4 === 0 || y % 4 === 0 || x === 2 || y === 2 || x === 14 || y === 14) && (x % 12 < 5) : rnd() > 0.52) out.push([x, y]);
    }
    return out;
  }, []);
  return <svg viewBox="0 0 17 17" className="seal" aria-hidden="true" shapeRendering="crispEdges">{cells.map(([x, y]) => <rect key={x + '-' + y} x={x} y={y} width="1" height="1" />)}</svg>;
}

/** The agent passport as a physical object: tilts with the pointer, foil catches the light. */
export default function HoloPassport() {
  return (
    <div className="holo tilt" role="img" aria-label="Agent passport for research-bot, operated by Acme Inc., registered on ERC-8004">
      <div className="holo-face">
        <svg className="guilloche" viewBox="0 0 400 250" aria-hidden="true" preserveAspectRatio="none">
          {Array.from({length: 26}, (_, i) => <path key={i} d={`M0 ${150 + i * 2} C 90 ${60 + i * 5}, 190 ${230 - i * 3}, 400 ${110 + i * 3}`} />)}
        </svg>
        <div className="holo-foil" aria-hidden="true" />
        <header><span className="mono">SIGILANT · AGENT PASSPORT</span><svg width="26" height="26" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3.2" /><circle cx="16" cy="16" r="3.4" fill="var(--allow-glow)" /></svg></header>
        <h4>research-bot</h4>
        <dl>
          <dt>Operator</dt><dd>Acme Inc.</dd>
          <dt>Scopes</dt><dd>read_file · web.search</dd>
          <dt>ERC-8004</dt><dd>eip155:84532 · #10353</dd>
        </dl>
        <footer><span className="chip-live"><i />Active</span><Seal /><span className="mono fp">ed25519 · 8f3a 91c2 77de</span></footer>
      </div>
    </div>
  );
}
