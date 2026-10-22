import {CHAINS, encodeOwnerOf, encodeTokenURI, decodeAddress, decodeString, fromDataUri} from '../../../packages/sdk/src/erc8004.js';

export const chainList = () => Object.values(CHAINS).map(({rpc: _rpc, ...c}) => c);
export const getChain = id => CHAINS[Number(id)] ?? null;
const rpcUrl = chain => process.env[`MIHARI_RPC_${chain.id}`] || chain.rpc;

async function ethCall(chain, data) {
  const res = await fetch(rpcUrl(chain), {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{to: chain.registry, data}, 'latest']}),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();
  if (json.error) throw Object.assign(new Error(json.error.message || 'RPC error'), {revert: true});
  return json.result;
}

/** Read an ERC-8004 identity from its registry. Returns null if the agentId does not exist. */
export async function readIdentity(chainId, agentId) {
  const chain = getChain(chainId);
  if (!chain) throw Object.assign(new Error('Unsupported chain'), {status: 400});
  if (!/^\d{1,30}$/.test(String(agentId))) throw Object.assign(new Error('agentId must be a number'), {status: 400});
  try {
    const owner = decodeAddress(await ethCall(chain, encodeOwnerOf(agentId)));
    const tokenURI = decodeString(await ethCall(chain, encodeTokenURI(agentId)));
    const file = fromDataUri(tokenURI);
    return {chain, agentId: String(agentId), owner, tokenURI, file, uriKind: tokenURI.startsWith('data:') ? 'data' : tokenURI.startsWith('ipfs://') ? 'ipfs' : tokenURI.startsWith('http') ? 'https' : 'other'};
  } catch (e) {
    if (e.revert) return null; // ownerOf reverts for unknown ids
    throw Object.assign(new Error(`Could not read ${chain.name}: ${e.message}`), {status: 502});
  }
}
