import {GitBranch, Wallet, Handshake} from 'lucide-react';

function Tree() {
  return (
    <ul className="viz tree" aria-hidden="true">
      <li><b className="ok">✓</b><code>repo/src/billing.ts</code><em>allow</em></li>
      <li><b className="ok">✓</b><code>repo/README.md</code><em>allow</em></li>
      <li className="struck"><b className="no">✕</b><code>repo/.env.local</code><em>deny</em></li>
      <li><b className="hold">…</b><code>git push origin/main</code><em>ask</em></li>
    </ul>
  );
}
function Budget() {
  return (
    <div className="viz budget" aria-hidden="true">
      <div className="bar"><i style={{'--w': '38%'}} /><i className="ask" style={{'--w': '24%'}} /></div>
      <div className="bar-l"><span>$312 spent</span><span>$500 / 24h</span></div>
      <ul><li><code>aws</code><em>$60</em><b className="ok">allowed</b></li><li><code>acme-corp</code><em>$420</em><b className="hold">asks you</b></li><li><code>unknown-llc</code><em>$9,000</em><b className="no">blocked</b></li></ul>
    </div>
  );
}
function Token() {
  return (
    <div className="viz token" aria-hidden="true">
      <code><s>eyJhbGciOiJFZERTQSJ9</s>.<u>eyJzdWIiOiI4ZjNhLi4u</u>.<i>Mq81…vPz</i></code>
      <dl><dt>agent</dt><dd>research-bot</dd><dt>operator</dt><dd>Acme Inc.</dd><dt>audience</dt><dd>api.partner.com</dd><dt>expires</dt><dd>in 2 min</dd></dl>
      <p><b className="ok">✓</b> signature · <b className="ok">✓</b> not revoked</p>
    </div>
  );
}

const CASES = [
  {icon: GitBranch, tag: 'Coding agents', title: 'In the repo, never in your secrets.', body: 'Put the MCP firewall in front of filesystem and shell servers. Reads are free, .env is denied, pushes wait for you.', viz: <Tree />, span: 'a'},
  {icon: Wallet, tag: 'Spending agents', title: 'A card with a ceiling.', body: 'Small invoices pass. Larger ones pause for your approval. A daily budget stops the rest, even when a rule is too loose.', viz: <Budget />, span: 'b'},
  {icon: Handshake, tag: 'Agents calling services', title: 'Prove who is on the other end.', body: 'Short-lived signed assertions name the accountable operator. Partners verify in six lines. Revoke, and every check fails.', viz: <Token />, span: 'c'},
];

export default function Cases() {
  return (
    <div className="bento">
      {CASES.map(c => (
        <article key={c.tag} className={`case tilt rise ${c.span}`}>
          <div className="case-top"><c.icon size={18} strokeWidth={1.6} /><span className="eyebrow">{c.tag}</span></div>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
          {c.viz}
        </article>
      ))}
    </div>
  );
}
