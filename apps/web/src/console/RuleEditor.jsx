import {Plus, X} from 'lucide-react';

const blankRule = {mode: 'allow', action: '', resources: '*', maxAmount: ''};

export default function RuleEditor({value, onChange, expiry}) {
  const {scopes, limits} = value;
  const setRule = (i, patch) => onChange({...value, scopes: scopes.map((r, j) => (j === i ? {...r, ...patch} : r))});
  const setLimits = patch => onChange({...value, limits: {...limits, ...patch}});

  return (
    <div className="editor">
      <div className="label">Rules <span className="hint">Deny wins. Otherwise the first match. No match is denied.</span></div>
      <div className="rule-head" aria-hidden="true"><span>Mode</span><span>Action</span><span>Resources</span><span>Max amount</span><span /></div>
      {scopes.map((r, i) => (
        <div className={`rule ${r.mode}`} key={i}>
          <select className="input" aria-label="Mode" value={r.mode} onChange={e => setRule(i, {mode: e.target.value})}>
            <option value="allow">Allow</option><option value="ask">Ask me</option><option value="deny">Deny</option>
          </select>
          <input className="input mono" aria-label="Action" placeholder="read_file or files.*" value={r.action} onChange={e => setRule(i, {action: e.target.value})} />
          <input className="input mono" aria-label="Resources" placeholder="path/*, other/*" value={r.resources} onChange={e => setRule(i, {resources: e.target.value})} />
          <input className="input mono" aria-label="Maximum amount" placeholder="no cap" inputMode="decimal" value={r.maxAmount} onChange={e => setRule(i, {maxAmount: e.target.value})} />
          <button type="button" className="icon-btn" aria-label="Remove rule" onClick={() => onChange({...value, scopes: scopes.filter((_, j) => j !== i)})}><X size={15} /></button>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange({...value, scopes: [...scopes, {...blankRule}]})}><Plus size={14} /> Add rule</button>

      <div className="limits-grid">
        <div className="field">
          <span>Spend budget</span>
          <div className="inline">
            <input className="input mono" placeholder="no cap" inputMode="decimal" aria-label="Budget amount" value={limits.budget.amount} onChange={e => setLimits({budget: {...limits.budget, amount: e.target.value}})} />
            <span className="hint">per</span>
            <input className="input mono narrow" inputMode="numeric" aria-label="Budget window hours" value={limits.budget.windowHours} onChange={e => setLimits({budget: {...limits.budget, windowHours: e.target.value}})} />
            <span className="hint">hours</span>
          </div>
        </div>
        <div className="field">
          <span>Rate limit</span>
          <div className="inline">
            <input className="input mono" placeholder="no limit" inputMode="numeric" aria-label="Rate limit calls" value={limits.rate.count} onChange={e => setLimits({rate: {...limits.rate, count: e.target.value}})} />
            <span className="hint">calls per</span>
            <input className="input mono narrow" inputMode="numeric" aria-label="Rate window minutes" value={limits.rate.windowMinutes} onChange={e => setLimits({rate: {...limits.rate, windowMinutes: e.target.value}})} />
            <span className="hint">min</span>
          </div>
        </div>
        {expiry}
      </div>
    </div>
  );
}
