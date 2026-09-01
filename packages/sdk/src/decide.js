import {formatEther} from 'viem';
import {REASONS} from './enums.js';

/**
 * The trust decision engine.
 *
 * A registry that merely *stores* reputation leaves the hard part to the relying
 * party: turning a pile of fields into a yes or no. KYA's actual product surface
 * is this function — `check(passport, policy)` returns a signed-off verdict plus
 * the evidence that produced it, so a task-routing app makes one call instead of
 * reimplementing trust logic.
 *
 * Design rules:
 *  - Every verdict cites the specific checks that drove it. No opaque scores.
 *  - Hard gates (identity, mandate) are separated from soft signals (track
 *    record, recency). A hard-gate failure can never be outvoted by good vibes.
 *  - Absence of evidence is never treated as evidence. A brand-new passport is
 *    INSUFFICIENT_HISTORY, not "bad" — the caller decides whether that's fatal.
 */

export const VERDICT = {
  TRUST: 'trust',
  LIMIT: 'limit',
  DECLINE: 'decline',
};

/** Default policy — what a cautious payments app would ask for. */
export const DEFAULT_POLICY = {
  requireHumanVerified: true,
  requireEnsName: false,
  minScore: 7500, // basis points
  minActions: 10,
  maxRejections: 0, // any over-mandate attempt is disqualifying
  maxStalenessDays: 30, // ignored when the agent has no history yet
  capability: null,
  value: '0',
};

const DAY = 86_400;

function bp(n) {
  return `${(n / 100).toFixed(1)}%`;
}

/**
 * @param {object} passport  from KYAClient.passport()
 * @param {object} policy    partial override of DEFAULT_POLICY
 * @param {object} [onchain] optional result of registry.canPerform — when present,
 *                           the contract's own answer is treated as authoritative
 *                           for the mandate gate.
 */
