// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PassportRegistry} from "./PassportRegistry.sol";
import {Agent} from "./interfaces/IKYA.sol";

/**
 * @title AgentNameRegistrar
 * @notice ENS-compatible name layer for agent passports.
 *
 * Registering a full `.eth` name per agent is slow, costly, and — on a testnet
 * during a hackathon — fragile. Instead KYA owns one parent name (`kya.eth`) and
 * issues subnames beneath it (`optimizer.kya.eth`). Per the PRD's own mitigation
 * for ENS cost/availability risk, this is the intended path.
 *
 * What makes this a real ENS integration rather than a string column:
 *  - Namehash (EIP-137) is computed on-chain, so `namehash("optimizer.kya.eth")`
 *    here equals the node any ENS client computes.
 *  - Implements the standard resolver profile: `addr(bytes32)` (EIP-137),
 *    `addr(bytes32,uint256)` (ENSIP-9), `text(bytes32,string)` (EIP-634) and
 *    `name(bytes32)` for reverse resolution, gated by `supportsInterface`.
 *    Point `kya.eth`'s resolver at this contract and every subname resolves
 *    through stock ENS tooling with no KYA-specific code.
 *  - Text records are the agent card: `agent.capabilities`, `agent.passport`,
 *    `description`, `url`, `avatar`. A wallet or another agent can read an
 *    agent's capabilities with a plain `getText` call.
 *
 * Text records for passport-derived fields are *computed*, not stored, so a name
 * can never drift out of sync with the registry that owns the truth.
 */
