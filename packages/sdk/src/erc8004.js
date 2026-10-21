/*
 * ERC-8004 ("Trustless Agents") helpers: chain registry, registration-file
 * builder, and the few ABI calls Shuin needs. Pure functions, no dependencies,
 * so the server, the SDK and the browser console share one implementation.
 * Spec: https://eips.ethereum.org/EIPS/eip-8004
 */

export const REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
export const REGISTERED_TOPIC = '0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a'; // Registered(uint256,string,address)

// Identity Registry deployments (confirmed on-chain: name() = "AgentIdentity", symbol() = "AGENT").
export const CHAINS = {
  84532: {id: 84532, name: 'Base Sepolia', testnet: true, rpc: 'https://sepolia.base.org', registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', explorer: 'https://sepolia.basescan.org', currency: 'ETH'},
  11155111: {id: 11155111, name: 'Ethereum Sepolia', testnet: true, rpc: 'https://ethereum-sepolia-rpc.publicnode.com', registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', explorer: 'https://sepolia.etherscan.io', currency: 'ETH'},
  8453: {id: 8453, name: 'Base', testnet: false, rpc: 'https://mainnet.base.org', registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', explorer: 'https://basescan.org', currency: 'ETH'},
};

export const agentRegistryId = (chainId, registry) => `eip155:${chainId}:${registry}`;

const SELECTORS = {register: '0xf2c298be', setAgentURI: '0x0af28bd3', ownerOf: '0x6352211e', tokenURI: '0xc87b56dd'};
const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const word = n => BigInt(n).toString(16).padStart(64, '0');
const fromHex = h => Uint8Array.from(h.match(/../g) ?? [], b => parseInt(b, 16));
const pad32 = h => h.padEnd(Math.ceil(h.length / 64) * 64, '0');
const stringTail = s => { const b = enc.encode(s); return word(b.length) + pad32(hex(b)); };

export const encodeRegister = uri => `${SELECTORS.register}${word(32)}${stringTail(uri)}`;
export const encodeSetAgentURI = (agentId, uri) => `${SELECTORS.setAgentURI}${word(agentId)}${word(64)}${stringTail(uri)}`;
export const encodeOwnerOf = agentId => `${SELECTORS.ownerOf}${word(agentId)}`;
export const encodeTokenURI = agentId => `${SELECTORS.tokenURI}${word(agentId)}`;

export function decodeAddress(result) {
  const h = String(result).replace(/^0x/, '');
  if (h.length < 64) throw new Error('Not an address result');
  return `0x${h.slice(24, 64)}`;
}
export function decodeString(result) {
  const h = String(result).replace(/^0x/, '');
  const offset = Number(BigInt(`0x${h.slice(0, 64)}`)) * 2;
  const len = Number(BigInt(`0x${h.slice(offset, offset + 64)}`)) * 2;
  return dec.decode(fromHex(h.slice(offset + 64, offset + 64 + len)));
}

/** Find the agentId a transaction minted, from its receipt logs. */
export function parseRegisteredLog(receipt, registry) {
  const log = receipt?.logs?.find(l => l.address?.toLowerCase() === registry.toLowerCase() && l.topics?.[0] === REGISTERED_TOPIC);
  return log ? BigInt(log.topics[1]).toString() : null;
}

const b64 = s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64'));
const unb64 = s => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'));

/** A fully self-contained agentURI: no hosting, no IPFS pin, free. */
export function toDataUri(obj) {
  const bytes = enc.encode(JSON.stringify(obj));
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return `data:application/json;base64,${b64(bin)}`;
}
export function fromDataUri(uri) {
  const m = /^data:application\/json(?:;charset=[^;,]+)?(;base64)?,(.*)$/s.exec(String(uri));
  if (!m) return null;
  try {
    if (m[1]) { const bin = unb64(m[2]); return JSON.parse(dec.decode(Uint8Array.from(bin, c => c.charCodeAt(0)))); }
    return JSON.parse(decodeURIComponent(m[2]));
  } catch { return null; }
}

const SIGIL = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#0a0f0d'/><circle cx='32' cy='32' r='15' fill='none' stroke='#eaf6f0' stroke-width='5'/><circle cx='32' cy='32' r='5' fill='#1fcf8e'/></svg>";

/** Build the ERC-8004 registration file for a Shuin agent. */
export function registrationFile({agent, operator, origin, issuer, fingerprint, onchain}) {
  const description = agent.description || `${agent.name}: an AI agent operated by ${operator}. Every action it takes is checked against policy and recorded in a verifiable audit log.`;
  return {
    type: REGISTRATION_TYPE,
    name: agent.name,
    description,
    image: `data:image/svg+xml;utf8,${encodeURIComponent(SIGIL)}`,
    services: [
      {name: 'shuin-card', endpoint: `${origin}/api/agents/${agent.id}/card`, version: '1'},
      {name: 'shuin-status', endpoint: `${origin}/api/agents/${agent.id}/status`, version: '1'},
    ],
    x402Support: false,
    active: agent.status === 'active',
    registrations: onchain ? [{agentId: Number(onchain.agentId), agentRegistry: agentRegistryId(onchain.chainId, onchain.registry)}] : [],
    shuin: {
      agentId: agent.id, operator, issuer, registryFingerprint: fingerprint,
      actions: [...new Set(agent.scopes.filter(s => s.mode !== 'deny').map(s => s.action))],
    },
  };
}