export function check(passport, policy = {}, onchain = null) {
  const p = {...DEFAULT_POLICY, ...policy};
  const checks = [];
  const now = Math.floor(Date.now() / 1000);

  const add = (id, level, pass, detail) => {
    checks.push({id, level, pass, detail});
    return pass;
  };

  if (!passport) {
    return {
      verdict: VERDICT.DECLINE,
      headline: 'No passport on record',
      summary: 'This agent has no KYA passport. There is nothing to verify and no accountable owner.',
      checks: [
        {
          id: 'passport.exists',
          level: 'hard',
          pass: false,
          detail: 'No registry entry resolves for this identifier.',
        },
      ],
      policy: p,
      hardFailures: ['passport.exists'],
      softFailures: [],
      confidence: 0,
    };
  }

  // ── hard gates: identity and mandate ───────────────────────────────

  add('passport.exists', 'hard', true, `Passport #${passport.agentId} on chain ${passport.chainId}.`);

  add(
    'passport.active',
    'hard',
    passport.active,
    passport.active ? 'Passport is active.' : 'Owner has deactivated this passport.',
  );

  if (p.requireHumanVerified) {
    const detail = passport.humanVerified
      ? passport.proofIsWorldApp
        ? `Owner ${passport.owner.slice(0, 10)}… holds a World ID ${passport.proofKindName} proof under ${passport.proofAppId}; nullifier is bound on-chain.`
        : `Owner ${passport.owner.slice(0, 10)}… holds a ${passport.proofKindName}-level attestation issued locally (no World ID app configured). The nullifier is bound on-chain but was not checked against World.`
      : passport.proofKind === 3
        ? 'Owner has only a World ID simulator proof — staging credential, not proof of a unique human.'
        : 'Owner has no World ID proof on record. Nobody is accountable for this agent.';
    add('owner.humanVerified', 'hard', passport.humanVerified, detail);
  }

  const expired = passport.authority.expiresAt !== 0 && now > passport.authority.expiresAt;
  add(
    'authority.notExpired',
    'hard',
    !expired,
    passport.authority.expiresAt === 0
      ? 'Delegated authority does not expire.'
      : expired
        ? `Authority expired ${new Date(passport.authority.expiresAt * 1000).toISOString().slice(0, 10)}.`
        : `Authority valid until ${new Date(passport.authority.expiresAt * 1000).toISOString().slice(0, 10)}.`,
  );

  if (p.capability) {
    const granted = passport.capabilities.includes(p.capability);
    add(
      'authority.capability',
      'hard',
      granted,
      granted
        ? `"${p.capability}" is in the granted capability set.`
        : `"${p.capability}" is not granted. Granted: ${passport.capabilities.join(', ') || 'none'}.`,
    );
  }

  const requested = BigInt(p.value || 0);
  if (requested > 0n) {
    const remaining = BigInt(passport.authority.spendRemainingToday);
    add(
      'authority.spend',
      'hard',
      requested <= remaining,
      requested <= remaining
        ? `${formatEther(requested)} fits inside ${formatEther(remaining)} remaining today.`
        : `${formatEther(requested)} exceeds ${formatEther(remaining)} remaining of a ${passport.authority.spendLimitPerDayEth} daily mandate.`,
    );
  }

  if (onchain) {
    add(
      'authority.onchain',
      'hard',
      onchain.ok,
      onchain.ok
        ? 'Registry canPerform() agrees the request is inside the mandate.'
        : `Registry canPerform() refused: ${REASONS[onchain.reason] || onchain.reason}.`,
    );
  }

  if (p.requireEnsName) {
    add(
      'identity.ens',
      'hard',
      Boolean(passport.ensName),
      passport.ensName ? `Resolves as ${passport.ensName}.` : 'No ENS name registered for this agent.',
    );
  }

  // ── soft signals: track record ─────────────────────────────────────

  const rep = passport.reputation;

  add(
    'history.sufficient',
    'soft',
    rep.total >= p.minActions,
    rep.total >= p.minActions
      ? `${rep.total} witnessed actions on record.`
      : `Only ${rep.total} witnessed actions — policy wants ${p.minActions}. Not a negative signal, just an unknown one.`,
  );

  add(
    'history.score',
    'soft',
    rep.score >= p.minScore,
    rep.score >= p.minScore
      ? `Reputation ${bp(rep.score)} clears the ${bp(p.minScore)} floor.`
      : `Reputation ${bp(rep.score)} is below the ${bp(p.minScore)} floor.`,
  );

  add(
    'history.noRejections',
    'soft',
    rep.rejected <= p.maxRejections,
    rep.rejected === 0
      ? 'Never attempted an action outside its mandate.'
      : `${rep.rejected} blocked over-mandate attempt(s) on record — the operator has tried to exceed its authority.`,
  );

  if (rep.total > 0) {
    const staleDays = Math.floor((now - rep.lastActionAt) / DAY);
    add(
      'history.recent',
      'soft',
      staleDays <= p.maxStalenessDays,
      staleDays <= p.maxStalenessDays
        ? `Last witnessed action ${staleDays === 0 ? 'today' : `${staleDays}d ago`}.`
        : `Dormant for ${staleDays} days.`,
    );
  }

  // ── verdict ────────────────────────────────────────────────────────

  const hardFailures = checks.filter((c) => c.level === 'hard' && !c.pass).map((c) => c.id);
  const softFailures = checks.filter((c) => c.level === 'soft' && !c.pass).map((c) => c.id);

  let verdict;
  if (hardFailures.length) verdict = VERDICT.DECLINE;
  else if (softFailures.length) verdict = VERDICT.LIMIT;
  else verdict = VERDICT.TRUST;

  // A blocked over-mandate attempt is an intent signal, not a hiccup: it alone
  // drops an otherwise clean agent to DECLINE.
  if (verdict === VERDICT.LIMIT && softFailures.includes('history.noRejections')) {
    verdict = VERDICT.DECLINE;
  }

  const headline =
    verdict === VERDICT.TRUST
      ? 'Safe to delegate'
      : verdict === VERDICT.LIMIT
        ? 'Delegate with limits'
        : 'Do not delegate';

  return {
    verdict,
    headline,
    summary: summarize(verdict, passport, hardFailures, softFailures, p),
    checks,
    hardFailures,
    softFailures,
    policy: p,
    confidence: confidenceOf(rep),
  };
}

