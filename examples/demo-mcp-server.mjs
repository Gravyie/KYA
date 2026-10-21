// A tiny but real MCP server (stdio, newline-delimited JSON-RPC) with tools that
// have real side effects inside ./.sigilant-demo/. Put Sigilant in front of it:
//   sigilant-mcp -- node examples/demo-mcp-server.mjs
import {readFile, writeFile, appendFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {createInterface} from 'node:readline';

const sandbox = resolve('.sigilant-demo');
await mkdir(sandbox, {recursive: true});

const tools = [
  {name: 'read_file', description: 'Read a UTF-8 file', inputSchema: {type: 'object', properties: {path: {type: 'string'}}, required: ['path']}},
  {name: 'write_file', description: 'Write a file inside the demo sandbox', inputSchema: {type: 'object', properties: {path: {type: 'string'}, content: {type: 'string'}}, required: ['path', 'content']}},
  {name: 'http_get', description: 'Fetch a URL (first 400 chars)', inputSchema: {type: 'object', properties: {url: {type: 'string'}}, required: ['url']}},
  {name: 'send_payment', description: 'Append a payment to the demo ledger (no real money moves)', inputSchema: {type: 'object', properties: {to: {type: 'string'}, amount: {type: 'number'}}, required: ['to', 'amount']}},
];

const impl = {
  read_file: async ({path}) => (await readFile(path, 'utf8')).slice(0, 2000),
  write_file: async ({path, content}) => { const f = resolve(sandbox, path.replace(/^\/+/, '')); await mkdir(dirname(f), {recursive: true}); await writeFile(f, content); return `wrote ${f}`; },
  http_get: async ({url}) => (await (await fetch(url)).text()).slice(0, 400),
  send_payment: async ({to, amount}) => { await appendFile(resolve(sandbox, 'ledger.txt'), `${new Date().toISOString()}  pay ${to}  ${amount}\n`); return `recorded payment of ${amount} to ${to}`; },
};

const reply = (id, result) => process.stdout.write(JSON.stringify({jsonrpc: '2.0', id, result}) + '\n');
createInterface({input: process.stdin}).on('line', async line => {
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') return reply(msg.id, {protocolVersion: '2025-03-26', capabilities: {tools: {}}, serverInfo: {name: 'sigilant-demo-server', version: '1.0.0'}});
  if (msg.method === 'tools/list') return reply(msg.id, {tools});
  if (msg.method === 'tools/call') {
    try { reply(msg.id, {content: [{type: 'text', text: await impl[msg.params.name](msg.params.arguments ?? {})}]}); }
    catch (e) { reply(msg.id, {isError: true, content: [{type: 'text', text: String(e.message)}]}); }
    return;
  }
  if (msg.id !== undefined) reply(msg.id, {});
});
