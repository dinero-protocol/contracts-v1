// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

import {Thecosomata} from "../Thecosomata.sol";

contract ThecosomataInternal is Thecosomata {
    constructor(
        address BTRFLY_,
        address sushiFactory_,
        address OHM_
    ) Thecosomata(BTRFLY_, sushiFactory_, OHM_) {}

    function _calculateOHMAmountRequiredForLP() public view returns (uint256) {
        return calculateOHMAmountRequiredForLP();
    }
}
