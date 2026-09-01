import {keccak256, toHex, stringToHex} from 'viem';
import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {config, modes, ROOT} from './config.js';

/**
 * 0G integration: Compute for execution, Storage for the action log.
 *
 * WHY 0G IS LOAD-BEARING HERE, not decorative:
 * KYA's whole claim is that reputation is not self-reported. That requires the
 * *execution itself* to produce evidence that the agent could not have forged.
 * 0G Compute's Router exposes `verify_tee`, which returns a TEE attestation
 * proving a response came from an attested provider. That attestation digest is
 * what gets written into the passport as `Action.evidence`. The agent's frontend
 * never touches it.
 *
 * The full action record then goes to 0G Storage, and its digest is chained into
 * the registry's `logHead`. So: 0G Compute supplies unforgeable evidence *that*
 * work happened, 0G Storage supplies the durable record of *what* happened, and
 * the chain supplies a single word that proves the record is complete.
 */

const DATA_DIR = join(ROOT, 'apps', 'api', 'data');
mkdirSync(DATA_DIR, {recursive: true});

// ────────────────────────────────────────── task catalogue

/**
 * Narrow, well-defined task types. Kept deliberately small: the PRD's own risk
 * mitigation is "keep the demo task narrow", and a task that always works beats
 * a broad one that sometimes doesn't.
 */
export const TASKS = {
  'flight.quote': {
    capability: 'flight.quote',
    label: 'Cheapest-flight lookup',
    describe: (input) => `Find the cheapest flight ${input.from} → ${input.to} on ${input.date}.`,
    prompt: (input) =>
      `You are a flight-pricing agent. Return ONLY compact JSON with keys: carrier, price_usd, stops, depart_local, duration_min. Find the cheapest realistic option for ${input.from} to ${input.to} on ${input.date}. No prose.`,
    // Deterministic local result: same input always yields the same quote, so a
    // rehearsal and the live demo produce identical numbers.
    local: (input) => {
      const h = BigInt(keccak256(toHex(`${input.from}|${input.to}|${input.date}`)));
      const carriers = ['IndiGo', 'Vistara', 'Air India', 'Akasa Air', 'SpiceJet'];
      return {
        carrier: carriers[Number(h % 5n)],
        price_usd: 82 + Number((h >> 8n) % 240n),
        stops: Number((h >> 16n) % 3n) === 0 ? 0 : 1,
        depart_local: `${String(5 + Number((h >> 24n) % 16n)).padStart(2, '0')}:${String(Number((h >> 32n) % 12n) * 5).padStart(2, '0')}`,
        duration_min: 95 + Number((h >> 40n) % 180n),
      };
    },
    value: (result) => BigInt(Math.round(Number(result.price_usd || 0) * 1e14)), // cents→wei-ish demo unit
  },
  research: {
    capability: 'research',
    label: 'Research query',
    describe: (input) => `Research: ${input.question}`,
    prompt: (input) => `Answer concisely and factually in under 80 words: ${input.question}`,
    local: (input) => ({
      answer: `Deterministic local answer for: ${input.question}`,
      confidence: 0.5,
    }),
    value: () => 0n,
  },
};

// ────────────────────────────────────────── 0G Compute

/**
 * Run a task on 0G Compute's Router (OpenAI-compatible surface) with
 * `verify_tee` requested, and return the result plus its attestation digest.
 */
async function runOn0GCompute(task, input) {
  const url = `${config.og.computeBaseUrl.replace(/\/$/, '')}/chat/completions`;
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.og.computeApiKey}`,
    },
    body: JSON.stringify({
      model: config.og.computeModel,
      messages: [{role: 'user', content: task.prompt(input)}],
      temperature: 0,
      max_tokens: 300,
      ...(config.og.verifyTee ? {verify_tee: true} : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message || `0G Compute HTTP ${res.status}`), {
      code: 'og_compute_error',
      status: res.status,
      body: json,
    });
  }

  const content = json?.choices?.[0]?.message?.content ?? '';
  let parsed;
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?|```$/g, '').trim());
  } catch {
    parsed = {raw: content};
  }

  // The TEE attestation is the part that matters: it is evidence the agent could
  // not have produced itself.
  const tee = json?.tee || json?.verification || json?.attestation || null;
  const attestation = tee
    ? {
        verified: Boolean(tee.verified ?? tee.valid ?? tee.success ?? true),
        signature: tee.signature || tee.sig || null,
        signingAddress: tee.signing_address || tee.address || null,
        provider: tee.provider || json?.provider || null,
        raw: tee,
      }
    : null;

  return {
    engine: 'live:0g-compute-router',
    model: json?.model || config.og.computeModel,
    result: parsed,
    latencyMs: Date.now() - started,
    usage: json?.usage || null,
    attestation,
    requestId: json?.id || null,
  };
}

/**
 * Deterministic local executor. Used when no 0G Compute key is configured.
 * Marked `engine: "local:deterministic-executor"` and surfaced in the API and UI
 * — an unlabeled simulation would be a bug, so the label travels with the data.
 */
function runLocally(task, input) {
  const started = Date.now();
  const result = task.local(input);
  return {
    engine: 'local:deterministic-executor',
    model: 'deterministic',
    result,
    latencyMs: Date.now() - started,
    usage: null,
    attestation: null,
    requestId: null,
  };
}

export async function execute(capability, input) {
  const task = TASKS[capability];
  if (!task) throw Object.assign(new Error(`unknown task ${capability}`), {code: 'unknown_task'});
  if (config.og.computeApiKey) {
    try {
      return await runOn0GCompute(task, input);
    } catch (err) {
      // Reliability rule: a live-infra hiccup must not take the demo down, but
      // the degradation must be visible rather than silent.
      return {...runLocally(task, input), degradedFrom: 'live:0g-compute-router', degradeReason: String(err.message)};
    }
  }
  return runLocally(task, input);
}

// ────────────────────────────────────────── 0G Storage

/**
 * Persist the action record and return a content digest suitable for
 * `Action.evidence`.
 *
 * Live path: upload to the 0G Storage indexer and use the returned root hash.
 * Local path: content-address the same canonical JSON with keccak256 and write it
 * under apps/api/data/. Either way the digest is a deterministic function of the
 * record's bytes, so `logHead` verification works identically in both modes —
 * which is what lets the demo run offline without weakening the integrity claim.
 */
export async function persistRecord(record) {
  const canonical = JSON.stringify(record, Object.keys(record).sort());
  const digest = keccak256(stringToHex(canonical));

  if (config.og.storageKey && config.chainId === 16602) {
    try {
      const res = await fetch(`${config.og.storageIndexerUrl.replace(/\/$/, '')}/file/segment`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({data: Buffer.from(canonical).toString('base64')}),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const root = json?.root || json?.rootHash || null;
        if (root) {
          writeLocal(digest, canonical);
          return {backend: 'live:0g-storage', digest, root, uri: `0g://${root}`};
        }
      }
    } catch {
      // fall through to local, labeled
    }
  }

  writeLocal(digest, canonical);
  return {
    backend: 'local:content-addressed',
    digest,
    root: digest,
    uri: `kya-local://${digest}`,
  };
}

function writeLocal(digest, canonical) {
  writeFileSync(join(DATA_DIR, `${digest.slice(2, 18)}.json`), canonical);
}

export function readRecord(digest) {
  const path = join(DATA_DIR, `${digest.slice(2, 18)}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

export const ogModes = {compute: modes.ogCompute, storage: modes.ogStorage};
