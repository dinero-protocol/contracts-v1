// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

import {UniswapV2Library} from "./library/UniswapV2Library.sol";
import {IERC20} from "./interface/IERC20.sol";
import {SafeMath} from "./library/SafeMath.sol";

interface IsOHM is IERC20 {
    function debtBalances(address _address) external view returns (uint256);
}

interface IOlympusTreasury {
    function debtLimit(address) external view returns (uint256);

    function incurDebt(uint256 _amount, address _token) external;
}

interface IRedactedTreasury {
    function manage(address _token, uint256 _amount) external;
}

interface ISushiRouter {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        );
}

contract Thecosomata {
    using SafeMath for uint256;

    IERC20 public immutable BTRFLY;
    address public immutable sushiFactory;
    address public immutable OHM;
    IsOHM public immutable sOHM;
    IOlympusTreasury public immutable OlympusTreasury;
    IRedactedTreasury public immutable RedactedTreasury;
    ISushiRouter public immutable SushiRouter;

    constructor(
        address _BTRFLY,
        address _sushiFactory,
        address _OHM,
        address _sOHM,
        address _OlympusTreasury,
        address _RedactedTreasury,
        address _SushiRouter
    ) {
        require(_BTRFLY != address(0));
        BTRFLY = IERC20(_BTRFLY);

        require(_sushiFactory != address(0));
        sushiFactory = _sushiFactory;

        require(_OHM != address(0));
        OHM = _OHM;

        require(_sOHM != address(0));
        sOHM = IsOHM(_sOHM);

        require(_OlympusTreasury != address(0));
        OlympusTreasury = IOlympusTreasury(_OlympusTreasury);

        require(_RedactedTreasury != address(0));
        RedactedTreasury = IRedactedTreasury(_RedactedTreasury);

        require(_SushiRouter != address(0));
        SushiRouter = ISushiRouter(_SushiRouter);
    }

    /**
        @notice Called by Keeper for checking whether upkeep is needed
        @param  checkData    bytes Data passed to the contract when checking for upkeep
        @return upkeepNeeded bool  Indicates whether performUpkeep should be called
        @return performData  bytes Bytes that the Keeper can use when calling performUpkeep
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
    function calculateOHMAmountRequiredForLP() internal view returns (uint256) {
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

    /**
        @notice Get remaining debt capacity with Olympus
        @return uint256 Debt capacity
     */
    function getRemainingDebtCapacity() internal view returns (uint256) {
        // Get the amount of OHM borrowed
        uint256 debtBalance = sOHM.debtBalances(address(this));

        // Get the maximum amount of OHM we can borrow
        uint256 debtLimit = OlympusTreasury.debtLimit(address(this));

        return debtLimit.sub(debtBalance);
    }

    /**
        @notice Withdraw sOHM from Redacted treasury
        @param  amount uint256 The amount of sOHM to withdraw
     */
    function withdrawSOHMFromTreasury(uint256 amount) internal {
        RedactedTreasury.manage(address(sOHM), amount);
    }

    /**
        @notice Borrow OHM from Olympus treasury using sOHM balance
     */
    function incurOlympusDebt() internal {
        OlympusTreasury.incurDebt(sOHM.balanceOf(address(this)), OHM);
    }

    /**
        @notice Add OHM and BTRFLY as liquidity to Sushi LP
     */
    function addOHMBTRFLYLiquiditySushiSwap() internal {
        uint256 BTRFLYBalance = BTRFLY.balanceOf(address(this));
        uint256 OHMBalance = IERC20(OHM).balanceOf(address(this));

        SushiRouter.addLiquidity(
            address(BTRFLY),
            OHM,
            BTRFLYBalance,
            OHMBalance,
            BTRFLYBalance,
            OHMBalance,
            address(RedactedTreasury), // Mint LP tokens directly to Redacted treasury
            block.timestamp + 5 minutes
        );
    }
}
