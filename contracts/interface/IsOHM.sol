// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

interface IsOHM {
  function changeDebt(
    uint256 amount,
    address debtor,
    bool add
  ) external;

  function debtBalances(address _address) external view returns (uint256);
}