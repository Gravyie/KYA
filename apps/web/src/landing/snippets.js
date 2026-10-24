export const SNIPPETS = {
  mcp: {
    label: 'MCP server',
    title: 'claude_desktop_config.json',
    note: 'Wrap any MCP server. Calls the agent is not allowed to make never reach it, and tools it can’t use are hidden from tools/list.',
    code: `{
  "mcpServers": {
    "files": {
      "command": "node",
      "args": ["/path/to/mihari/packages/mcp/bin/mihari-mcp.js", "--",
               "npx", "@modelcontextprotocol/server-filesystem", "/Users/me/project"],
      "env": { "MIHARI_AGENT_KEY": "mia_…" }
    }
  }
}`,
  },
  sdk: {
    label: 'Node SDK',
    title: 'agent.mjs',
    note: 'Wrap any function. If Wardrail is unreachable the call fails closed, and an “ask” rule waits for a human.',
    code: `// npm install /path/to/mihari/packages/sdk
import { createMihari } from '@mihari/sdk';

const guard = createMihari({ agentKey: process.env.MIHARI_AGENT_KEY });

// Throws MihariDeniedError unless a rule allows it (or a human approves).
const report = await guard.run(
  { action: 'files.read', resource: 'workspace/q3.md' },
  () => readFile('q3.md', 'utf8'),
);

const wire = guard.wrap('payments.send', sendWire, {
  resource: (to) => to,
  amount: (to, usd) => usd,
});
await wire('acme-corp', 4200); // → pauses for approval`,
  },
  rest: {
    label: 'REST',
    title: 'any language',
    note: 'Three calls from any runtime: ask, (poll if “ask”), then report the outcome.',
    code: `curl -s localhost:5055/api/authorize \\
  -H "authorization: Bearer $MIHARI_AGENT_KEY" \\
  -d '{"action":"send_email","resource":"cfo@acme.co","note":"Q3 numbers"}'

# → {"decision":{"outcome":"ask","allowed":false,"reason":"This rule requires owner approval"},
#    "eventId":"c1f0…"}

curl -s localhost:5055/api/authorize/c1f0…  -H "authorization: Bearer $MIHARI_AGENT_KEY"
# → {"status":"approved","decision":{"allowed":true}}`,
  },
  verify: {
    label: 'Verify an agent',
    title: 'partner-api.mjs',
    note: 'The receiving side. Agents present a short-lived signed assertion; you verify it offline and check revocation.',
    code: `import { verifyAssertion, checkStatus } from '@mihari/sdk';   // same package

const check = verifyAssertion(token, {
  publicKey: PINNED_REGISTRY_KEY,
  audience: 'https://api.partner.com',
});
if (!check.valid) return deny(check.reason);

const { active } = await checkStatus(REGISTRY_URL, check.claims.sub);
if (!active) return deny('agent revoked');

// check.claims → { name, operator: 'Acme Inc.', scp: ['payments.send'], exp }`,
  },
};

SNIPPETS.chain = {
  label: 'Publish on-chain',
  title: 'ERC-8004 · free on testnet',
  note: 'Registers the agent in the public ERC-8004 Identity Registry. The registration file rides inside the transaction, so there is nothing to host. The console does this with your wallet in one click.',
  code: `# 1. get the passport as a self-contained agentURI
curl -s $MIHARI_URL/api/agents/$AGENT_ID/erc8004 -H "authorization: Bearer $OWNER_KEY" | jq -r .agentURI

# 2. register it (Base Sepolia identity registry, free testnet gas)
cast send 0x8004A818BFB912233c491871b3d84c89A494BD9e "register(string)" "$AGENT_URI" \\
  --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY

# 3. link the minted agentId back to Wardrail (it verifies ownership on-chain)
curl -s $MIHARI_URL/api/agents/$AGENT_ID/onchain -H "authorization: Bearer $OWNER_KEY" \\
  -d '{"chainId":84532,"agentId":10353}'`,
};

export const DECISIONS = {
  allow: ['read_file  workspace/q3-report.md', 'web.search  “seed round benchmarks”', 'git.commit  feat/billing-webhooks', 'calendar.read  team@acme.co', 'db.query  analytics.events'],
  ask: ['send_email  cfo@acme.co', 'payments.send  $4,200 → vendor', 'git.push  origin/main', 'files.write  contracts/msa.pdf'],
  deny: ['shell.run  rm -rf /', 'read_file  .env', 'payments.send  $90,000', 'db.drop  customers', 'read_file  ~/.ssh/id_ed25519'],
};
