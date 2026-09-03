import {readFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..', '..', '..');

/** Load .env without a dependency. Later keys win; existing process env wins over file. */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(ROOT, '.env'));

const CHAIN_ID = Number(process.env.CHAIN_ID || 31337);

function loadDeployment(chainId) {
  const path = join(ROOT, 'deployments', `${chainId}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `no deployment for chain ${chainId} at ${path} — run \`pnpm deploy:local\` (anvil) or the Galileo deploy first`,
    );
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const deployment = loadDeployment(CHAIN_ID);

/**
 * Every integration is either LIVE (real sponsor infrastructure) or LOCAL
 * (deterministic stand-in). The mode is computed once, exposed over the API and
 * rendered in the UI. Nothing in this codebase presents a local stand-in as a
 * live sponsor call — an unlabeled simulation is a bug, not a fallback.
 */
const normalizeKey = (key) => (key && !key.startsWith('0x') ? `0x${key}` : key) || null;

export const config = {
  chainId: CHAIN_ID,
  rpcUrl: process.env.RPC_URL || (CHAIN_ID === 31337 ? 'http://127.0.0.1:8545' : 'https://evmrpc-testnet.0g.ai'),
  contracts: deployment.contracts,
  parentName: deployment.parentName,
  port: Number(process.env.PORT || 5055),

  attestorKey: normalizeKey(process.env.ATTESTOR_PRIVATE_KEY),
  executorKey: normalizeKey(process.env.EXECUTOR_PRIVATE_KEY || process.env.PRIVATE_KEY),
  ownerKey: normalizeKey(process.env.OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY),

  world: {
    appId: process.env.WORLD_APP_ID || null,
    action: process.env.WORLD_ACTION || 'kya-verify-owner',
    // Cloud verify endpoint. Present only when an app_id is configured.
    verifyUrl: process.env.WORLD_APP_ID
      ? `https://developer.worldcoin.org/api/v2/verify/${process.env.WORLD_APP_ID}`
      : null,
  },

  og: {
    computeApiKey: process.env.OG_COMPUTE_API_KEY || null,
    computeBaseUrl: process.env.OG_COMPUTE_BASE_URL || 'https://api.0g.ai/v1',
    computeModel: process.env.OG_COMPUTE_MODEL || 'gpt-oss-120b',
    verifyTee: process.env.OG_VERIFY_TEE !== 'false',
    storageIndexerUrl: process.env.OG_STORAGE_INDEXER || 'https://indexer-storage-testnet-turbo.0g.ai',
    storageKey: process.env.OG_STORAGE_PRIVATE_KEY || process.env.PRIVATE_KEY || null,
  },
};

export const modes = {
  chain: CHAIN_ID === 16602 ? 'live:0g-galileo' : 'local:anvil',
  worldId: config.world.appId ? 'live:world-cloud-verify' : 'local:attestor-signed',
  ogCompute: config.og.computeApiKey ? 'live:0g-compute-router' : 'local:deterministic-executor',
  ogStorage: config.og.storageKey && CHAIN_ID === 16602 ? 'live:0g-storage' : 'local:content-addressed',
};

export function modeSummary() {
  return Object.entries(modes).map(([surface, mode]) => ({
    surface,
    mode,
    live: mode.startsWith('live:'),
  }));
}
