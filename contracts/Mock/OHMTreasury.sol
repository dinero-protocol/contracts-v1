// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

import {IOHM} from "../interface/IOHM.sol";
import {IsOHM} from "../interface/IsOHM.sol";

contract OlympusTreasury {
  IOHM public immutable OHM;
  IsOHM public sOHM;

  mapping(address => uint256) public debtLimit;
    
  uint256 public totalDebt;
  uint256 public ohmDebt;

  constructor(
    address _ohm,
    address _sOhm
  ) {
    OHM = IOHM(_ohm);
    sOHM = IsOHM(_sOhm);
  }

  function incurDebt(uint256 _amount, address _token) external {
    uint256 value;
    require(_token == address(OHM), "Treasury: invalid token");

    value = _amount;
    require(value != 0, "Treasury: invalid token");

    sOHM.changeDebt(value, msg.sender, true);
    require(sOHM.debtBalances(msg.sender) <= debtLimit[msg.sender], "Treasury: exceeds limit");
    totalDebt += value;

    OHM.mint(msg.sender, value);
    ohmDebt += value;
  }

  function setDebtLimit(address _address, uint256 _limit) external {
    debtLimit[_address] = _limit;
  }
}