// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

import {Thecosomata} from "../Thecosomata.sol";

contract ThecosomataInternal is Thecosomata {
    constructor(
        address BTRFLY_,
        address sushiFactory_,
        address OHM_,
        address _sOHM,
        address _OlympusTreasury,
        address _RedactedTreasury,
        address _SushiRouter,
        address _OlympusStaking,
        uint256 _debtFee
    )
        Thecosomata(
            BTRFLY_,
            sushiFactory_,
            OHM_,
            _sOHM,
            _OlympusTreasury,
            _RedactedTreasury,
            _SushiRouter,
            _OlympusStaking,
            _debtFee
        )
    {}

    function _calculateAmountRequiredForLP(
        uint256 tokenAAmount,
        bool tokenAIsBTRFLY
    ) public view returns (uint256) {
        return calculateAmountRequiredForLP(tokenAAmount, tokenAIsBTRFLY);
    }

    function _withdrawSOHMFromTreasury(uint256 amount) public {
        return withdrawSOHMFromTreasury(amount);
    }

    function _incurOlympusDebt(uint256 amount) public {
        return incurOlympusDebt(amount);
    }

    function _addOHMBTRFLYLiquiditySushiSwap(
        uint256 ohmAmount,
        uint256 btrflyAmount
    ) public {
        return addOHMBTRFLYLiquiditySushiSwap(ohmAmount, btrflyAmount);
    }

    function _unstakeSOHM(uint256 amount) public {
        return unstakeSOHM(amount);
    }

    function _getRemainingDebtCapacity() public view returns (uint256) {
        return getRemainingDebtCapacity();
    }

    function _getRemainingUnstakeableSOHM() public view returns (uint256) {
        return getRemainingUnstakeableSOHM();
    }

    function _addLiquidity(bool shouldBorrow) public {
        return addLiquidity(shouldBorrow);
    }
}
