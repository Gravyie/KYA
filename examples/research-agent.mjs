// A complete agent loop with every guard in play. Register an agent in the console with:
//   files.read  workspace/*        (allow)
//   files.write workspace/out/*    (ask)    ← you approve this one in the console
//   files.read  workspace/.env     (deny)
// then:  MIHARI_AGENT_KEY=mia_… node examples/research-agent.mjs
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createMihari, MihariDeniedError} from '../packages/sdk/src/index.js';

const guard = createMihari({
  agentKey: process.env.MIHARI_AGENT_KEY, baseUrl: process.env.MIHARI_URL,
  onApprovalPending: a => console.log(`   … waiting for a human to approve (${a.eventId.slice(0, 8)})`),
});

async function attempt(label, spec, tool) {
  process.stdout.write(`→ ${label}\n`);
  try { const out = await guard.run(spec, tool); console.log('   allowed'); return out; }
  catch (e) { if (e instanceof MihariDeniedError) console.log(`   blocked: ${e.decision.reason}`); else throw e; }
}

const readme = await attempt('read README.md', {action: 'files.read', resource: 'workspace/README.md'}, () => readFile('README.md', 'utf8'));
await attempt('read .env (should be blocked)', {action: 'files.read', resource: 'workspace/.env'}, () => readFile('.env', 'utf8'));
await attempt('write a summary (needs approval)', {action: 'files.write', resource: 'workspace/out/summary.md', note: 'Summarising README for the weekly report'},
  async () => { await mkdir('.mihari-demo', {recursive: true}); await writeFile('.mihari-demo/summary.md', `# Summary\n${(readme ?? '').slice(0, 300)}\n`); });
