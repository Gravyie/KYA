// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HumanhoodAttestor} from "../src/HumanhoodAttestor.sol";
import {PassportRegistry} from "../src/PassportRegistry.sol";
import {AgentNameRegistrar} from "../src/AgentNameRegistrar.sol";
import {Multicall3Lite} from "../src/Multicall3Lite.sol";

/**
 * @notice Deploys the KYA contract set and writes an address book that the SDK,
 *         API and web app all read, so nothing hardcodes an address.
 *
 * env:
 *   PRIVATE_KEY   deployer (becomes admin + first executor)
 *   ATTESTOR_ADDR public key of the World ID verifier service
 *   EXECUTOR_ADDR key that submits action receipts
 *   PARENT_NAME   ENS parent name to issue subnames under (default kya.eth)
 */
contract Deploy is Script {
    struct Book {
        string parentName;
        address deployer;
        address attestorSigner;
        address executor;
        address attestor;
        address registry;
        address names;
        address multicall;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address attestorAddr = vm.envAddress("ATTESTOR_ADDR");
        address executorAddr = vm.envOr("EXECUTOR_ADDR", vm.addr(pk));
        string memory parentName = vm.envOr("PARENT_NAME", string("kya.eth"));

        vm.startBroadcast(pk);
        HumanhoodAttestor attestor = new HumanhoodAttestor(attestorAddr);
        PassportRegistry registry = new PassportRegistry(attestor);
        AgentNameRegistrar names = new AgentNameRegistrar(parentName, registry);
        // Batched passport reads: one eth_call for the whole verdict, so the UI
        // cannot half-load. Deployed here because neither anvil nor Galileo
        // guarantees canonical Multicall3.
        Multicall3Lite multicall = new Multicall3Lite();
        if (executorAddr != vm.addr(pk)) registry.setExecutor(executorAddr, true);
        vm.stopBroadcast();

        console2.log("chainId          ", block.chainid);
        console2.log("deployer         ", vm.addr(pk));
        console2.log("HumanhoodAttestor", address(attestor));
        console2.log("PassportRegistry ", address(registry));
        console2.log("NameRegistrar    ", address(names));
        console2.log("Multicall3Lite   ", address(multicall));

        _writeAddressBook(
            Book({
                parentName: parentName,
                deployer: vm.addr(pk),
                attestorSigner: attestorAddr,
                executor: executorAddr,
                attestor: address(attestor),
                registry: address(registry),
                names: address(names),
                multicall: address(multicall)
            })
        );
    }

    /// @dev Split out so the JSON string concatenation doesn't blow the stack.
    function _writeAddressBook(Book memory b) private {
        string memory head = string.concat(
            '{\n  "chainId": ',
            vm.toString(block.chainid),
            ',\n  "parentName": "',
            b.parentName,
            '",\n  "deployer": "',
            vm.toString(b.deployer),
            '",\n  "attestorSigner": "',
            vm.toString(b.attestorSigner),
            '",\n  "executor": "',
            vm.toString(b.executor),
            '",\n'
        );
        string memory body = string.concat(
            '  "contracts": {\n    "HumanhoodAttestor": "',
            vm.toString(b.attestor),
            '",\n    "PassportRegistry": "',
            vm.toString(b.registry),
            '",\n    "AgentNameRegistrar": "',
            vm.toString(b.names),
            '",\n    "Multicall3": "',
            vm.toString(b.multicall),
            '"\n  }\n}\n'
        );
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, string.concat(head, body));
        console2.log("address book ->", path);
    }
}
