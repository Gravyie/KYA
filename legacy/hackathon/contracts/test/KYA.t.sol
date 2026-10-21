// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {HumanhoodAttestor} from "../src/HumanhoodAttestor.sol";
import {PassportRegistry} from "../src/PassportRegistry.sol";
import {AgentNameRegistrar} from "../src/AgentNameRegistrar.sol";
import {Agent, Authority, Reputation, Action, Outcome, ProofKind} from "../src/interfaces/IKYA.sol";

contract KYATest is Test {
    HumanhoodAttestor attestor;
    PassportRegistry registry;
    AgentNameRegistrar names;

    uint256 attestorKey = 0xA11CE;
    address attestorAddr;

    address deployer = address(this);
    address ownerA = address(0xA0);
    address ownerB = address(0xB0);
    address opA = address(0xA1);
    address opB = address(0xB1);
    address executor = address(0xE0);
    address stranger = address(0xDEAD);

    bytes32 nullA = keccak256("nullifier-A");
    bytes32 nullB = keccak256("nullifier-B");

    function setUp() public {
        attestorAddr = vm.addr(attestorKey);
        attestor = new HumanhoodAttestor(attestorAddr);
        registry = new PassportRegistry(attestor);
        names = new AgentNameRegistrar("kya.eth", registry);
        registry.setExecutor(executor, true);
        vm.warp(1_800_000_000);
    }

    // ───────────────────────────────── helpers

    function _attest(address subject, ProofKind kind, bytes32 nullifier) internal {
        HumanhoodAttestor.Attestation memory att = HumanhoodAttestor.Attestation({
            subject: subject,
            kind: kind,
            nullifierHash: nullifier,
            verifiedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 900),
            appId: "app_staging_kya",
            action: "register-agent"
        });
        bytes32 digest = attestor.hashAttestation(att);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, digest);
        attestor.recordHumanhood(att, abi.encodePacked(r, s, v));
    }

    function _caps(string memory a, string memory b) internal pure returns (string[] memory out) {
        out = new string[](2);
        out[0] = a;
        out[1] = b;
    }

    function _one(string memory a) internal pure returns (string[] memory out) {
        out = new string[](1);
        out[0] = a;
    }

    function _registerA() internal returns (uint256) {
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.prank(ownerA);
        return registry.registerAgent(
            opA, "optimizer.kya.eth", "0g://agentcard/optimizer", _caps("flight.quote", "pay"), 5 ether, 50, 0
        );
    }

    // ───────────────────────────────── World ID / humanhood

    function test_HumanhoodAttestation_RecordsProofAndNullifier() public {
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        assertTrue(attestor.isHumanVerified(ownerA));
        assertEq(uint8(attestor.proofKindOf(ownerA)), uint8(ProofKind.WorldIdOrb));
        assertEq(attestor.nullifierFor(ownerA), nullA);
        assertEq(attestor.nullifierOwner(nullA), ownerA);
    }

    function test_SimulatorProof_IsNotTreatedAsHumanVerified() public {
        // Core honesty property: a staging proof must never pass as production.
        _attest(ownerA, ProofKind.WorldIdSimulator, nullA);
        assertEq(uint8(attestor.proofKindOf(ownerA)), uint8(ProofKind.WorldIdSimulator));
        assertFalse(attestor.isHumanVerified(ownerA));
    }

    function test_ForgedAttestation_Reverts() public {
        HumanhoodAttestor.Attestation memory att = HumanhoodAttestor.Attestation({
            subject: ownerA,
            kind: ProofKind.WorldIdOrb,
            nullifierHash: nullA,
            verifiedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 900),
            appId: "app_staging_kya",
            action: "register-agent"
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, attestor.hashAttestation(att));
        vm.expectRevert(HumanhoodAttestor.BadSignature.selector);
        attestor.recordHumanhood(att, abi.encodePacked(r, s, v));
    }

    function test_ExpiredAttestation_Reverts() public {
        HumanhoodAttestor.Attestation memory att = HumanhoodAttestor.Attestation({
            subject: ownerA,
            kind: ProofKind.WorldIdOrb,
            nullifierHash: nullA,
            verifiedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 10),
            appId: "app_staging_kya",
            action: "register-agent"
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, attestor.hashAttestation(att));
        vm.warp(block.timestamp + 11);
        vm.expectRevert(HumanhoodAttestor.AttestationExpired.selector);
        attestor.recordHumanhood(att, abi.encodePacked(r, s, v));
    }

    function test_NullifierCannotBeReusedByAnotherWallet() public {
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        HumanhoodAttestor.Attestation memory att = HumanhoodAttestor.Attestation({
            subject: ownerB,
            kind: ProofKind.WorldIdOrb,
            nullifierHash: nullA, // same human, different wallet
            verifiedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 900),
            appId: "app_staging_kya",
            action: "register-agent"
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, attestor.hashAttestation(att));
        vm.expectRevert(HumanhoodAttestor.NullifierBoundToOther.selector);
        attestor.recordHumanhood(att, abi.encodePacked(r, s, v));
    }

    function test_OneHuman_ManyAgents_AllTraceable() public {
        // FR3
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.startPrank(ownerA);
        uint256 id1 = registry.registerAgent(opA, "one.kya.eth", "u1", _one("flight.quote"), 1 ether, 10, 0);
        uint256 id2 = registry.registerAgent(opB, "two.kya.eth", "u2", _one("research"), 1 ether, 10, 0);
        vm.stopPrank();
        uint256[] memory mine = registry.agentsOf(ownerA);
        assertEq(mine.length, 2);
        assertEq(mine[0], id1);
        assertEq(mine[1], id2);
        assertEq(attestor.nullifierFor(registry.getAgent(id1).owner), nullA);
        assertEq(attestor.nullifierFor(registry.getAgent(id2).owner), nullA);
    }

    // ───────────────────────────────── registration gating

    function test_RegisterAgent_RequiresHumanVerifiedOwner() public {
        vm.prank(ownerA);
        vm.expectRevert(PassportRegistry.OwnerNotHumanVerified.selector);
        registry.registerAgent(opA, "x.kya.eth", "u", _one("flight.quote"), 1 ether, 10, 0);
    }

    function test_RegisterAgent_RejectsSimulatorOnlyOwner() public {
        _attest(ownerA, ProofKind.WorldIdSimulator, nullA);
        vm.prank(ownerA);
        vm.expectRevert(PassportRegistry.OwnerNotHumanVerified.selector);
        registry.registerAgent(opA, "x.kya.eth", "u", _one("flight.quote"), 1 ether, 10, 0);
    }

    function test_DuplicateDomainAndOperator_Revert() public {
        _registerA();
        _attest(ownerB, ProofKind.WorldIdOrb, nullB);
        vm.prank(ownerB);
        vm.expectRevert(PassportRegistry.DomainTaken.selector);
        registry.registerAgent(opB, "optimizer.kya.eth", "u", _one("flight.quote"), 1 ether, 10, 0);
        vm.prank(ownerB);
        vm.expectRevert(PassportRegistry.OperatorTaken.selector);
        registry.registerAgent(opA, "other.kya.eth", "u", _one("flight.quote"), 1 ether, 10, 0);
    }

    function test_PassportOf_ReturnsFullView() public {
        uint256 id = _registerA();
        (
            Agent memory agent,
            Authority memory auth,
            Reputation memory rep,
            string[] memory caps,
            uint32 score,
            ProofKind kind,
            bytes32 nullifier,
            uint256 remaining
        ) = registry.passportOf(id);

        assertEq(agent.owner, ownerA);
        assertEq(agent.operator, opA);
        assertEq(agent.domain, "optimizer.kya.eth");
        assertEq(auth.spendLimitPerDay, 5 ether);
        assertEq(auth.maxActionsPerDay, 50);
        assertEq(rep.total, 0);
        assertEq(caps.length, 2);
        assertEq(score, 0);
        assertEq(uint8(kind), uint8(ProofKind.WorldIdOrb));
        assertEq(nullifier, nullA);
        assertEq(remaining, 5 ether);
        assertTrue(rep.logHead != bytes32(0), "log genesis must be seeded");
    }

    // ───────────────────────────────── authority enforcement

    function test_CanPerform_HappyPath() public {
        uint256 id = _registerA();
        (bool ok, string memory reason) = registry.canPerform(id, "flight.quote", 1 ether);
        assertTrue(ok);
        assertEq(reason, "OK");
    }

    function test_CanPerform_UnknownAgent() public view {
        (bool ok, string memory reason) = registry.canPerform(999, "flight.quote", 0);
        assertFalse(ok);
        assertEq(reason, "UNKNOWN_AGENT");
    }

    function test_CanPerform_CapabilityNotGranted() public {
        uint256 id = _registerA();
        (bool ok, string memory reason) = registry.canPerform(id, "trade.perp", 0);
        assertFalse(ok);
        assertEq(reason, "CAPABILITY_NOT_GRANTED");
    }

    function test_CanPerform_SpendLimit() public {
        uint256 id = _registerA();
        (bool ok, string memory reason) = registry.canPerform(id, "flight.quote", 6 ether);
        assertFalse(ok);
        assertEq(reason, "DAILY_SPEND_EXCEEDED");
    }

    function test_CanPerform_Expired() public {
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.prank(ownerA);
        uint256 id = registry.registerAgent(
            opA, "temp.kya.eth", "u", _one("flight.quote"), 5 ether, 10, uint64(block.timestamp + 100)
        );
        vm.warp(block.timestamp + 101);
        (bool ok, string memory reason) = registry.canPerform(id, "flight.quote", 1);
        assertFalse(ok);
        assertEq(reason, "AUTHORITY_EXPIRED");
    }

    function test_CanPerform_Inactive() public {
        uint256 id = _registerA();
        vm.prank(ownerA);
        registry.setActive(id, false);
        (bool ok, string memory reason) = registry.canPerform(id, "flight.quote", 1);
        assertFalse(ok);
        assertEq(reason, "AGENT_INACTIVE");
    }

    function test_SettleAction_EnforcesSpendLimitOnchain() public {
        uint256 id = _registerA();
        vm.prank(executor);
        registry.settleAction(id, "flight.quote", 4 ether, Outcome.Success, keccak256("ev1"));

        // 1 ether of headroom left today; a 2 ether request must revert.
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(PassportRegistry.DailySpendExceeded.selector, 2 ether, 1 ether)
        );
        registry.settleAction(id, "flight.quote", 2 ether, Outcome.Success, keccak256("ev2"));
    }

    function test_SpendWindow_ResetsNextDay() public {
        uint256 id = _registerA();
        vm.prank(executor);
        registry.settleAction(id, "flight.quote", 5 ether, Outcome.Success, keccak256("ev"));
        assertEq(registry.remainingSpendToday(id), 0);
        vm.warp(block.timestamp + 86_400);
        assertEq(registry.remainingSpendToday(id), 5 ether);
    }

    function test_MaxActionsPerDay_Enforced() public {
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.prank(ownerA);
        uint256 id = registry.registerAgent(opA, "cap.kya.eth", "u", _one("research"), 100 ether, 2, 0);
        vm.startPrank(executor);
        registry.settleAction(id, "research", 0, Outcome.Success, keccak256("a"));
        registry.settleAction(id, "research", 0, Outcome.Success, keccak256("b"));
        vm.expectRevert(abi.encodeWithSelector(PassportRegistry.DailyActionsExceeded.selector, 2, 2));
        registry.settleAction(id, "research", 0, Outcome.Success, keccak256("c"));
        vm.stopPrank();
    }

    function test_OnlyExecutorCanSettle() public {
        uint256 id = _registerA();
        vm.prank(stranger);
        vm.expectRevert(PassportRegistry.NotExecutor.selector);
        registry.settleAction(id, "flight.quote", 0, Outcome.Success, keccak256("ev"));
    }

    function test_AgentCannotSelfReport() public {
        // The operator key itself has no settle privilege — reputation is witnessed.
        uint256 id = _registerA();
        vm.prank(opA);
        vm.expectRevert(PassportRegistry.NotExecutor.selector);
        registry.settleAction(id, "flight.quote", 0, Outcome.Success, keccak256("ev"));
    }

    function test_RejectedAttempt_IsPermanentlyRecorded() public {
        uint256 id = _registerA();
        vm.prank(executor);
        registry.rejectAction(id, "trade.perp", 9 ether, keccak256("blocked"));
        Reputation memory rep = registry.getReputation(id);
        assertEq(rep.total, 1);
        assertEq(rep.rejected, 1);
        Action[] memory log = registry.recentActions(id, 1);
        assertEq(uint8(log[0].outcome), uint8(Outcome.Rejected));
        assertEq(log[0].kind, "trade.perp");
    }

    function test_SetAuthority_ReplacesCapabilitySet() public {
        uint256 id = _registerA();
        vm.prank(ownerA);
        registry.setAuthority(id, _one("research"), 2 ether, 5, 0);
        assertFalse(registry.hasCapability(id, "flight.quote"));
        assertTrue(registry.hasCapability(id, "research"));
        assertEq(registry.getCapabilities(id).length, 1);
        assertEq(registry.getAuthority(id).spendLimitPerDay, 2 ether);
    }

    function test_OnlyOwnerCanSetAuthority() public {
        uint256 id = _registerA();
        vm.prank(stranger);
        vm.expectRevert(PassportRegistry.NotOwner.selector);
        registry.setAuthority(id, _one("research"), 1, 1, 0);
    }

    // ───────────────────────────────── reputation

    function test_Reputation_ConfidenceWeighted_NewAgentDoesNotOutrankVeteran() public {
        // rookie: 1/1 perfect. veteran: 94/100.
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.startPrank(ownerA);
        uint256 rookie = registry.registerAgent(opA, "rookie.kya.eth", "u", _one("research"), 0, 0, 0);
        uint256 vet = registry.registerAgent(opB, "vet.kya.eth", "u", _one("research"), 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(executor);
        registry.settleAction(rookie, "research", 0, Outcome.Success, keccak256("r1"));
        for (uint256 i = 0; i < 94; i++) {
            registry.settleAction(vet, "research", 0, Outcome.Success, bytes32(i));
        }
        for (uint256 i = 0; i < 6; i++) {
            registry.settleAction(vet, "research", 0, Outcome.Failure, bytes32(i + 1000));
        }
        vm.stopPrank();

        uint32 rookieScore = registry.scoreOf(rookie);
        uint32 vetScore = registry.scoreOf(vet);
        assertGt(vetScore, rookieScore, "veteran with 94% must outrank a 1-for-1 rookie");
        assertLt(rookieScore, 6000, "single success must not produce a near-perfect score");
        assertGt(vetScore, 8000);
    }

    function test_Reputation_RejectionHurtsMoreThanFailure() public {
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.startPrank(ownerA);
        uint256 f = registry.registerAgent(opA, "failer.kya.eth", "u", _one("research"), 0, 0, 0);
        uint256 r = registry.registerAgent(opB, "rejecter.kya.eth", "u", _one("research"), 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(executor);
        for (uint256 i = 0; i < 9; i++) {
            registry.settleAction(f, "research", 0, Outcome.Success, bytes32(i));
            registry.settleAction(r, "research", 0, Outcome.Success, bytes32(i));
        }
        registry.settleAction(f, "research", 0, Outcome.Failure, keccak256("f"));
        registry.rejectAction(r, "trade.perp", 1, keccak256("r"));
        vm.stopPrank();

        assertGt(registry.scoreOf(f), registry.scoreOf(r), "over-mandate attempt is a worse signal than a failure");
    }

    function test_Reputation_ZeroHistoryIsZero() public {
        uint256 id = _registerA();
        assertEq(registry.scoreOf(id), 0);
    }

    function test_LogHead_IsAppendOnlyHashChain() public {
        uint256 id = _registerA();
        bytes32 h0 = registry.getReputation(id).logHead;
        vm.prank(executor);
        registry.settleAction(id, "flight.quote", 1, Outcome.Success, keccak256("e1"));
        bytes32 h1 = registry.getReputation(id).logHead;
        vm.prank(executor);
        registry.settleAction(id, "flight.quote", 1, Outcome.Success, keccak256("e2"));
        bytes32 h2 = registry.getReputation(id).logHead;

        assertTrue(h0 != h1 && h1 != h2 && h0 != h2);
        // Recompute h1 from h0 the way an off-chain 0G mirror would.
        bytes32 expected =
            keccak256(abi.encode(h0, id, uint256(0), uint8(Outcome.Success), uint256(1), keccak256("e1"), keccak256(bytes("flight.quote"))));
        assertEq(h1, expected, "log head must be independently recomputable");
    }

    function test_RecentActions_IsNewestFirst() public {
        uint256 id = _registerA();
        vm.startPrank(executor);
        registry.settleAction(id, "flight.quote", 1, Outcome.Success, keccak256("first"));
        registry.settleAction(id, "flight.quote", 1, Outcome.Failure, keccak256("second"));
        vm.stopPrank();
        Action[] memory log = registry.recentActions(id, 10);
        assertEq(log.length, 2);
        assertEq(log[0].evidence, keccak256("second"));
        assertEq(log[1].evidence, keccak256("first"));
    }

    // ───────────────────────────────── ENS layer

    function test_Namehash_MatchesEIP137() public view {
        // Known-good vectors from the EIP-137 spec.
        assertEq(names.namehash(""), bytes32(0));
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));
        assertEq(names.namehash("eth"), ethNode);
        assertEq(
            names.namehash("foo.eth"), keccak256(abi.encodePacked(ethNode, keccak256("foo")))
        );
        assertEq(
            names.namehash("eth"),
            0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
        );
        assertEq(
            names.namehash("foo.eth"),
            0xde9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f
        );
    }

    function test_RegisterSubname_AndForwardReverseResolution() public {
        uint256 id = _registerA();
        vm.prank(ownerA);
        bytes32 node = names.registerSubname("optimizer", id, opA);

        assertEq(node, names.namehash("optimizer.kya.eth"));
        assertEq(names.addr(node), opA);
        assertEq(names.name(node), "optimizer.kya.eth");
        assertEq(names.nameOfAddress(opA), "optimizer.kya.eth"); // FR6 reverse
        assertEq(names.agentIdOfName("optimizer.kya.eth"), id);
    }

    function test_SubnameOnlyByPassportOwner() public {
        uint256 id = _registerA();
        vm.prank(stranger);
        vm.expectRevert(AgentNameRegistrar.NotNameOwner.selector);
        names.registerSubname("optimizer", id, stranger);
    }

    function test_SubnameCannotBeTakenTwice() public {
        uint256 id = _registerA();
        vm.startPrank(ownerA);
        names.registerSubname("optimizer", id, opA);
        vm.expectRevert(AgentNameRegistrar.NameTaken.selector);
        names.registerSubname("optimizer", id, opA);
        vm.stopPrank();
    }

    function test_InvalidLabelsRejected() public {
        uint256 id = _registerA();
        vm.startPrank(ownerA);
        vm.expectRevert(AgentNameRegistrar.InvalidLabel.selector);
        names.registerSubname("ab", id, opA); // too short
        vm.expectRevert(AgentNameRegistrar.InvalidLabel.selector);
        names.registerSubname("Optimizer", id, opA); // uppercase
        vm.expectRevert(AgentNameRegistrar.InvalidLabel.selector);
        names.registerSubname("-lead", id, opA);
        vm.stopPrank();
    }

    function test_TextRecords_DerivedFieldsTrackRegistryLive() public {
        uint256 id = _registerA();
        vm.startPrank(ownerA);
        bytes32 node = names.registerSubname("optimizer", id, opA);
        names.setText(node, "description", "Flight cost optimizer");
        vm.stopPrank();

        assertEq(names.text(node, "agent.capabilities"), "flight.quote,pay");
        assertEq(names.text(node, "agent.humanVerified"), "true");
        assertEq(names.text(node, "description"), "Flight cost optimizer");
        assertEq(names.text(node, "agent.reputation"), "0");

        vm.prank(executor);
        registry.settleAction(id, "flight.quote", 1, Outcome.Success, keccak256("ev"));
        assertTrue(
            keccak256(bytes(names.text(node, "agent.reputation"))) != keccak256("0"),
            "derived text record must follow the registry"
        );

        // Changing authority changes the advertised capability list with no name write.
        vm.prank(ownerA);
        registry.setAuthority(id, _one("research"), 1 ether, 10, 0);
        assertEq(names.text(node, "agent.capabilities"), "research");
    }

    function test_ResolverInterfaceIds() public view {
        assertTrue(names.supportsInterface(0x01ffc9a7)); // ERC-165
        assertTrue(names.supportsInterface(0x3b3b57de)); // addr(bytes32)
        assertTrue(names.supportsInterface(0xf1cb7e06)); // addr(bytes32,uint256)
        assertTrue(names.supportsInterface(0x59d1d43c)); // text(bytes32,string)
        assertTrue(names.supportsInterface(0x691f3431)); // name(bytes32)
        assertFalse(names.supportsInterface(0xdeadbeef));
    }

    function test_UnknownNameResolvesEmpty() public view {
        bytes32 node = names.namehash("nobody.kya.eth");
        assertEq(names.addr(node), address(0));
        assertEq(names.text(node, "agent.capabilities"), "");
        assertEq(names.nameOfAddress(stranger), "");
    }

    // ───────────────────────────────── the demo scene, end to end

    function test_DemoScene_TrustedAgentBeatsAnonymousOne() public {
        // Trusted: human-backed owner, ENS name, real history.
        uint256 trusted = _registerA();
        vm.prank(ownerA);
        names.registerSubname("optimizer", trusted, opA);
        vm.startPrank(executor);
        for (uint256 i = 0; i < 40; i++) {
            registry.settleAction(trusted, "flight.quote", 0.1 ether, Outcome.Success, bytes32(i));
        }
        registry.settleAction(trusted, "flight.quote", 0.1 ether, Outcome.Failure, keccak256("f"));
        vm.stopPrank();

        // Anonymous: no World ID at all, so it cannot even hold a passport.
        vm.prank(ownerB);
        vm.expectRevert(PassportRegistry.OwnerNotHumanVerified.selector);
        registry.registerAgent(opB, "anon.kya.eth", "u", _one("flight.quote"), 100 ether, 0, 0);

        // A relying app routes the task by asking the registry, not by trusting a claim.
        (bool okTrusted,) = registry.canPerform(trusted, "flight.quote", 0.1 ether);
        (bool okAnon, string memory anonReason) = registry.canPerform(0, "flight.quote", 0.1 ether);
        assertTrue(okTrusted);
        assertFalse(okAnon);
        assertEq(anonReason, "UNKNOWN_AGENT");

        assertGt(registry.scoreOf(trusted), 8000);
        assertEq(names.nameOfAddress(opA), "optimizer.kya.eth");
    }

    function test_LiveReputationUpdate_MovesScoreUpward() public {
        uint256 id = _registerA();
        vm.startPrank(executor);
        for (uint256 i = 0; i < 10; i++) {
            registry.settleAction(id, "flight.quote", 0.01 ether, Outcome.Success, bytes32(i));
        }
        uint32 before = registry.scoreOf(id);
        registry.settleAction(id, "flight.quote", 0.01 ether, Outcome.Success, keccak256("next"));
        uint32 after_ = registry.scoreOf(id);
        vm.stopPrank();
        assertGt(after_, before, "each witnessed success must visibly move the score");
    }

    // ───────────────────────────────── fuzz

    function testFuzz_ScoreAlwaysWithinBounds(uint8 s, uint8 f, uint8 r) public {
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.prank(ownerA);
        uint256 id = registry.registerAgent(opA, "fuzz.kya.eth", "u", _one("research"), type(uint128).max, 0, 0);
        vm.startPrank(executor);
        for (uint256 i = 0; i < s; i++) {
            registry.settleAction(id, "research", 0, Outcome.Success, bytes32(i));
        }
        for (uint256 i = 0; i < f; i++) {
            registry.settleAction(id, "research", 0, Outcome.Failure, bytes32(i));
        }
        for (uint256 i = 0; i < r; i++) {
            registry.rejectAction(id, "research", 0, bytes32(i));
        }
        vm.stopPrank();
        uint32 score = registry.scoreOf(id);
        assertLe(score, 10_000);
        if (uint256(s) + f + r == 0) assertEq(score, 0);
    }

    function testFuzz_SpendLimitNeverExceededInADay(uint96 limit, uint96 a, uint96 b) public {
        limit = uint96(bound(limit, 1, type(uint96).max / 2));
        _attest(ownerA, ProofKind.WorldIdOrb, nullA);
        vm.prank(ownerA);
        uint256 id = registry.registerAgent(opA, "spend.kya.eth", "u", _one("pay"), limit, 0, 0);

        vm.startPrank(executor);
        if (a <= limit) {
            registry.settleAction(id, "pay", a, Outcome.Success, keccak256("a"));
        }
        uint64 d = registry.dayIndex(uint64(block.timestamp));
        try registry.settleAction(id, "pay", b, Outcome.Success, keccak256("b")) {} catch {}
        vm.stopPrank();
        assertLe(registry.spentOnDay(id, d), limit, "daily spend must never exceed the mandate");
    }
}
