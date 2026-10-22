const ROWS = [
  {layer: 'Identity', q: 'Who is this agent?', who: ['ERC-8004 registries', 'Mihari passport'], role: 'Issue the passport. Publish it on-chain if you want it public.', core: false},
  {layer: 'Access', q: 'Which apps may it sign in to?', who: ['Auth0', 'Okta', 'WorkOS', 'Composio'], role: 'Use them for OAuth and tool brokering. Put Mihari in front of the tools they expose.', core: false},
  {layer: 'Action', q: 'May it do this, right now?', who: ['Mihari gate'], role: 'Rules, human approvals, spend and rate limits, on every single call.', core: true},
  {layer: 'Evidence', q: 'What did it actually do?', who: ['Mihari ledger', 'ERC-8004 reputation'], role: 'A hash-linked log you can verify offline. On-chain reputation is on the roadmap.', core: false},
  {layer: 'Humanhood', q: 'Is a person accountable?', who: ['Proof-of-human (e.g. World)'], role: 'The operator is named in every passport today. Humanhood attestations are on the roadmap.', core: false},
];

export default function Stack() {
  return (
    <div className="stack-table rise">
      <div className="st-head" aria-hidden="true"><span>Layer</span><span>The question</span><span>Who answers it</span><span>Mihari’s role</span></div>
      {ROWS.map(r => (
        <div key={r.layer} className={`st-row ${r.core ? 'core' : ''}`}>
          <b>{r.layer}</b><span className="q">{r.q}</span>
          <span className="who">{r.who.map(w => <em key={w} className={w.startsWith('Mihari') ? 'sg' : ''}>{w}</em>)}</span>
          <span className="role">{r.role}</span>
        </div>
      ))}
      <p className="st-note">Third-party names belong to their owners. No affiliation or endorsement is implied; they are listed as examples of what each layer does.</p>
    </div>
  );
}
