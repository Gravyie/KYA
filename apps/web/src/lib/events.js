const agentName = (e, agents) => agents?.find(a => a.id === e.agentId)?.name ?? (e.agentId ? e.agentId.slice(0, 8) : 'Owner');

/** Human description of an audit event for feeds and tables. */
export function describeEvent(e, agents) {
  const d = e.details ?? {};
  const who = agentName(e, agents);
  const call = d.action ? `${d.action}  ${d.resource ?? ''}${d.amount ? `  ·  ${d.amount}` : ''}` : '';
  switch (e.kind) {
    case 'action.allowed': return {label: 'Allowed', tone: 'allow', who, text: call, note: d.reason};
    case 'action.denied': return {label: 'Denied', tone: 'deny', who, text: call, note: d.reason};
    case 'action.pending': return {label: 'Needs approval', tone: 'ask', who, text: call, note: d.note || d.reason};
    case 'approval.granted': return {label: 'Approved', tone: 'allow', who, text: call, note: `by ${d.by ?? 'owner'}${d.note ? ` · ${d.note}` : ''}`};
    case 'approval.denied': return {label: 'Declined', tone: 'deny', who, text: call, note: d.by === 'revocation' ? 'agent revoked' : d.note};
    case 'approval.expired': return {label: 'Expired', tone: '', who, text: call, note: 'no answer in time'};
    case 'action.reported': return {label: d.outcome === 'success' ? 'Succeeded' : 'Failed', tone: d.outcome === 'success' ? 'allow' : 'deny', who, text: d.note || 'outcome reported by agent', note: 'agent-reported'};
    case 'agent.created': return {label: 'Registered', tone: '', who, text: 'agent created', note: `${d.scopes?.length ?? 0} rules`};
    case 'agent.policy.updated': return {label: 'Policy', tone: '', who, text: 'policy updated', note: `${d.scopes?.length ?? 0} rules`};
    case 'agent.key.rotated': return {label: 'Key rotated', tone: '', who, text: 'previous key invalidated'};
    case 'agent.revoked': return {label: 'Revoked', tone: 'deny', who, text: 'agent revoked'};
    case 'agent.onchain.linked': return {label: 'On-chain', tone: 'allow', who, text: `registered as #${d.agentId} on ${d.chain}`, note: d.owner ? `${d.owner.slice(0, 6)}…${d.owner.slice(-4)}` : ''};
    case 'assertion.issued': return {label: 'Assertion', tone: '', who, text: `identity proof for ${d.aud}`, note: `expires ${new Date(d.exp * 1000).toLocaleTimeString()}`};
    case 'owner.created': return {label: 'Owner', tone: '', who: 'Owner', text: `${d.name} set up this registry`};
    case 'owner.key.recovered': return {label: 'Recovery', tone: 'ask', who: 'Owner', text: 'owner key rotated from the host terminal'};
    default: return {label: e.kind, tone: '', who, text: ''};
  }
}
