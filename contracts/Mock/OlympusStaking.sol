// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OlympusStaking {
  IERC20 public immutable OHM;
  IERC20 public immutable sOHM;

  constructor(
    address _ohm,
    address _sOHM
  ) {
    require(_ohm != address(0), "Zero address: OHM");
    OHM = IERC20(_ohm);
    require(_sOHM != address(0), "Zero address: sOHM");
    sOHM = IERC20(_sOHM);
  }

  function unstake(
    address _to,
    uint256 _amount,
    bool _trigger,
    bool _rebasing
  ) external returns (uint256 amount_) {
    amount_ = _amount;

    if (_trigger) {
      // Not doing anything with trigger
    }
    if (_rebasing) {
      sOHM.transferFrom(msg.sender, address(this), _amount);
    } else {
      // Not doing anything with gOHM related logic
    }

    require(amount_ <= OHM.balanceOf(address(this)), "Insufficient OHM balance in contract");
    OHM.transfer(_to, amount_);
  }
}
