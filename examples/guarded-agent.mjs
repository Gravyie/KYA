import {readFile, realpath} from 'node:fs/promises';
import {resolve, relative, isAbsolute, sep} from 'node:path';
import {createAuctent} from '../packages/agent-sdk/src/index.js';

// Register an agent with action files.read and resource workspace/* first.
const key = process.env.AUCTENT_AGENT_KEY;
if (!key) throw new Error('Set AUCTENT_AGENT_KEY to the agent key shown at registration');
const root = await realpath(process.cwd());
const requested = await realpath(resolve(root, process.argv[2] || 'README.md'));
const pathWithinWorkspace = relative(root, requested);
if (!pathWithinWorkspace || pathWithinWorkspace === '..' || pathWithinWorkspace.startsWith('..' + sep) || isAbsolute(pathWithinWorkspace)) {
  throw new Error('Requested file must be inside the current workspace');
}
const resource = 'workspace/' + pathWithinWorkspace.split(sep).join('/');
const guard = createAuctent({agentKey: key, baseUrl: process.env.AUCTENT_URL});
const content = await guard.run({action: 'files.read', resource, note: `Read ${resource}`}, () => readFile(requested, 'utf8'));
console.log(content.slice(0, 600));
