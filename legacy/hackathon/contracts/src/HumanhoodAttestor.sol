// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProofKind} from "./interfaces/IKYA.sol";

/**
 * @title HumanhoodAttestor
 * @notice Bridges an off-chain World ID proof into on-chain state.
 *
 * Why an attestor instead of verifying the World ID zk proof directly?
 * The World ID Router (`IWorldID.verifyProof`) is only deployed on World Chain,
 * Optimism and Ethereum. KYA's registry lives on 0G Galileo so that agent
 * execution receipts and their identity share one chain. Since no canonical
 * router exists there, the proof is verified against World's
 * `/api/v2/verify/{app_id}` endpoint by a stateless verifier service, which then
 * signs an EIP-712 `Humanhood` struct. The registry accepts that signature.
 *
 * Two properties make this honest rather than a shortcut:
 *  1. The nullifier hash is stored on-chain, so double-registration of the same
 *     human is prevented by the same mechanism World ID itself uses.
 *  2. `ProofKind` records the verification level, including
 *     `WorldIdSimulator`, so a staging proof can never masquerade as an orb
 *     proof. The UI renders that distinction explicitly.
 */
contract HumanhoodAttestor {
    error NotAdmin();
    error BadSignature();
    error AttestationExpired();
    error NullifierBoundToOther();
    error UnknownProofKind();

    event AttestorRotated(address indexed previous, address indexed current);
    event HumanhoodRecorded(
        address indexed subject, bytes32 indexed nullifierHash, ProofKind kind, uint64 recordedAt
    );

    struct Humanhood {
        ProofKind kind;
        bytes32 nullifierHash;
        uint64 verifiedAt;
        string appId;
        string action;
    }

    /// @notice The EIP-712 payload the off-chain verifier signs.
    struct Attestation {
        address subject;
        ProofKind kind;
        bytes32 nullifierHash;
        uint64 verifiedAt;
        uint64 deadline;
        string appId;
        string action;
    }

    bytes32 private constant HUMANHOOD_TYPEHASH = keccak256(
        "Humanhood(address subject,uint8 kind,bytes32 nullifierHash,uint64 verifiedAt,uint64 deadline,string appId,string action)"
    );

    bytes32 private immutable _domainSeparator;

    address public admin;
    /// @notice Off-chain service key permitted to sign attestations.
    address public attestor;

    mapping(address => Humanhood) private _humanhood;
    /// @notice nullifier -> the first subject that claimed it. Sybil guard.
    mapping(bytes32 => address) public nullifierOwner;

    constructor(address attestor_) {
        admin = msg.sender;
        attestor = attestor_;
        _domainSeparator = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("KYA.Humanhood"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparator;
    }

    function rotateAttestor(address next) external {
        if (msg.sender != admin) revert NotAdmin();
        emit AttestorRotated(attestor, next);
        attestor = next;
    }

    /**
     * @notice Record a humanhood claim for `subject` using an attestor signature.
     * @dev Callable by anyone holding the signature — the signature is the authority,
     *      which lets the owner submit it themselves and pay their own gas.
     */
    function recordHumanhood(Attestation calldata att, bytes calldata signature) external {
        if (att.kind == ProofKind.None) revert UnknownProofKind();
        if (block.timestamp > att.deadline) revert AttestationExpired();
        if (_recover(hashAttestation(att), signature) != attestor) revert BadSignature();

        address bound = nullifierOwner[att.nullifierHash];
        if (bound != address(0) && bound != att.subject) revert NullifierBoundToOther();
        if (bound == address(0)) nullifierOwner[att.nullifierHash] = att.subject;

        Humanhood storage h = _humanhood[att.subject];
        h.kind = att.kind;
        h.nullifierHash = att.nullifierHash;
        h.verifiedAt = att.verifiedAt;
        h.appId = att.appId;
        h.action = att.action;

        emit HumanhoodRecorded(att.subject, att.nullifierHash, att.kind, uint64(block.timestamp));
    }

    /// @notice EIP-712 digest an attestor signs. Exposed so the service and tests agree.
    function hashAttestation(Attestation calldata att) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                HUMANHOOD_TYPEHASH,
                att.subject,
                uint8(att.kind),
                att.nullifierHash,
                att.verifiedAt,
                att.deadline,
                keccak256(bytes(att.appId)),
                keccak256(bytes(att.action))
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator, structHash));
    }

    function humanhoodOf(address subject) external view returns (Humanhood memory) {
        return _humanhood[subject];
    }

    function proofKindOf(address subject) external view returns (ProofKind) {
        return _humanhood[subject].kind;
    }

    /// @notice True only for production verification levels. Simulator proofs return false.
    function isHumanVerified(address subject) external view returns (bool) {
        ProofKind k = _humanhood[subject].kind;
        return k == ProofKind.WorldIdOrb || k == ProofKind.WorldIdDevice;
    }

    function nullifierFor(address subject) external view returns (bytes32) {
        return _humanhood[subject].nullifierHash;
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
