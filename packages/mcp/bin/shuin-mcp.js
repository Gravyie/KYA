#!/usr/bin/env node
import {createMcpGuard} from '../src/proxy.js';

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const flags = split === -1 ? [] : argv.slice(0, split);
const upstream = split === -1 ? [] : argv.slice(split + 1);
const opt = name => { const i = flags.indexOf(name); return i === -1 ? undefined : flags[i + 1]; };

if (!upstream.length || flags.includes('--help')) {
  console.error(`shuin-mcp: put a policy firewall in front of any MCP server

  shuin-mcp [--url http://127.0.0.1:5055] [--key sa_…] [--resource-arg path] [--no-filter] -- <server command> [args…]

  --key           agent key (or set SHUIN_AGENT_KEY)
  --url           Shuin registry (or SHUIN_URL), default http://127.0.0.1:5055
  --resource-arg  tool argument that names the resource (default: first of path, url, uri, query, command…)
  --no-filter     do not hide tools the agent has no rule for

  Claude Desktop / Cursor config:
    "command": "npx", "args": ["@shuin/mcp", "--", "npx", "@modelcontextprotocol/server-filesystem", "/path"],
    "env": {"SHUIN_AGENT_KEY": "sa_…"}`);
  process.exit(upstream.length ? 0 : 2);
}
const agentKey = opt('--key') || process.env.SHUIN_AGENT_KEY;
if (!agentKey) { console.error('shuin-mcp: set SHUIN_AGENT_KEY or pass --key'); process.exit(2); }

createMcpGuard({
  command: upstream[0], args: upstream.slice(1), agentKey,
  baseUrl: opt('--url') || process.env.SHUIN_URL || 'http://127.0.0.1:5055',
  resourceArg: opt('--resource-arg'), filterTools: !flags.includes('--no-filter'),
  log: m => process.stderr.write(`[shuin] ${m}\n`),
});
