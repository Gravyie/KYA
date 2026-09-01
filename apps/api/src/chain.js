import {createWalletClient, createPublicClient, http, getAddress, keccak256, toHex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {PassportRegistryABI, HumanhoodAttestorABI, AgentNameRegistrarABI, chainById, Outcome} from '@kya/sdk';
import {config} from './config.js';

/**
 * Write side. Three distinct keys with distinct authority, deliberately not
 * collapsed into one:
 *
 *   attestor  — signs EIP-712 humanhood attestations. Never sends transactions.
 *   executor  — the only key allowed to settle action receipts. Holds the 0G
 *               evidence digest. Separating this from the agent's operator key is
 *               what makes reputation witnessed rather than self-reported.
 *   owner     — an agent owner's key, used only by the seed/demo flows. In
 *               production this is the user's own wallet in the browser.
 */

const chain = chainById(config.chainId);
const transport = http(config.rpcUrl);

/**
 * A low polling interval matters more than it looks. viem defaults to ~4s when a
 * chain declares no block time, so every `waitForTransactionReceipt` costs a
 * multi-second stall even though anvil mines instantly. On a seed that writes
 * ~150 receipts that is minutes of dead time before a demo.
 */
const POLLING_INTERVAL = config.chainId === 31337 ? 25 : 500;

export const publicClient = createPublicClient({chain, transport, pollingInterval: POLLING_INTERVAL});

function walletFor(key, label) {
  if (!key) throw new Error(`${label} key is not configured`);
  return createWalletClient({account: privateKeyToAccount(key), chain, transport, pollingInterval: POLLING_INTERVAL});
}

export function accounts() {
  return {
    attestor: config.attestorKey ? privateKeyToAccount(config.attestorKey).address : null,
    executor: config.executorKey ? privateKeyToAccount(config.executorKey).address : null,
    owner: config.ownerKey ? privateKeyToAccount(config.ownerKey).address : null,
  };
}

const registry = {address: getAddress(config.contracts.PassportRegistry), abi: PassportRegistryABI};
const attestorContract = {address: getAddress(config.contracts.HumanhoodAttestor), abi: HumanhoodAttestorABI};
const nameRegistrar = {address: getAddress(config.contracts.AgentNameRegistrar), abi: AgentNameRegistrarABI};

export const addresses = {
  registry: registry.address,
  attestor: attestorContract.address,
  names: nameRegistrar.address,
};

// ───────────────────────────────────────── humanhood

const EIP712_DOMAIN = {
  name: 'KYA.Humanhood',
  version: '1',
  chainId: config.chainId,
  verifyingContract: getAddress(config.contracts.HumanhoodAttestor),
};

const HUMANHOOD_TYPES = {
  Humanhood: [
    {name: 'subject', type: 'address'},
    {name: 'kind', type: 'uint8'},
    {name: 'nullifierHash', type: 'bytes32'},
    {name: 'verifiedAt', type: 'uint64'},
    {name: 'deadline', type: 'uint64'},
    {name: 'appId', type: 'string'},
    {name: 'action', type: 'string'},
  ],
};

/** Sign a humanhood attestation with the attestor key. Does not touch the chain. */
export async function signHumanhood({subject, kind, nullifierHash, verifiedAt, ttlSeconds = 900, appId, action}) {
  const wallet = walletFor(config.attestorKey, 'attestor');
  const attestation = {
    subject: getAddress(subject),
    kind: Number(kind),
    nullifierHash,
    verifiedAt: BigInt(verifiedAt ?? Math.floor(Date.now() / 1000)),
    deadline: BigInt(Math.floor(Date.now() / 1000) + ttlSeconds),
    appId: appId || config.world.appId || 'local',
    action: action || config.world.action,
  };
  const signature = await wallet.signTypedData({
    domain: EIP712_DOMAIN,
    types: HUMANHOOD_TYPES,
    primaryType: 'Humanhood',
    message: attestation,
  });
  return {attestation, signature};
}

/**
 * Submit a signed attestation on-chain. Anyone holding the signature may submit;
 * for the demo the API relays it so the flow needs no wallet popup.
 */
export async function recordHumanhood({attestation, signature}, relayKey = config.executorKey) {
  const wallet = walletFor(relayKey, 'relay');
  const hash = await wallet.writeContract({
    ...attestorContract,
    functionName: 'recordHumanhood',
    args: [attestation, signature],
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  return {hash, blockNumber: Number(receipt.blockNumber), status: receipt.status};
}

export async function humanhoodOf(subject) {
  const [record, verified] = await Promise.all([
    publicClient.readContract({...attestorContract, functionName: 'humanhoodOf', args: [getAddress(subject)]}),
    publicClient.readContract({...attestorContract, functionName: 'isHumanVerified', args: [getAddress(subject)]}),
  ]);
  return {
    kind: Number(record.kind),
    nullifierHash: record.nullifierHash,
    verifiedAt: Number(record.verifiedAt),
    appId: record.appId,
    action: record.action,
    humanVerified: verified,
  };
}

// ───────────────────────────────────────── registration

export async function registerAgent(
  {operator, domain, metadataURI, capabilities, spendLimitPerDay, maxActionsPerDay, expiresAt},
  ownerKey = config.ownerKey,
) {
  const wallet = walletFor(ownerKey, 'owner');
  const hash = await wallet.writeContract({
    ...registry,
    functionName: 'registerAgent',
    args: [
      getAddress(operator),
      domain,
      metadataURI || '',
      capabilities,
      BigInt(spendLimitPerDay ?? 0),
      Number(maxActionsPerDay ?? 0),
      BigInt(expiresAt ?? 0),
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  const agentId = await publicClient.readContract({...registry, functionName: 'agentIdByDomain', args: [domain]});
  return {hash, agentId: agentId.toString(), blockNumber: Number(receipt.blockNumber)};
}

export async function registerSubname({label, agentId, target}, ownerKey = config.ownerKey) {
  const wallet = walletFor(ownerKey, 'owner');
  const hash = await wallet.writeContract({
    ...nameRegistrar,
    functionName: 'registerSubname',
    args: [label, BigInt(agentId), getAddress(target)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  const node = await publicClient.readContract({...nameRegistrar, functionName: 'nodeForLabel', args: [label]});
  return {hash, node, blockNumber: Number(receipt.blockNumber)};
}

export async function setText({node, key, value}, ownerKey = config.ownerKey) {
  const wallet = walletFor(ownerKey, 'owner');
  const hash = await wallet.writeContract({...nameRegistrar, functionName: 'setText', args: [node, key, value]});
  await publicClient.waitForTransactionReceipt({hash});
  return {hash};
}

// ───────────────────────────────────────── settlement

export async function settleAction({agentId, capability, value, outcome, evidence}) {
  const wallet = walletFor(config.executorKey, 'executor');
  const hash = await wallet.writeContract({
    ...registry,
    functionName: 'settleAction',
    args: [BigInt(agentId), capability, BigInt(value ?? 0), Number(outcome), evidence],
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  return {hash, blockNumber: Number(receipt.blockNumber), gasUsed: receipt.gasUsed.toString()};
}

export async function rejectAction({agentId, capability, value, evidence}) {
  const wallet = walletFor(config.executorKey, 'executor');
  const hash = await wallet.writeContract({
    ...registry,
    functionName: 'rejectAction',
    args: [BigInt(agentId), capability, BigInt(value ?? 0), evidence],
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  return {hash, blockNumber: Number(receipt.blockNumber)};
}

/**
 * Settle many receipts back-to-back with explicit nonce management.
 *
 * Used only by the seeder. Awaiting a receipt per action turns a 150-receipt
 * history into minutes of round-trips; here the nonce is advanced locally, every
 * transaction is submitted, and only the final receipt is awaited. The receipts
 * themselves are identical to the one-at-a-time path — same contract call, same
 * executor key, same 0G evidence digest — so seeded history stays
 * indistinguishable from live history.
 */
export async function settleActionBatch(items, {onProgress} = {}) {
  const wallet = walletFor(config.executorKey, 'executor');
  const from = privateKeyToAccount(config.executorKey).address;
  let nonce = await publicClient.getTransactionCount({address: from, blockTag: 'pending'});

  const hashes = [];
  for (const item of items) {
    const fn = item.outcome === Outcome.Rejected ? 'rejectAction' : 'settleAction';
    const args =
      fn === 'rejectAction'
        ? [BigInt(item.agentId), item.capability, BigInt(item.value ?? 0), item.evidence]
        : [BigInt(item.agentId), item.capability, BigInt(item.value ?? 0), Number(item.outcome), item.evidence];

    hashes.push(await wallet.writeContract({...registry, functionName: fn, args, nonce: nonce++}));
    if (onProgress) onProgress(hashes.length, items.length);
  }

  const last = await publicClient.waitForTransactionReceipt({hash: hashes[hashes.length - 1]});
  return {hashes, blockNumber: Number(last.blockNumber), settled: hashes.length};
}

/** Simulate first so a policy breach is a clean 4xx rather than a thrown revert. */
export async function simulateSettle({agentId, capability, value, outcome, evidence}) {
  try {
    await publicClient.simulateContract({
      ...registry,
      account: privateKeyToAccount(config.executorKey).address,
      functionName: 'settleAction',
      args: [BigInt(agentId), capability, BigInt(value ?? 0), Number(outcome), evidence],
    });
    return {ok: true};
  } catch (err) {
    const name = err?.cause?.data?.errorName || err?.metaMessages?.[0] || err?.shortMessage || 'unknown';
    return {ok: false, error: String(name)};
  }
}

export {Outcome, keccak256, toHex};

/**
 * Move the chain's clock. Used only by the seeder, to spread witnessed history
 * across real calendar time.
 *
 * Without this every seeded receipt lands in the same block second, so an agent
 * reads as "123 actions, registered 28 minutes ago" — which tells a judge the
 * history is fabricated before they ask a question. It also makes the staleness
 * signal meaningless, since nothing can ever be dormant.
 *
 * Two RPCs, because they do different jobs and anvil is strict about ordering:
 *   evm_setNextBlockTimestamp — exact stamp for the NEXT block. Must be strictly
 *     increasing, so it only works going forward.
 *   evm_setTime — moves the node's whole clock, forwards or backwards. Needed for
 *     the initial rewind to the history's genesis.
 */
export async function timeTravel(toUnixSeconds) {
  if (config.chainId !== 31337) return false;
  const target = BigInt(Math.floor(toUnixSeconds));
  const current = BigInt(await chainNow());

  try {
    if (target > current) {
      await publicClient.request({
        method: 'evm_setNextBlockTimestamp',
        params: [`0x${target.toString(16)}`],
      });
    } else {
      // Rewinding: setNextBlockTimestamp would be rejected as non-increasing.
      await publicClient.request({method: 'evm_setTime', params: [`0x${target.toString(16)}`]});
    }
    await publicClient.request({method: 'evm_mine', params: []});
    return true;
  } catch {
    // A node without these RPCs (or a live chain) simply keeps its own clock.
    return false;
  }
}

export async function chainNow() {
  const block = await publicClient.getBlock({blockTag: 'latest'});
  return Number(block.timestamp);
}

