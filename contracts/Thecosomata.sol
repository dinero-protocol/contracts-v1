// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

import "hardhat/console.sol";
import {UniswapV2Library} from "./library/UniswapV2Library.sol";
import {IERC20} from "./interface/IERC20.sol";
import {SafeMath} from "./library/SafeMath.sol";
import {Ownable} from "./base/Ownable.sol";

interface IBTRFLY is IERC20 {
    function burn(uint256 amount) external;
}

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

interface ISushiFactory {
    function getPair(address tokenA, address tokenB) external returns (address);
}

interface IOlympusStaking {
    function unstake(
        address _to,
        uint256 _amount,
        bool _trigger,
        bool _rebasing
    ) external returns (uint256);
}

contract Thecosomata is Ownable {
    using SafeMath for uint256;

    address public immutable BTRFLY;
    address public immutable sushiFactory;
    address public immutable OHM;
    address public immutable sOHM;
    address public immutable OlympusTreasury;
    address public immutable RedactedTreasury;
    address public immutable SushiRouter;
    address public immutable OlympusStaking;
    uint256 public debtFee; // in ten-thousandths ( 5000 = 0.5% )

    event SetDebtFee(uint256 updatedDebtFee);
    event TransferLPTokens(uint256 olympusFee, uint256 redactedDeposit);
    event AddLiquidity(
        uint256 ohmLiquidity,
        uint256 btrflyLiquidity,
        uint256 btrflyBurned,
        uint256 capacityBefore, // capacity = debt or unstaking capacity
        uint256 capacityAfter
    );

    constructor(
        address _BTRFLY,
        address _sushiFactory,
        address _OHM,
        address _sOHM,
        address _OlympusTreasury,
        address _RedactedTreasury,
        address _SushiRouter,
        address _OlympusStaking,
        uint256 _debtFee
    ) {
        require(_BTRFLY != address(0));
        BTRFLY = _BTRFLY;

        require(_sushiFactory != address(0));
        sushiFactory = _sushiFactory;

        require(_OHM != address(0));
        OHM = _OHM;

        require(_sOHM != address(0));
        sOHM = _sOHM;

        require(_OlympusTreasury != address(0));
        OlympusTreasury = _OlympusTreasury;

        require(_RedactedTreasury != address(0));
        RedactedTreasury = _RedactedTreasury;

        require(_SushiRouter != address(0));
        SushiRouter = _SushiRouter;

        require(_OlympusStaking != address(0));
        OlympusStaking = _OlympusStaking;

        IERC20(_OHM).approve(_SushiRouter, 2**256 - 1);
        IBTRFLY(_BTRFLY).approve(_SushiRouter, 2**256 - 1);
        IERC20(_sOHM).approve(_OlympusStaking, 2**256 - 1);

        debtFee = _debtFee;
    }

    /**
        @notice Set debt fee
        @param  _debtFee uint256 New debt fee
     */
    function setDebtFee(uint256 _debtFee) external onlyOwner {
        debtFee = _debtFee;

        emit SetDebtFee(debtFee);
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
        if (IBTRFLY(BTRFLY).balanceOf(address(this)) > 0) {
            return (true, bytes(""));
        }
    }

    /**
        @notice Called by Keeper for executing Thecosomata processes and provide liquidity
        @param  performdata    bytes Data which was passed back from the checkData simulation
     */
    function performUpkeep(bytes calldata performdata) external {
        bool shouldBorrow = abi.decode(performdata, (bool));

        addLiquidity(shouldBorrow);
    }

    /**
        @notice Calculates the optimal amount of token B needed for pairing with token A when adding liquidity
        @param tokenAAmount   uint256 Fixed amount of tokens that we will be adding as liquidity token A
        @param tokenAIsBTRFLY bool    Whether token A is BTRFLY
        @return uint256
     */
    function calculateAmountRequiredForLP(
        uint256 tokenAAmount,
        bool tokenAIsBTRFLY
    ) internal view returns (uint256) {
        // Fetch reserves of both OHM and BTRFLY from Sushi LP
        (uint256 OHMReserves, uint256 BTRFLYReserves) = UniswapV2Library
            .getReserves(sushiFactory, OHM, BTRFLY);
        uint256 tokenAReserves = tokenAIsBTRFLY ? BTRFLYReserves : OHMReserves;
        uint256 tokenBReserves = tokenAIsBTRFLY ? OHMReserves : BTRFLYReserves;

        return (
            UniswapV2Library.quote(
                tokenAAmount, // Desired amount of token A to deposit as liquidity
                tokenAReserves,
                tokenBReserves
            )
        );
    }

    /**
        @notice Get remaining debt capacity with Olympus
        @return uint256 Debt capacity
     */
    function getRemainingDebtCapacity() internal view returns (uint256) {
        // Get the amount of OHM borrowed
        uint256 debtBalance = IsOHM(sOHM).debtBalances(address(this));

        // Get the maximum amount of OHM we can borrow
        uint256 debtLimit = IOlympusTreasury(OlympusTreasury).debtLimit(
            address(this)
        );

        return debtLimit.sub(debtBalance);
    }

    /**
        @notice Get the amount of sOHM that can be withdrawn and unstaked
        @return uint256 Unstakeable sOHM
     */
    function getRemainingUnstakeableSOHM() internal view returns (uint256) {
        uint256 totalSOHM = IsOHM(sOHM).balanceOf(RedactedTreasury).add(
            IsOHM(sOHM).balanceOf(address(this))
        );
        uint256 sOHMReservedForOlympus = IOlympusTreasury(OlympusTreasury)
            .debtLimit(address(this))
            .mul(2);

        return totalSOHM.sub(sOHMReservedForOlympus);
    }

    /**
        @notice Withdraw sOHM from Redacted treasury
        @param  amount uint256 The amount of sOHM to withdraw
     */
    function withdrawSOHMFromTreasury(uint256 amount) internal {
        IRedactedTreasury(RedactedTreasury).manage(sOHM, amount);
    }

    /**
        @notice Borrow OHM from Olympus treasury using uncollateralized sOHM
     */
    function incurOlympusDebt(uint256 amount) internal {
        IOlympusTreasury(OlympusTreasury).incurDebt(amount, OHM);
    }

    /**
        @notice Add OHM and BTRFLY as liquidity to Sushi LP
        @param ohmAmount    uint256 OHM to add as liquidity
        @param btrflyAmount uint256 BTRFLY to add as liquidity
     */
    function addOHMBTRFLYLiquiditySushiSwap(
        uint256 ohmAmount,
        uint256 btrflyAmount
    ) internal {
        (, , uint256 slpMinted) = ISushiRouter(SushiRouter).addLiquidity(
            BTRFLY,
            OHM,
            btrflyAmount,
            ohmAmount,
            btrflyAmount,
            ohmAmount,
            address(this), // Mint LP tokens directly to Redacted treasury
            block.timestamp + 5 minutes
        );

        IERC20 slpContract = IERC20(
            ISushiFactory(sushiFactory).getPair(OHM, BTRFLY)
        );

        uint256 olympusFee;
        uint256 redactedDeposit;

        if (debtFee > 0) {
            // Send Olympus fee in the form of LP tokens
            olympusFee = slpMinted.mul(debtFee).div(1000000);

            slpContract.transfer(OlympusTreasury, olympusFee);
        }

        redactedDeposit = slpMinted.sub(olympusFee);

        // Transfer LP token balance to Redacted treasury
        slpContract.transfer(RedactedTreasury, redactedDeposit);

        emit TransferLPTokens(olympusFee, redactedDeposit);
    }

    /**
        @notice Unstake sOHM balance
     */
    function unstakeSOHM(uint256 amount) internal {
        IOlympusStaking(OlympusStaking).unstake(
            address(this),
            amount,
            true,
            true
        );
    }

    /**
        @notice Borrow from the Olympus Treasury and add liquidity
        @param  shouldBorrow bool Whether we should borrow or unstake
     */
    function addLiquidity(bool shouldBorrow) internal {
        uint256 btrfly = IBTRFLY(BTRFLY).balanceOf(address(this));

        // Amount of OHM we will withdraw and use as collateral or unstake if we have enough capacity
        uint256 ohm = calculateAmountRequiredForLP(btrfly, true);

        // The borrow or unstaking capacity
        uint256 ohmCap = shouldBorrow
            ? getRemainingDebtCapacity()
            : getRemainingUnstakeableSOHM();
        uint256 ohmLiquidity = ohmCap > ohm ? ohm : ohmCap;

        // Use BTRFLY balance if remaining capacity is enough, otherwise, calculate BTRFLY amount
        uint256 btrflyLiquidity = ohmCap > ohm
            ? btrfly
            : calculateAmountRequiredForLP(ohmLiquidity, false);

        withdrawSOHMFromTreasury(ohmLiquidity);

        if (shouldBorrow) {
            incurOlympusDebt(ohmLiquidity);
        } else {
            unstakeSOHM(ohmLiquidity);
        }

        addOHMBTRFLYLiquiditySushiSwap(ohmLiquidity, btrflyLiquidity);

        // Leftover BTRFLY that was not used (i.e. ohmCap > ohm)
        uint256 unusedBTRFLY = IBTRFLY(BTRFLY).balanceOf(address(this));

        if (unusedBTRFLY > 0) {
            IBTRFLY(BTRFLY).burn(unusedBTRFLY);
        }

        emit AddLiquidity(
            ohmLiquidity,
            btrflyLiquidity,
            unusedBTRFLY,
            ohmCap,
            ohmCap.sub(ohmLiquidity)
        );
    }
}
