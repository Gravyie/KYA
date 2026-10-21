// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Canonical outcome of a completed agent action.
enum Outcome {
    Pending,
    Success,
    Failure,
    Rejected // blocked by authority policy before execution
}

/// @notice How a humanhood claim reached the chain.
enum ProofKind {
    None, // no claim on record
    WorldIdOrb, // World ID, orb verification level
    WorldIdDevice, // World ID, device verification level
    WorldIdSimulator // World ID staging/simulator — must be surfaced as non-production
}

/// @dev Identity half of a passport. Set once at mint, `authority` is mutable by owner.
struct Agent {
    address operator; // the key the agent signs/acts with
    address owner; // the accountable human/entity
    string domain; // ERC-8004 style agent domain (ENS name for KYA)
    string metadataURI; // 0G storage / IPFS pointer to the agent card
    uint64 registeredAt;
    bool active;
}

/// @dev Authority half of a passport: what the agent is permitted to do.
struct Authority {
    uint256 spendLimitPerDay; // in wei-denominated units of the demo asset
    uint64 expiresAt; // 0 = never expires
    bytes32 capabilityRoot; // keccak of the sorted capability set, for cheap integrity checks
    uint32 maxActionsPerDay;
}

/// @dev Reputation half: derived entirely from registry-witnessed actions.
struct Reputation {
    uint32 total;
    uint32 success;
    uint32 failure;
    uint32 rejected;
    uint64 firstActionAt;
    uint64 lastActionAt;
    uint256 volumeHandled;
    bytes32 logHead; // hash-chain head over the whole action log
}

/// @dev A single witnessed action.
struct Action {
    uint256 agentId;
    Outcome outcome;
    uint64 timestamp;
    uint256 value; // economic value moved by this action
    bytes32 evidence; // 0G storage root / TEE attestation digest
    string kind; // e.g. "flight.quote"
    address witness; // executor that submitted the receipt
}
