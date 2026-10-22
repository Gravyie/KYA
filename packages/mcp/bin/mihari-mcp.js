#!/usr/bin/env node
import {createMcpGuard} from '../src/proxy.js';

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const flags = split === -1 ? [] : argv.slice(0, split);
const upstream = split === -1 ? [] : argv.slice(split + 1);
const opt = name => { const i = flags.indexOf(name); return i === -1 ? undefined : flags[i + 1]; };

if (!upstream.length || flags.includes('--help')) {
  console.error(`mihari-mcp: put a policy firewall in front of any MCP server

  mihari-mcp [--url http://127.0.0.1:5055] [--key mia_…] [--resource-arg path] [--no-filter] -- <server command> [args…]

  --key           agent key (or set MIHARI_AGENT_KEY)
  --url           Mihari registry (or MIHARI_URL), default http://127.0.0.1:5055
  --resource-arg  tool argument that names the resource (default: first of path, url, uri, query, command…)
  --no-filter     do not hide tools the agent has no rule for

  Claude Desktop / Cursor config:
    "command": "npx", "args": ["@mihari/mcp", "--", "npx", "@modelcontextprotocol/server-filesystem", "/path"],
    "env": {"MIHARI_AGENT_KEY": "mia_…"}`);
  process.exit(upstream.length ? 0 : 2);
}
const agentKey = opt('--key') || process.env.MIHARI_AGENT_KEY;
if (!agentKey) { console.error('mihari-mcp: set MIHARI_AGENT_KEY or pass --key'); process.exit(2); }

createMcpGuard({
  command: upstream[0], args: upstream.slice(1), agentKey,
  baseUrl: opt('--url') || process.env.MIHARI_URL || 'http://127.0.0.1:5055',
  resourceArg: opt('--resource-arg'), filterTools: !flags.includes('--no-filter'),
  log: m => process.stderr.write(`[mihari] ${m}\n`),
});
