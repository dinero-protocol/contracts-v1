// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

import {UniswapV2Library} from "./library/UniswapV2Library.sol";

interface IBTRFLY {
    function balanceOf(address account) external view returns (uint256);
}

contract Thecosomata {
    IBTRFLY public immutable BTRFLY;
    address public immutable sushiFactory;
    address public immutable OHM;

    constructor(
        address _BTRFLY,
        address _sushiFactory,
        address _OHM
    ) {
        require(_BTRFLY != address(0));
        BTRFLY = IBTRFLY(_BTRFLY);

        require(_sushiFactory != address(0));
        sushiFactory = _sushiFactory;

        require(_OHM != address(0));
        OHM = _OHM;
    }

    /**
        @notice Called by Keeper for checking whether upkeep is needed
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

    /**
        @notice Called by Keeper for executing Thecosomata processes and provide liquidity
        @param  performdata    bytes Data which was passed back from the checkData simulation
     */
    function performUpkeep(bytes calldata performdata) external {
        uint256 ohm = calculateOHMAmountRequiredForLP();
    }

    /**
        @notice Calculates the optimal amount of OHM for pairing with BTRFLY balance when adding liquidity
        @return uint256 Optimal OHM amount for LP
     */
    function calculateOHMAmountRequiredForLP() private view returns (uint256) {
        // Fetch reserves of both OHM and BTRFLY from Sushi LP
        (uint256 OHMReserves, uint256 BTRFLYReserves) = UniswapV2Library
            .getReserves(sushiFactory, OHM, address(BTRFLY));

        // Get optimal amount of OHM required for pairing with BTRFLY balance when adding liquidity
        return (
            UniswapV2Library.quote(
                BTRFLY.balanceOf(address(this)), // Desired amount of BTRFLY to deposit as liquidity
                BTRFLYReserves,
                OHMReserves
            )
        );
    }
}
