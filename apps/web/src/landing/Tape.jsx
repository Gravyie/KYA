const ITEMS = [
  ['allow', 'read_file', 'workspace/q3-report.md'], ['ask', 'payments.send', '$4,200 → acme-corp'], ['deny', 'shell.run', 'rm -rf /'],
  ['allow', 'web.search', '“seed round benchmarks”'], ['allow', 'git.commit', 'feat/billing-webhooks'], ['deny', 'read_file', '~/.ssh/id_ed25519'],
  ['ask', 'git.push', 'origin/main'], ['allow', 'calendar.read', 'team@acme.co'], ['deny', 'db.drop', 'customers'],
];

/** A slow ribbon of verdicts along the bottom of the first screen. Ambient: it says what the product does. */
export default function Tape() {
  const row = ITEMS.map(([k, a, r], i) => <span className="tp-item" key={i}><b className={k}>{k}</b><code>{a}</code><em>{r}</em></span>);
  return <div className="tape" aria-hidden="true"><div className="tp-track">{row}{row}</div></div>;
}
