import {encodeRegister, encodeSetAgentURI, parseRegisteredLog} from '../../../../packages/sdk/src/erc8004.js';

const eth = () => window.ethereum;
export const hasWallet = () => !!eth();
const hexId = id => `0x${Number(id).toString(16)}`;

export async function connect() {
  const [account] = await eth().request({method: 'eth_requestAccounts'});
  return account;
}

export async function switchChain(chain) {
  try {
    await eth().request({method: 'wallet_switchEthereumChain', params: [{chainId: hexId(chain.id)}]});
  } catch (e) {
    if (e.code !== 4902) throw e;
    await eth().request({method: 'wallet_addEthereumChain', params: [{chainId: hexId(chain.id), chainName: chain.name, rpcUrls: [chain.rpc], blockExplorerUrls: [chain.explorer], nativeCurrency: {name: chain.currency, symbol: chain.currency, decimals: 18}}]});
  }
}

async function waitReceipt(hash, tries = 90) {
  for (let i = 0; i < tries; i++) {
    const r = await eth().request({method: 'eth_getTransactionReceipt', params: [hash]});
    if (r) return r;
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error('Transaction not confirmed yet. Check the explorer, then link the agent by its ID.');
}

/** register(agentURI) on the ERC-8004 Identity Registry; resolves with the minted agentId. */
export async function registerAgent({from, chain, agentURI, onSubmitted}) {
  const hash = await eth().request({method: 'eth_sendTransaction', params: [{from, to: chain.registry, data: encodeRegister(agentURI)}]});
  onSubmitted?.(hash);
  const receipt = await waitReceipt(hash);
  if (receipt.status !== '0x1') throw new Error('The registration transaction reverted.');
  const agentId = parseRegisteredLog(receipt, chain.registry);
  if (!agentId) throw new Error('Registered, but no Registered event was found in the receipt.');
  return {agentId, txHash: hash};
}

export async function updateUri({from, chain, agentId, agentURI}) {
  const hash = await eth().request({method: 'eth_sendTransaction', params: [{from, to: chain.registry, data: encodeSetAgentURI(agentId, agentURI)}]});
  await waitReceipt(hash);
  return hash;
}
