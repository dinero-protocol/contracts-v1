//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface ILocker {
    function lock(
        address,
        uint256,
        uint256
    ) external;
}
