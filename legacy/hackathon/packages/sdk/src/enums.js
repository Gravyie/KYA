/** Canonical enums, mirrored from contracts/src/interfaces/IKYA.sol. */

export const Outcome = {
  Pending: 0,
  Success: 1,
  Failure: 2,
  Rejected: 3,
};

export const OutcomeName = ['pending', 'success', 'failure', 'rejected'];

export const ProofKind = {
  None: 0,
  WorldIdOrb: 1,
  WorldIdDevice: 2,
  WorldIdSimulator: 3,
};

export const ProofKindName = ['none', 'orb', 'device', 'simulator'];

/**
 * Which proof kinds count as production humanhood.
 * Simulator proofs are deliberately excluded everywhere — the whole product is
 * about not overstating trust, so a staging proof must never render as verified.
 */
export const PRODUCTION_PROOFS = new Set([ProofKind.WorldIdOrb, ProofKind.WorldIdDevice]);

export const SCORE_PRECISION = 10_000;

/** Reason codes returned by PassportRegistry.canPerform, with human copy. */
export const REASONS = {
  OK: 'Within mandate',
  UNKNOWN_AGENT: 'No passport exists for this agent',
  AGENT_INACTIVE: 'Passport has been deactivated by its owner',
  OWNER_NOT_HUMAN_VERIFIED: 'Owner has no production World ID proof on record',
  AUTHORITY_EXPIRED: 'Delegated authority has expired',
  CAPABILITY_NOT_GRANTED: 'Capability is not in the granted set',
  DAILY_ACTIONS_EXCEEDED: 'Daily action cap already reached',
  DAILY_SPEND_EXCEEDED: 'Request exceeds remaining daily spend',
};
