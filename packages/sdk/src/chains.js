import {defineChain} from 'viem';
import {anvil} from 'viem/chains';

/** 0G Galileo testnet — KYA's home chain. Identity and execution receipts share it. */
export const galileo = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: {name: '0G', symbol: 'OG', decimals: 18},
  rpcUrls: {default: {http: ['https://evmrpc-testnet.0g.ai']}},
  blockExplorers: {default: {name: '0G Chainscan', url: 'https://chainscan-galileo.0g.ai'}},
  testnet: true,
});

export const CHAINS = {
  31337: anvil,
  16602: galileo,
};

export function chainById(id) {
  const chain = CHAINS[Number(id)];
  if (!chain) throw new Error(`unsupported chainId ${id}`);
  return chain;
}

export function explorerTxUrl(chainId, hash) {
  const chain = CHAINS[Number(chainId)];
  const base = chain?.blockExplorers?.default?.url;
  return base ? `${base}/tx/${hash}` : null;
}