contract AgentNameRegistrar {
    error NotAdmin();
    error NotNameOwner();
    error NameTaken();
    error InvalidLabel();
    error NoSuchName();

    event ParentNameSet(string parentName, bytes32 parentNode);
    event SubnameRegistered(bytes32 indexed node, string label, string fullName, address indexed owner, uint256 agentId);
    event TextChanged(bytes32 indexed node, string indexed key, string value);
    event AddrChanged(bytes32 indexed node, address addr);
    event ReverseSet(address indexed addr, bytes32 indexed node);

    struct Name {
        string label;
        string fullName;
        address owner;
        address target; // addr() record
        uint256 agentId;
        uint64 registeredAt;
    }

    // ERC-165 interface ids for the ENS resolver profile.
    bytes4 private constant IFACE_ERC165 = 0x01ffc9a7;
    bytes4 private constant IFACE_ADDR = 0x3b3b57de; // addr(bytes32)
    bytes4 private constant IFACE_ADDR_COINTYPE = 0xf1cb7e06; // addr(bytes32,uint256)
    bytes4 private constant IFACE_TEXT = 0x59d1d43c; // text(bytes32,string)
    bytes4 private constant IFACE_NAME = 0x691f3431; // name(bytes32)
    uint256 private constant COINTYPE_ETH = 60;

    address public admin;
    PassportRegistry public registry;

    string public parentName;
    bytes32 public parentNode;

    mapping(bytes32 => Name) private _names;
    mapping(bytes32 => mapping(string => string)) private _text;
    mapping(bytes32 => string[]) private _textKeys;
    mapping(bytes32 => mapping(string => bool)) private _textKeySeen;
    mapping(address => bytes32) public reverseNode;
    bytes32[] private _allNodes;

    constructor(string memory parentName_, PassportRegistry registry_) {
        admin = msg.sender;
        registry = registry_;
        parentName = parentName_;
        parentNode = namehash(parentName_);
        emit ParentNameSet(parentName_, parentNode);
    }

    // ─────────────────────────────────────────── EIP-137 namehash

    /// @notice EIP-137 namehash of a dotted name, computed on-chain.
    function namehash(string memory name) public pure returns (bytes32 node) {
        bytes memory b = bytes(name);
        node = bytes32(0);
        if (b.length == 0) return node;

        uint256 end = b.length;
        // Walk right-to-left, hashing each label into the accumulator.
        for (uint256 i = b.length; i > 0; i--) {
            if (b[i - 1] == ".") {
                node = keccak256(abi.encodePacked(node, _labelhash(b, i, end)));
                end = i - 1;
            }
        }
        node = keccak256(abi.encodePacked(node, _labelhash(b, 0, end)));
    }

    function _labelhash(bytes memory b, uint256 start, uint256 end) private pure returns (bytes32) {
        bytes memory label = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            label[i - start] = b[i];
        }
        return keccak256(label);
    }

    function nodeForLabel(string memory label) public view returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }

    function fullNameForLabel(string memory label) public view returns (string memory) {
        return string(abi.encodePacked(label, ".", parentName));
    }

    // ─────────────────────────────────────────── registration

    /**
     * @notice Claim `label`.kya.eth for an agent passport.
     * @dev Callable by the passport's owner. The name and the passport are bound
     *      both ways, so reverse resolution (FR6) is a single mapping read.
     */
    function registerSubname(string calldata label, uint256 agentId, address target)
        external
        returns (bytes32 node)
    {
        if (!_validLabel(label)) revert InvalidLabel();
        Agent memory a = registry.getAgent(agentId);
        if (a.owner != msg.sender) revert NotNameOwner();

        node = nodeForLabel(label);
        if (_names[node].owner != address(0)) revert NameTaken();

        string memory full = fullNameForLabel(label);
        _names[node] = Name({
            label: label,
            fullName: full,
            owner: msg.sender,
            target: target == address(0) ? a.operator : target,
            agentId: agentId,
            registeredAt: uint64(block.timestamp)
        });
        _allNodes.push(node);
        reverseNode[_names[node].target] = node;

        emit SubnameRegistered(node, label, full, msg.sender, agentId);
        emit AddrChanged(node, _names[node].target);
        emit ReverseSet(_names[node].target, node);
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        if (_names[node].owner != msg.sender && msg.sender != admin) revert NotNameOwner();
        _text[node][key] = value;
        if (!_textKeySeen[node][key]) {
            _textKeySeen[node][key] = true;
            _textKeys[node].push(key);
        }
        emit TextChanged(node, key, value);
    }

    function setAddr(bytes32 node, address target) external {
        if (_names[node].owner != msg.sender) revert NotNameOwner();
        _names[node].target = target;
        reverseNode[target] = node;
        emit AddrChanged(node, target);
        emit ReverseSet(target, node);
    }

    // ─────────────────────────────────────────── ENS resolver profile

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == IFACE_ERC165 || id == IFACE_ADDR || id == IFACE_ADDR_COINTYPE || id == IFACE_TEXT
            || id == IFACE_NAME;
    }

    /// @notice EIP-137 forward resolution.
    function addr(bytes32 node) public view returns (address) {
        return _names[node].target;
    }

    /// @notice ENSIP-9 multichain resolution. Only cointype 60 (ETH) is populated.
    function addr(bytes32 node, uint256 coinType) external view returns (bytes memory) {
        if (coinType != COINTYPE_ETH) return "";
        return abi.encodePacked(_names[node].target);
    }

    /// @notice Reverse resolution: node -> name.
    function name(bytes32 node) external view returns (string memory) {
        return _names[node].fullName;
    }

    /**
     * @notice EIP-634 text records.
     * @dev Passport-derived keys are computed live from the registry so a name can
     *      never advertise stale capabilities or a stale score. Everything else
     *      falls through to owner-set storage.
     */
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        Name storage n = _names[node];
        if (n.owner == address(0)) return "";
        uint256 agentId = n.agentId;

        if (_eq(key, "agent.capabilities")) {
            return _join(registry.getCapabilities(agentId), ",");
        }
        if (_eq(key, "agent.passport")) {
            return string(
                abi.encodePacked("eip155:", _u(block.chainid), ":", _hex(address(registry)), "/", _u(agentId))
            );
        }
        if (_eq(key, "agent.reputation")) {
            return _u(uint256(registry.scoreOf(agentId)));
        }
        if (_eq(key, "agent.owner")) {
            return _hex(registry.getAgent(agentId).owner);
        }
        if (_eq(key, "agent.humanVerified")) {
            return registry.attestor().isHumanVerified(registry.getAgent(agentId).owner) ? "true" : "false";
        }
        return _text[node][key];
    }

    // ─────────────────────────────────────────── views

    function getName(bytes32 node) external view returns (Name memory) {
        return _names[node];
    }

    function resolveName(string calldata full) external view returns (Name memory) {
        return _names[namehash(full)];
    }

    /// @notice FR6 reverse path: wallet address -> ENS name (empty string if none).
    function nameOfAddress(address a) external view returns (string memory) {
        return _names[reverseNode[a]].fullName;
    }

    function agentIdOfName(string calldata full) external view returns (uint256) {
        return _names[namehash(full)].agentId;
    }

    function customTextKeys(bytes32 node) external view returns (string[] memory) {
        return _textKeys[node];
    }

    function allNodes() external view returns (bytes32[] memory) {
        return _allNodes;
    }

    // ─────────────────────────────────────────── helpers

    /// @dev Conservative label rules: lowercase alnum and hyphen, 3..32 chars.
    function _validLabel(string calldata label) private pure returns (bool) {
        bytes memory b = bytes(label);
        if (b.length < 3 || b.length > 32) return false;
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            bool ok = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x2d;
            if (!ok) return false;
        }
        if (b[0] == "-" || b[b.length - 1] == "-") return false;
        return true;
    }

    function _eq(string calldata a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _join(string[] memory parts, string memory sep) private pure returns (string memory out) {
        for (uint256 i = 0; i < parts.length; i++) {
            out = i == 0 ? parts[i] : string(abi.encodePacked(out, sep, parts[i]));
        }
    }

    function _u(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) len++;
        bytes memory s = new bytes(len);
        for (uint256 t = v; t != 0; t /= 10) s[--len] = bytes1(uint8(48 + (t % 10)));
        return string(s);
    }

    function _hex(address a) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory s = new bytes(42);
        s[0] = "0";
        s[1] = "x";
        uint160 v = uint160(a);
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(v >> (8 * (19 - i)));
            s[2 + i * 2] = alphabet[b >> 4];
            s[3 + i * 2] = alphabet[b & 0x0f];
        }
        return string(s);
    }
}
