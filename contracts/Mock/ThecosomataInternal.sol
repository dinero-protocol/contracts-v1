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
        address _SushiRouter
    )
        Thecosomata(
            BTRFLY_,
            sushiFactory_,
            OHM_,
            _sOHM,
            _OlympusTreasury,
            _RedactedTreasury,
            _SushiRouter
        )
    {}

    function _calculateOHMAmountRequiredForLP() public view returns (uint256) {
        return calculateOHMAmountRequiredForLP();
    }

    function _withdrawSOHMFromTreasury(uint256 amount) public {
        return withdrawSOHMFromTreasury(amount);
    }

    function _incurOlympusDebt(uint256 amount) public {
        return incurOlympusDebt(amount);
    }
}
