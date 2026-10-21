export const TEMPLATES = [
  {
    id: 'coding', name: 'Coding agent', blurb: 'Reads and edits the repo, never secrets, asks before pushing.',
    description: 'Works inside a repository via MCP filesystem and git tools.',
    scopes: [
      {mode: 'allow', action: 'read_file', resources: ['/Users/me/project/*'], maxAmount: ''},
      {mode: 'deny', action: 'read_file', resources: ['/Users/me/project/.env*'], maxAmount: ''},
      {mode: 'allow', action: 'write_file', resources: ['/Users/me/project/src/*'], maxAmount: ''},
      {mode: 'ask', action: 'git.push', resources: ['origin/*'], maxAmount: ''},
    ],
    limits: {budget: {amount: '', windowHours: 24}, rate: {count: 120, windowMinutes: 1}},
  },
  {
    id: 'ops', name: 'Spending agent', blurb: 'Pays small invoices alone, asks above $100, capped at $500 a day.',
    description: 'Pays vendor invoices on behalf of finance.',
    scopes: [
      {mode: 'allow', action: 'payments.send', resources: ['*'], maxAmount: 100},
      {mode: 'ask', action: 'payments.send', resources: ['*'], maxAmount: 500},
      {mode: 'allow', action: 'invoices.read', resources: ['*'], maxAmount: ''},
    ],
    limits: {budget: {amount: 500, windowHours: 24}, rate: {count: 30, windowMinutes: 60}},
  },
  {
    id: 'support', name: 'Support agent', blurb: 'Reads tickets and drafts. A human approves anything sent.',
    description: 'Triage and draft replies in the helpdesk.',
    scopes: [
      {mode: 'allow', action: 'tickets.read', resources: ['*'], maxAmount: ''},
      {mode: 'allow', action: 'reply.draft', resources: ['*'], maxAmount: ''},
      {mode: 'ask', action: 'reply.send', resources: ['*'], maxAmount: ''},
      {mode: 'deny', action: 'customers.export', resources: ['*'], maxAmount: ''},
    ],
    limits: {budget: {amount: '', windowHours: 24}, rate: {count: '', windowMinutes: 1}},
  },
  {
    id: 'blank', name: 'Start blank', blurb: 'One example rule. Everything else is denied by default.',
    description: '',
    scopes: [{mode: 'allow', action: 'files.read', resources: ['workspace/*'], maxAmount: ''}],
    limits: {budget: {amount: '', windowHours: 24}, rate: {count: '', windowMinutes: 1}},
  },
];

export const toPayload = ({scopes, limits}) => ({
  scopes: scopes.map(s => ({
    mode: s.mode, action: s.action.trim(), maxAmount: s.maxAmount === '' ? null : Number(s.maxAmount),
    resources: (Array.isArray(s.resources) ? s.resources : String(s.resources).split(',')).map(r => r.trim()).filter(Boolean),
  })),
  limits: {
    budget: limits.budget?.amount === '' || limits.budget?.amount == null ? null : {amount: Number(limits.budget.amount), windowHours: Number(limits.budget.windowHours || 24)},
    rate: limits.rate?.count === '' || limits.rate?.count == null ? null : {count: Number(limits.rate.count), windowMinutes: Number(limits.rate.windowMinutes || 1)},
  },
});

export const fromAgent = a => ({
  scopes: a.scopes.map(s => ({...s, maxAmount: s.maxAmount ?? '', resources: s.resources.join(', ')})),
  limits: {
    budget: a.limits?.budget ?? {amount: '', windowHours: 24},
    rate: a.limits?.rate ?? {count: '', windowMinutes: 1},
  },
});