/**
 * How much the track record can be leaned on, independent of how good it is.
 * Saturating curve: 0 actions -> 0, 10 -> ~0.5, 40 -> ~0.8, 200 -> ~0.95.
 */
function confidenceOf(rep) {
  if (!rep.total) return 0;
  return Math.round((rep.total / (rep.total + 10)) * 100) / 100;
}

/** Human copy for every check id, so a verdict can never render "undefined". */
const REASON_COPY = {
  'passport.exists': 'no passport exists',
  'passport.active': 'the passport is deactivated',
  'owner.humanVerified': 'no human is accountable for it',
  'authority.notExpired': 'its delegated authority has expired',
  'authority.capability': 'the requested capability is outside its mandate',
  'authority.spend': 'the request exceeds its daily spend mandate',
  'authority.onchain': 'the registry itself refuses the request',
  'identity.ens': 'it has no discoverable name',
  'history.noRejections': 'it has previously tried to exceed its mandate',
  'history.sufficient': 'it has too little witnessed history to rely on',
  'history.score': 'its reputation is below the policy floor',
  'history.recent': 'it has been dormant too long',
};

function summarize(verdict, passport, hardFailures, softFailures, policy) {
  const name = passport.ensName || passport.domain || `#${passport.agentId}`;
  if (verdict === VERDICT.TRUST) {
    const backing = passport.proofIsWorldApp
      ? 'a World ID-verified owner'
      : 'an owner whose personhood attestation was issued locally';
    return `${name} is backed by ${backing}, is acting inside its declared mandate, and has ${passport.reputation.total} witnessed actions at ${bp(passport.reputation.score)} reputation.`;
  }
  if (verdict === VERDICT.DECLINE) {
    // Hard gates first. Among soft failures a blocked over-mandate attempt is the
    // *reason* for the decline — a low score alone would only warrant LIMIT — so
    // it outranks the others regardless of check order.
    const driver =
      hardFailures[0] ||
      (softFailures.includes('history.noRejections') ? 'history.noRejections' : softFailures[0]);
    const reason = REASON_COPY[driver] || 'it failed a required trust check';
    const detail =
      driver === 'history.noRejections'
        ? ` ${passport.reputation.rejected} blocked attempt(s) are on its permanent record.`
        : '';
    return `Refuse ${name}: ${reason}.${detail}`;
  }
  const gaps = softFailures
    .map(
      (id) =>
        ({
          'history.sufficient': `only ${passport.reputation.total} actions on record`,
          'history.score': `reputation ${bp(passport.reputation.score)} below the ${bp(policy.minScore)} floor`,
          'history.recent': 'no recent activity',
        })[id],
    )
    .filter(Boolean);
  const gapText = gaps.length ? gaps.join(' and ') : 'its track record is still thin';
  return `${name} clears every identity and mandate gate, but ${gapText}. Delegate low-value work and let it build a record.`;
}

/**
 * Rank candidate agents for a task. Hard-gate failures sort last regardless of
 * score, because "cheap and untrustworthy" is not a trade-off worth surfacing.
 */
export function rank(passports, policy = {}) {
  return passports
    .map((passport) => ({passport, decision: check(passport, policy)}))
    .sort((a, b) => {
      const order = {[VERDICT.TRUST]: 0, [VERDICT.LIMIT]: 1, [VERDICT.DECLINE]: 2};
      if (order[a.decision.verdict] !== order[b.decision.verdict]) {
        return order[a.decision.verdict] - order[b.decision.verdict];
      }
      if (b.passport.reputation.score !== a.passport.reputation.score) {
        return b.passport.reputation.score - a.passport.reputation.score;
      }
      return b.decision.confidence - a.decision.confidence;
    });
}
