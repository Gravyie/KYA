import {createWalletClient, http, parseEther, createPublicClient} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

const PK = process.argv[2];
if (!PK) throw new Error('missing pk');
const account = privateKeyToAccount(PK.startsWith('0x') ? PK : `0x${PK}`);

const chain = {
  id: 16602,
  name: 'Galileo',
  network: 'galileo',
  nativeCurrency: {name: 'A0GI', symbol: 'A0GI', decimals: 18},
  rpcUrls: {default: {http: ['https://evmrpc-testnet.0g.ai']}},
};

const client = createWalletClient({account, chain, transport: http()});
const pub = createPublicClient({chain, transport: http()});

const KEYS = {
  ownerA: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  ownerB: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  ownerC: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  opOptimizer: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  opScout: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  opDrifter: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
};

async function run() {
  const amount = parseEther('0.01');
  for (const [name, pk] of Object.entries(KEYS)) {
    const to = privateKeyToAccount(pk).address;
    console.log(`funding ${name} (${to})...`);
    const hash = await client.sendTransaction({to, value: amount});
    await pub.waitForTransactionReceipt({hash});
    console.log(`funded ${name} - ${hash}`);
  }
}
run().catch(console.error);
