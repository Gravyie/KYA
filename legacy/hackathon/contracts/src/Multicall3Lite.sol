// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title Multicall3Lite
 * @notice The read-only slice of Multicall3 (`aggregate3`), deployed by KYA itself.
 *
 * The passport UI reads a whole passport — identity, authority, reputation,
 * capabilities, score, humanhood proof and today's remaining spend — and must
 * render it as one atomic verdict. Issuing seven separate RPC calls means the
 * screen can half-load in front of judges, or worse, show authority from one
 * block next to reputation from another. Batching them into a single `eth_call`
 * removes that class of failure entirely.
 *
 * Canonical Multicall3 is deployed at 0xcA11...CA11 on most public chains, but
 * neither a bare `anvil` node nor 0G Galileo guarantees it. Rather than degrade
 * to sequential reads on the exact chains the demo runs on, KYA deploys this and
 * records the address in the shared address book. The ABI is call-compatible
 * with Multicall3, so any standard client (viem's `multicall`, ethers'
 * Multicall) works against it unmodified.
 */
contract Multicall3Lite {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    error Multicall3CallFailed(uint256 index);

    /// @notice Batch static/stateful calls, per-call failure tolerance.
    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        for (uint256 i = 0; i < length; i++) {
            Call3 calldata call = calls[i];
            (bool success, bytes memory ret) = call.target.call(call.callData);
            if (!success && !call.allowFailure) revert Multicall3CallFailed(i);
            returnData[i] = Result({success: success, returnData: ret});
        }
    }
}
