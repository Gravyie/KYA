import {
  createPublicClient,
  http,
  formatEther,
  getAddress,
  keccak256,
  toHex,
  encodePacked,
  encodeAbiParameters,
} from 'viem';
import {PassportRegistryABI, HumanhoodAttestorABI, AgentNameRegistrarABI} from './abi.js';
import {chainById} from './chains.js';
import {Outcome, OutcomeName, ProofKind, ProofKindName, PRODUCTION_PROOFS, SCORE_PRECISION} from './enums.js';

/**
 * Read side of KYA. One client, three contracts, and a `check()` that returns a
 * *verdict* rather than a data dump — the verdict is the product.
 */
export class KYAClient {
  constructor({chainId, rpcUrl, contracts}) {
    this.chainId = Number(chainId);
    this.chain = chainById(chainId);
    this.contracts = {
      registry: getAddress(contracts.PassportRegistry),
      attestor: getAddress(contracts.HumanhoodAttestor),
      names: getAddress(contracts.AgentNameRegistrar),
    };
    /**
     * Batched reads go through the Multicall3 that KYA deploys alongside the
     * registry. Neither a bare anvil node nor 0G Galileo guarantees the
     * canonical 0xcA11…CA11 deployment, and the passport view must not be able
     * to half-load, so the address travels in the address book.
     */
    this.multicallAddress = contracts.Multicall3 ? getAddress(contracts.Multicall3) : undefined;
    this.client = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl || this.chain.rpcUrls.default.http[0]),
    });
  }

  /** One batched eth_call. Always routed through the deployed Multicall3. */
  async batch(contracts) {
    return this.client.multicall({
      allowFailure: true,
      contracts,
      ...(this.multicallAddress ? {multicallAddress: this.multicallAddress} : {}),
    });
  }

  // ───────────────────────────────── resolution

  /**
   * Resolve any of: agentId ("3"), ENS name ("optimizer.kya.eth"), bare label
   * ("optimizer"), or a 0x address (operator or owner). Returns null if nothing
   * matches, so callers can render "no passport" instead of throwing.
   */
  async resolve(query) {
    const q = String(query || '').trim();
    if (!q) return null;

    if (/^\d+$/.test(q)) {
      const id = BigInt(q);
      const count = await this.agentCount();
      return id > 0n && id <= count ? id : null;
    }

    if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
      const addr = getAddress(q);
      const byOperator = await this.client.readContract({
        address: this.contracts.registry,
        abi: PassportRegistryABI,
        functionName: 'agentIdByOperator',
        args: [addr],
      });
      if (byOperator > 0n) return byOperator;
      const owned = await this.client.readContract({
        address: this.contracts.registry,
        abi: PassportRegistryABI,
        functionName: 'agentsOf',
        args: [addr],
      });
      return owned.length ? owned[0] : null;
    }

    const candidates = q.includes('.') ? [q] : [q, `${q}.${await this.parentName()}`];
    for (const name of candidates) {
      const id = await this.client.readContract({
        address: this.contracts.registry,
        abi: PassportRegistryABI,
        functionName: 'agentIdByDomain',
        args: [name],
      });
      if (id > 0n) return id;
      const viaNames = await this.client.readContract({
        address: this.contracts.names,
        abi: AgentNameRegistrarABI,
        functionName: 'agentIdOfName',
        args: [name],
      });
      if (viaNames > 0n) return viaNames;
    }
    // Bare label with the parent appended, via the name registrar.
    if (!q.includes('.')) {
      const id = await this.client.readContract({
        address: this.contracts.names,
        abi: AgentNameRegistrarABI,
        functionName: 'agentIdOfName',
        args: [`${q}.${await this.parentName()}`],
      });
      if (id > 0n) return id;
    }
    return null;
  }

  async parentName() {
    if (!this._parentName) {
      this._parentName = await this.client.readContract({
        address: this.contracts.names,
        abi: AgentNameRegistrarABI,
        functionName: 'parentName',
      });
    }
    return this._parentName;
  }

  async agentCount() {
    return this.client.readContract({
      address: this.contracts.registry,
      abi: PassportRegistryABI,
      functionName: 'agentCount',
    });
  }

  // ───────────────────────────────── passport read

  /** Full passport, denormalised for the UI. One multicall, so it can't half-load. */
  async passport(agentId) {
    const id = BigInt(agentId);
    const registry = {address: this.contracts.registry, abi: PassportRegistryABI};
    const names = {address: this.contracts.names, abi: AgentNameRegistrarABI};
    const attestor = {address: this.contracts.attestor, abi: HumanhoodAttestorABI};

    const [passportRes, countRes, logRes] = await this.batch([
      {...registry, functionName: 'passportOf', args: [id]},
      {...registry, functionName: 'actionCount', args: [id]},
      {...registry, functionName: 'recentActions', args: [id, 25n]},
    ]);
    if (passportRes.status !== 'success') return null;

    const [agent, authority, reputation, capabilities, score, ownerProof, ownerNullifier, spendRemaining] =
      passportRes.result;

    const [ensNameRes, nodeRes, humanhoodRes] = await this.batch([
      {...names, functionName: 'nameOfAddress', args: [agent.operator]},
      {...names, functionName: 'nodeForLabel', args: [agent.domain.split('.')[0]]},
      // The World app id the attestation was issued under. Carried through so the
      // UI can distinguish a real World ID proof from a locally-attested one
      // instead of rendering both as an identical "human-backed" badge.
      {...attestor, functionName: 'humanhoodOf', args: [agent.owner]},
    ]);

    const ensName = ensNameRes.status === 'success' && ensNameRes.result ? ensNameRes.result : null;
    const node = nodeRes.status === 'success' ? nodeRes.result : null;

    let textRecords = {};
    if (ensName) {
      const keys = ['description', 'url', 'avatar', 'agent.capabilities', 'agent.passport', 'agent.reputation'];
      const reads = await this.batch(keys.map((key) => ({...names, functionName: 'text', args: [node, key]})));
      keys.forEach((key, i) => {
        if (reads[i].status === 'success' && reads[i].result) textRecords[key] = reads[i].result;
      });
    }

    const totalActions = Number(countRes.status === 'success' ? countRes.result : 0n);

    // recentActions() is newest-first, so the true log index counts down from the end.
    const actions = (logRes.status === 'success' ? logRes.result : []).map((a, i) => ({
      index: totalActions - 1 - i,
      outcome: OutcomeName[Number(a.outcome)],
      outcomeCode: Number(a.outcome),
      timestamp: Number(a.timestamp),
      value: a.value.toString(),
      valueEth: formatEther(a.value),
      evidence: a.evidence,
      kind: a.kind,
      witness: a.witness,
    }));

    const proofKind = Number(ownerProof);
    const total = Number(reputation.total);
    const humanhood = humanhoodRes.status === 'success' ? humanhoodRes.result : null;
    // A locally-attested proof carries the seed/local app id. Surfacing it lets
    // the UI say "attested locally" instead of implying a real World ID check.
    const proofAppId = humanhood?.appId || null;
    const proofIsWorldApp = Boolean(proofAppId && /^(app_|rp_)/.test(proofAppId));

    return {
      agentId: id.toString(),
      chainId: this.chainId,
      registry: this.contracts.registry,
      owner: agent.owner,
      operator: agent.operator,
      domain: agent.domain,
      ensName,
      ensNode: node,
      metadataURI: agent.metadataURI,
      registeredAt: Number(agent.registeredAt),
      active: agent.active,
      humanVerified: PRODUCTION_PROOFS.has(proofKind),
      proofKind,
      proofKindName: ProofKindName[proofKind] || 'none',
      proofAppId,
      proofIsWorldApp,
      proofVerifiedAt: humanhood ? Number(humanhood.verifiedAt) : 0,
      ownerNullifier,
      capabilities,
      authority: {
        spendLimitPerDay: authority.spendLimitPerDay.toString(),
        spendLimitPerDayEth: formatEther(authority.spendLimitPerDay),
        spendRemainingToday: spendRemaining.toString(),
        spendRemainingTodayEth: formatEther(spendRemaining),
        maxActionsPerDay: Number(authority.maxActionsPerDay),
        expiresAt: Number(authority.expiresAt),
        capabilityRoot: authority.capabilityRoot,
      },
      reputation: {
        score: Number(score),
        scorePct: Number(score) / (SCORE_PRECISION / 100),
        total,
        success: Number(reputation.success),
        failure: Number(reputation.failure),
        rejected: Number(reputation.rejected),
        successRatePct: total ? (Number(reputation.success) / total) * 100 : 0,
        firstActionAt: Number(reputation.firstActionAt),
        lastActionAt: Number(reputation.lastActionAt),
        volumeHandled: reputation.volumeHandled.toString(),
        volumeHandledEth: formatEther(reputation.volumeHandled),
        logHead: reputation.logHead,
      },
      actionCount: totalActions,
      actions,
      textRecords,
    };
  }

  async passportByQuery(query) {
    const id = await this.resolve(query);
    return id === null ? null : this.passport(id);
  }

  /** All passports, newest first. Cheap enough at demo scale; paginate later. */
  async allPassports() {
    const count = Number(await this.agentCount());
    const ids = Array.from({length: count}, (_, i) => BigInt(count - i));
    return (await Promise.all(ids.map((id) => this.passport(id)))).filter(Boolean);
  }

  /** Compact directory rows — one batched call for the whole roster. */
  async directory() {
    const count = Number(await this.agentCount());
    if (!count) return [];
    const registry = {address: this.contracts.registry, abi: PassportRegistryABI};
    const ids = Array.from({length: count}, (_, i) => BigInt(i + 1));

    const results = await this.batch(
      ids.flatMap((id) => [
        {...registry, functionName: 'getAgent', args: [id]},
        {...registry, functionName: 'scoreOf', args: [id]},
        {...registry, functionName: 'getReputation', args: [id]},
      ]),
    );

    return ids
      .map((id, i) => {
        const [agentRes, scoreRes, repRes] = results.slice(i * 3, i * 3 + 3);
        if (agentRes.status !== 'success') return null;
        const agent = agentRes.result;
        const rep = repRes.status === 'success' ? repRes.result : null;
        return {
          agentId: id.toString(),
          domain: agent.domain,
          operator: agent.operator,
          owner: agent.owner,
          active: agent.active,
          score: scoreRes.status === 'success' ? Number(scoreRes.result) : 0,
          total: rep ? Number(rep.total) : 0,
          rejected: rep ? Number(rep.rejected) : 0,
        };
      })
      .filter(Boolean)
      .reverse();
  }

  // ───────────────────────────────── authority

  async canPerform(agentId, capability, value = 0n) {
    const [ok, reason] = await this.client.readContract({
      address: this.contracts.registry,
      abi: PassportRegistryABI,
      functionName: 'canPerform',
      args: [BigInt(agentId), capability, BigInt(value)],
    });
    return {ok, reason};
  }

  /**
   * Independently recompute the on-chain hash-chain head from a locally held
   * action log, then compare. This is what makes the 0G Storage mirror
   * *verifiable* rather than merely present: if a single receipt were altered,
   * reordered or dropped, the recomputed head diverges from the registry's.
   */
  async verifyLogIntegrity(agentId) {
    const id = BigInt(agentId);
    const [onchainHead, count] = await Promise.all([
      this.client
        .readContract({address: this.contracts.registry, abi: PassportRegistryABI, functionName: 'getReputation', args: [id]})
        .then((r) => r.logHead),
      this.client.readContract({
        address: this.contracts.registry,
        abi: PassportRegistryABI,
        functionName: 'actionCount',
        args: [id],
      }),
    ]);

    const log = await this.client.readContract({
      address: this.contracts.registry,
      abi: PassportRegistryABI,
      functionName: 'recentActions',
      args: [id, count],
    });
    const chronological = [...log].reverse();

    let head = keccak256(encodePacked(['string', 'uint256'], ['KYA.log.genesis', id]));
    const genesis = head;
    chronological.forEach((a, i) => {
      head = keccak256(
        encodeAbiParameters(
          [
            {type: 'bytes32'},
            {type: 'uint256'},
            {type: 'uint256'},
            {type: 'uint8'},
            {type: 'uint256'},
            {type: 'bytes32'},
            {type: 'bytes32'},
          ],
          [head, id, BigInt(i), Number(a.outcome), a.value, a.evidence, keccak256(toHex(a.kind))],
        ),
      );
    });

    return {
      verified: head.toLowerCase() === onchainHead.toLowerCase(),
      onchainHead,
      recomputedHead: head,
      genesis,
      receipts: chronological.length,
    };
  }
}

