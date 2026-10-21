import {Words} from './bits.jsx';

/** One header pattern for every section: mono index, headline, one sentence. */
export default function SectionHead({n, label, title, sub}) {
  return (
    <header className="shead">
      <p className="eyebrow rise"><b>§{n}</b><i />{label}</p>
      <h2 className="big"><Words>{title}</Words></h2>
      {sub && <p className="sub rise">{sub}</p>}
    </header>
  );
}
