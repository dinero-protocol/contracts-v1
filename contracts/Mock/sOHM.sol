// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mocking it as a standatd ERC20 instead of the actual staked+rebased token model for faster tests
contract SOlympus is ERC20 {
  mapping(address => uint256) public debtBalances;

  constructor() ERC20("Staked OHM", "sOHM") {}

  function mint(address account_, uint256 amount_) external {
    _mint(account_, amount_);
  }

  function changeDebt(
    uint256 amount,
    address debtor,
    bool add
  ) external {
    if (add) {
      debtBalances[debtor] += amount;
    } else {
      debtBalances[debtor] -= amount;
    }

    require(debtBalances[debtor] <= balanceOf(debtor), "sOHM: insufficient balance");
  }
}
