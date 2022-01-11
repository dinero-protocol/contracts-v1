// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

interface IBTRFLY {
    function balanceOf(address account) external view returns (uint256);
}

contract Thecosomata {
    IBTRFLY public immutable BTRFLY;

    constructor(address _BTRFLY) {
        require(_BTRFLY != address(0));
        BTRFLY = IBTRFLY(_BTRFLY);
    }

    /**
        @notice Function called by Keeper for checking whether upkeep is needed
        @param  checkData    bytes Data passed to the contract when checking for upkeep
        @return upkeepNeeded bool  Indicates whether performUpkeep should be called
        @return performData  bytes Bytes that the Keeper should call performUpkeep with
     */
    function checkUpkeep(bytes calldata checkData)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (BTRFLY.balanceOf(address(this)) > 0) {
            return (true, bytes(""));
        }
    }
}
